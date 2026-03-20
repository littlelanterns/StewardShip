import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { ManifestItem, ManifestUsageDesignation } from '../lib/types';

export interface IntakeSuggestions {
  summary: string;
  suggested_tags: string[];
  suggested_folder: string;
  suggested_usage: ManifestUsageDesignation;
}

// Max concurrent manifest-process Edge Functions. Prevents overwhelming OpenAI + Supabase.
const MAX_CONCURRENT_PROCESSING = 3;

export function useManifest() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<ManifestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Refs for functions called inside poll intervals (avoid stale closures)
  const runIntakeRef = useRef<(id: string) => Promise<IntakeSuggestions | null>>(async () => null);
  const applyIntakeRef = useRef<(id: string, intake: { tags: string[]; folder_group: string; usage_designations: ManifestUsageDesignation[] }) => Promise<boolean>>(async () => false);
  const updateItemRef = useRef<(id: string, updates: Record<string, unknown>) => Promise<boolean>>(async () => false);

  // Fetch all active manifest items
  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('manifest_items')
        .select('id, user_id, title, file_type, file_name, storage_path, file_size_bytes, usage_designations, tags, folder_group, processing_status, processing_detail, chunk_count, intake_completed, ai_summary, author, isbn, extraction_status, genres, source_manifest_item_id, parent_manifest_item_id, part_number, part_count, last_viewed_at, archived_at, created_at, updated_at')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .is('parent_manifest_item_id', null)
        .order('folder_group')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setItems((data as ManifestItem[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Upload a file to storage and create a manifest_items record
  const uploadFile = useCallback(async (
    file: File,
    options?: { title?: string; usageDesignations?: ManifestUsageDesignation[]; folderGroup?: string; tags?: string[] },
  ): Promise<ManifestItem | null> => {
    if (!user) return null;
    setError(null);

    // Sanitize filename: remove special chars that break Supabase Storage paths
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${Date.now()}_${safeName}`;

    // 1. Upload to storage — explicitly set contentType for formats where
    // browsers may send a MIME type not in the bucket's allowed list
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeOverrides: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      epub: 'application/epub+zip',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = mimeOverrides[ext || ''] || undefined;
    const uploadOptions = contentType ? { contentType } : undefined;

    // For large files (>20MB), use Supabase's signed URL upload which supports
    // larger payloads through the storage API. Standard upload can hit API gateway
    // body size limits (~50MB) resulting in 400 errors.
    let uploadErr: { message: string } | null = null;
    if (file.size > 20_000_000) {
      console.log(`[Manifest] Large file (${Math.round(file.size / 1024 / 1024)}MB) — using signed URL upload`);
      const { data: signedData, error: signErr } = await supabase.storage
        .from('manifest-files')
        .createSignedUploadUrl(storagePath);

      if (signErr || !signedData) {
        uploadErr = signErr || { message: 'Failed to create signed upload URL' };
      } else {
        const { error: putErr } = await supabase.storage
          .from('manifest-files')
          .uploadToSignedUrl(storagePath, signedData.token, file, {
            ...(contentType ? { contentType } : {}),
          });
        uploadErr = putErr;
      }
    } else {
      const { error: stdErr } = await supabase.storage
        .from('manifest-files')
        .upload(storagePath, file, uploadOptions);
      uploadErr = stdErr;
    }

    if (uploadErr) {
      setError(uploadErr.message);
      return null;
    }

    // 2. Determine file type (ext already computed above)
    const fileType = (file.type === 'application/pdf' || ext === 'pdf')
      ? 'pdf'
      : (file.type === 'application/epub+zip' || ext === 'epub')
        ? 'epub'
        : (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx')
          ? 'docx'
          : ext === 'md'
            ? 'md'
            : (file.type === 'text/plain' || ext === 'txt')
              ? 'txt'
              : file.type.startsWith('audio/')
                ? 'audio'
                : file.type.startsWith('image/')
                  ? 'image'
                  : 'txt' as const;

    // 3. Create manifest_items record
    const { data: item, error: insertErr } = await supabase
      .from('manifest_items')
      .insert({
        user_id: user.id,
        title: options?.title || file.name.replace(/\.[^.]+$/, ''),
        file_type: fileType,
        file_name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        processing_status: 'pending',
        usage_designations: options?.usageDesignations || ['general_reference'],
        folder_group: options?.folderGroup || 'Uncategorized',
        tags: options?.tags || [],
      })
      .select()
      .single();

    if (insertErr || !item) {
      setError(insertErr?.message || 'Failed to create item');
      return null;
    }

    // 4. Add to local state — queue manager useEffect will trigger processing
    setItems((prev) => [item as ManifestItem, ...prev]);
    return item as ManifestItem;
  }, [user]);

  // Create a text note (no file upload)
  const createTextNote = useCallback(async (
    title: string,
    content: string,
    options?: { usageDesignations?: ManifestUsageDesignation[]; folderGroup?: string; tags?: string[] },
  ): Promise<ManifestItem | null> => {
    if (!user) return null;
    setError(null);

    const { data: item, error: insertErr } = await supabase
      .from('manifest_items')
      .insert({
        user_id: user.id,
        title,
        file_type: 'text_note',
        text_content: content,
        processing_status: 'pending',
        usage_designations: options?.usageDesignations || ['general_reference'],
        folder_group: options?.folderGroup || 'Uncategorized',
        tags: options?.tags || [],
      })
      .select()
      .single();

    if (insertErr || !item) {
      setError(insertErr?.message || 'Failed to create text note');
      return null;
    }

    // Add to local state — queue manager useEffect will trigger processing
    setItems((prev) => [item as ManifestItem, ...prev]);
    return item as ManifestItem;
  }, [user]);

  // Update a manifest item
  const updateItem = useCallback(async (
    id: string,
    updates: Partial<Pick<ManifestItem, 'title' | 'tags' | 'usage_designations' | 'folder_group' | 'related_wheel_id' | 'related_goal_id' | 'intake_completed' | 'text_content' | 'author' | 'isbn'>>,
  ): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    const { error: updateErr } = await supabase
      .from('manifest_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
      return false;
    }

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
    return true;
  }, [user]);

  // Re-trigger processing
  const reprocessItem = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    // Clear AI-generated metadata so format-native metadata (EPUB/PDF) can re-populate correctly
    // This prevents stale AI-hallucinated ISBNs/authors from blocking correct metadata
    const { error: updateErr } = await supabase
      .from('manifest_items')
      .update({
        processing_status: 'pending',
        processing_detail: null,
        chunk_count: 0,
        isbn: null,
        author: null,
        ai_summary: null,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
      return false;
    }

    // Reset to pending — queue manager useEffect will trigger processing
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, processing_status: 'pending' as const, processing_detail: null, chunk_count: 0, isbn: null, author: null, ai_summary: null }
          : item,
      ),
    );

    return true;
  }, [user]);

  // Soft-delete (archive) — also archives child parts if this is a split parent
  const archiveItem = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    const now = new Date().toISOString();

    const { error: archiveErr } = await supabase
      .from('manifest_items')
      .update({ archived_at: now })
      .eq('id', id)
      .eq('user_id', user.id);

    if (archiveErr) {
      setError(archiveErr.message);
      return false;
    }

    // Cascade archive to child parts
    await supabase
      .from('manifest_items')
      .update({ archived_at: now })
      .eq('parent_manifest_item_id', id)
      .eq('user_id', user.id);

    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }, [user]);

  // Hard delete (item + chunks + storage file)
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    setError(null);

    const item = items.find((i) => i.id === id);

    // Delete storage file if it exists
    if (item?.storage_path) {
      await supabase.storage.from('manifest-files').remove([item.storage_path]);
    }

    // Chunks cascade-delete from manifest_items FK
    const { error: deleteErr } = await supabase
      .from('manifest_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteErr) {
      setError(deleteErr.message);
      return false;
    }

    setItems((prev) => prev.filter((i) => i.id !== id));
    return true;
  }, [user, items]);

  // Clone a manifest item to all other users (fire-and-forget)
  const cloneToAllUsers = useCallback(async (itemId: string, cloneExtractions: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const { error: cloneErr } = await supabase.functions.invoke('manifest-clone', {
        body: { manifest_item_id: itemId, clone_extractions: cloneExtractions },
      });

      if (cloneErr) {
        console.error('[manifest-clone] Failed (non-fatal):', cloneErr);
      } else {
        console.log(`[manifest-clone] Cloned ${itemId} (extractions: ${cloneExtractions})`);
      }
    } catch (err) {
      console.error('[manifest-clone] Error (non-fatal):', err);
    }
  }, []);

  // Poll processing status for an item until it completes or fails
  const pollProcessingStatus = useCallback((itemId: string, force?: boolean) => {
    if (!user) return;

    // Skip if already polling this item (unless forced, e.g. after upload)
    const existing = pollIntervalsRef.current.get(itemId);
    if (existing && !force) return;
    if (existing) clearInterval(existing);

    let errorCount = 0;
    const MAX_POLL_ERRORS = 5; // Stop polling after 5 consecutive failures

    const interval = setInterval(async () => {
      const { data, error: pollErr } = await supabase
        .from('manifest_items')
        .select('processing_status, processing_detail, chunk_count, ai_summary, toc, author, isbn, intake_completed')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      if (pollErr || !data) {
        errorCount++;
        if (errorCount >= MAX_POLL_ERRORS) {
          console.warn(`[manifest-poll] Stopping poll for ${itemId} after ${MAX_POLL_ERRORS} consecutive errors`);
          const iv = pollIntervalsRef.current.get(itemId);
          if (iv) { clearInterval(iv); pollIntervalsRef.current.delete(itemId); }
        }
        return;
      }

      errorCount = 0; // Reset on success

      const status = data.processing_status;

      // Update local state with latest progress detail
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                processing_status: status,
                processing_detail: data.processing_detail,
                ...(status === 'completed' || status === 'failed'
                  ? { chunk_count: data.chunk_count || 0, ai_summary: data.ai_summary, toc: data.toc, author: data.author, isbn: data.isbn }
                  : {}),
              }
            : item,
        ),
      );

      if (status === 'completed' || status === 'failed') {
        const iv = pollIntervalsRef.current.get(itemId);
        if (iv) { clearInterval(iv); pollIntervalsRef.current.delete(itemId); }

        // Clone is now manual — use "Push to Family" on ManifestItemDetail after reviewing extractions

        // Auto-enrich completed items — always run with force_all to ensure
        // title, author, ISBN, summary, and tags are all populated/refreshed
        if (status === 'completed') {
          supabase.functions
            .invoke('manifest-enrich', {
              body: { manifest_item_id: itemId, user_id: user.id, force_all: true },
            })
            .then(({ data: enrichData }) => {
              if (enrichData?.summary || enrichData?.author || enrichData?.tags || enrichData?.title) {
                setItems((prev) =>
                  prev.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          ...(enrichData.summary ? { ai_summary: enrichData.summary } : {}),
                          ...(enrichData.author ? { author: enrichData.author } : {}),
                          ...(enrichData.isbn ? { isbn: enrichData.isbn } : {}),
                          ...(enrichData.title ? { title: enrichData.title } : {}),
                          ...(enrichData.tags ? { tags: enrichData.tags } : {}),
                        }
                      : item,
                  ),
                );
              }
            })
            .catch((err) => console.error('Auto-enrich failed (non-fatal):', err));
        }

        // Auto-split very large books into parts (fire-and-forget)
        if (status === 'completed') {
          // Check if item qualifies: not a part, not already split, text > threshold
          Promise.resolve(
            supabase
              .from('manifest_items')
              .select('text_content, parent_manifest_item_id, part_count')
              .eq('id', itemId)
              .single(),
          )
            .then(({ data: sizeCheck }) => {
              if (
                sizeCheck?.text_content &&
                sizeCheck.text_content.length > 780_000 &&
                !sizeCheck.parent_manifest_item_id &&
                !sizeCheck.part_count
              ) {
                console.log(`[auto-split] Item ${itemId} qualifies (${sizeCheck.text_content.length} chars). Triggering split...`);
                Promise.resolve(
                  supabase.functions.invoke('manifest-split', { body: { manifest_item_id: itemId } }),
                )
                  .then(({ data: splitData }) => {
                    if (splitData?.parts_created > 0) {
                      setItems((prev) =>
                        prev.map((item) =>
                          item.id === itemId ? { ...item, part_count: splitData.parts_created } : item,
                        ),
                      );
                      // Poll each new part's processing
                      splitData.part_ids?.forEach((partId: string) => pollProcessingStatus(partId));
                    }
                  })
                  .catch((err: unknown) => console.error('Auto-split failed (non-fatal):', err));
              }
            })
            .catch(() => {});
        }

        // Auto-intake if not already done (fire-and-forget, uses refs to avoid stale closures)
        if (status === 'completed' && !data.intake_completed) {
          setTimeout(async () => {
            try {
              const suggestions = await runIntakeRef.current(itemId);
              if (suggestions) {
                await applyIntakeRef.current(itemId, {
                  tags: suggestions.suggested_tags,
                  folder_group: suggestions.suggested_folder,
                  usage_designations: [suggestions.suggested_usage],
                });
              } else {
                await updateItemRef.current(itemId, { intake_completed: true });
              }
            } catch (err) {
              console.error('[queue] Auto-intake failed (non-fatal):', err);
              await updateItemRef.current(itemId, { intake_completed: true }).catch(() => {});
            }
          }, 1500);
        }
      }
    }, 3000);

    pollIntervalsRef.current.set(itemId, interval);
  }, [user, cloneToAllUsers]);

  // Auto-intake: wait for processing to complete, then run and apply AI intake suggestions
  // Run AI intake analysis on a manifest item
  const runIntake = useCallback(async (itemId: string): Promise<IntakeSuggestions | null> => {
    if (!user) return null;

    const item = items.find((i) => i.id === itemId);
    if (!item) return null;

    // Get existing tags and folders for context
    const existingTags = [...new Set(items.flatMap((i) => i.tags))];
    const existingFolders = [...new Set(
      items.map((i) => i.folder_group).filter((f) => f && f !== 'Uncategorized'),
    )];

    // If text_content isn't loaded locally, fetch it
    let textContent = item.text_content;
    if (!textContent) {
      const { data } = await supabase
        .from('manifest_items')
        .select('text_content')
        .eq('id', itemId)
        .single();
      textContent = data?.text_content;
    }

    if (!textContent) return null;

    const { data, error: invokeErr } = await supabase.functions.invoke('manifest-intake', {
      body: {
        text_content: textContent,
        file_name: item.file_name,
        existing_tags: existingTags,
        existing_folders: existingFolders,
        user_id: user.id,
      },
    });

    if (invokeErr || !data) return null;
    return data as IntakeSuggestions;
  }, [user, items]);

  // Apply user-confirmed intake choices to a manifest item
  const applyIntake = useCallback(async (
    itemId: string,
    intake: { tags: string[]; folder_group: string; usage_designations: ManifestUsageDesignation[] },
  ): Promise<boolean> => {
    return updateItem(itemId, {
      tags: intake.tags,
      folder_group: intake.folder_group,
      usage_designations: intake.usage_designations,
      intake_completed: true,
    });
  }, [updateItem]);

  // Auto-intake is now handled by pollProcessingStatus on completion.
  // This function is kept for UploadFlow compatibility — returns immediately.
  const autoIntakeItem = useCallback(async (_itemId: string): Promise<boolean> => {
    // Queue manager + poll handler take care of processing and intake automatically
    return true;
  }, []);

  // Get all unique tags across all items
  const getUniqueTags = useCallback((): string[] => {
    return [...new Set(items.flatMap((i) => i.tags))].sort();
  }, [items]);

  // Get all unique folder_group values
  const getUniqueFolders = useCallback((): string[] => {
    return [...new Set(items.map((i) => i.folder_group).filter(Boolean))].sort();
  }, [items]);

  // Fetch a single item with full text_content
  const fetchItemDetail = useCallback(async (itemId: string): Promise<ManifestItem | null> => {
    if (!user) return null;

    const { data, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !data) return null;

    // Update local state with full data
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? (data as ManifestItem) : item)),
    );

    return data as ManifestItem;
  }, [user]);

  // Fetch child parts for a split book, ordered by part_number
  const fetchParts = useCallback(async (parentItemId: string): Promise<ManifestItem[]> => {
    if (!user) return [];
    const { data, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, user_id, title, file_type, file_name, storage_path, file_size_bytes, usage_designations, tags, folder_group, processing_status, processing_detail, chunk_count, intake_completed, ai_summary, author, isbn, extraction_status, genres, source_manifest_item_id, parent_manifest_item_id, part_number, part_count, last_viewed_at, archived_at, created_at, updated_at')
      .eq('parent_manifest_item_id', parentItemId)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('part_number');

    if (fetchErr) return [];
    return (data as ManifestItem[]) || [];
  }, [user]);

  // Process (or reprocess) child parts that are stuck in pending/failed/processing
  const processChildParts = useCallback(async (
    parentItemId: string,
    parts: ManifestItem[],
    onPartsUpdated: (updatedParts: ManifestItem[]) => void,
  ): Promise<void> => {
    if (!user) return;

    // Find parts that need processing (not completed)
    const stuckParts = parts.filter(
      (p) => p.processing_status !== 'completed',
    );
    if (stuckParts.length === 0) return;

    // Reset all stuck parts to pending in DB
    const stuckIds = stuckParts.map((p) => p.id);
    await supabase
      .from('manifest_items')
      .update({ processing_status: 'pending', chunk_count: 0, processing_detail: null })
      .in('id', stuckIds)
      .eq('user_id', user.id);

    // Optimistically update parts in UI
    const updatedParts = parts.map((p) =>
      stuckIds.includes(p.id)
        ? { ...p, processing_status: 'processing' as const, chunk_count: 0, processing_detail: null }
        : p,
    );
    onPartsUpdated(updatedParts);

    // Process sequentially to avoid overwhelming Edge Functions
    for (const part of stuckParts) {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke('manifest-process', {
          body: { manifest_item_id: part.id, user_id: user.id },
        });
        if (invokeErr) {
          console.error(`[processChildParts] Failed for "${part.title}":`, invokeErr);
        } else if (data?.needs_chunking) {
          // Phase 2: chunking in separate call
          await supabase.functions.invoke('manifest-process', {
            body: { manifest_item_id: part.id, user_id: user.id, phase: 'chunk' },
          });
        }
      } catch (err) {
        console.error(`[processChildParts] Error for "${part.title}":`, err);
      }
      // Start polling for this part
      pollProcessingStatus(part.id);
    }

    // After all invocations fired, poll until all complete then re-fetch
    const pollAll = setInterval(async () => {
      const freshParts = await fetchParts(parentItemId);
      onPartsUpdated(freshParts);
      const allDone = freshParts.every(
        (p) => p.processing_status === 'completed' || p.processing_status === 'failed',
      );
      if (allDone) {
        clearInterval(pollAll);
      }
    }, 5000);
  }, [user, fetchParts, pollProcessingStatus]);

  // Reprocess a single child part (reset + re-run both phases)
  const reprocessSinglePart = useCallback(async (
    parentItemId: string,
    partId: string,
    allParts: ManifestItem[],
    onPartsUpdated: (updatedParts: ManifestItem[]) => void,
  ): Promise<void> => {
    if (!user) return;

    // Reset this part to pending
    await supabase
      .from('manifest_items')
      .update({ processing_status: 'pending', chunk_count: 0, processing_detail: null })
      .eq('id', partId)
      .eq('user_id', user.id);

    // Optimistic UI update
    onPartsUpdated(allParts.map((p) =>
      p.id === partId
        ? { ...p, processing_status: 'processing' as const, chunk_count: 0, processing_detail: 'Restarting...' }
        : p,
    ));

    // Run both phases
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-process', {
        body: { manifest_item_id: partId, user_id: user.id },
      });
      if (invokeErr) {
        console.error(`[reprocessSinglePart] Phase 1 failed:`, invokeErr);
      } else if (data?.needs_chunking) {
        await supabase.functions.invoke('manifest-process', {
          body: { manifest_item_id: partId, user_id: user.id, phase: 'chunk' },
        });
      }
    } catch (err) {
      console.error(`[reprocessSinglePart] Error:`, err);
    }

    // Poll until this part is done
    const poll = setInterval(async () => {
      const freshParts = await fetchParts(parentItemId);
      onPartsUpdated(freshParts);
      const thisPart = freshParts.find((p) => p.id === partId);
      if (thisPart && (thisPart.processing_status === 'completed' || thisPart.processing_status === 'failed')) {
        clearInterval(poll);
      }
    }, 5000);
  }, [user, fetchParts]);

  // Generate AI summary (and optionally regenerate tags) for a manifest item
  const enrichItem = useCallback(async (
    itemId: string,
    forceAll = false,
  ): Promise<{ summary: string; tags?: string[] } | null> => {
    if (!user) return null;
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-enrich', {
        body: {
          manifest_item_id: itemId,
          user_id: user.id,
          regenerate_tags: forceAll,
          force_all: forceAll,
        },
      });
      if (invokeErr) throw invokeErr;

      // Always re-fetch from DB to ensure UI reflects saved state
      // (Edge Function may have saved tags even if response parsing varied)
      const { data: fresh } = await supabase
        .from('manifest_items')
        .select('ai_summary, tags, author, isbn, title')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ai_summary: fresh?.ai_summary ?? data.summary,
                tags: fresh?.tags ?? (data.tags ? data.tags : item.tags),
                ...(fresh?.author || data.author ? { author: fresh?.author ?? data.author } : {}),
                ...(fresh?.isbn || data.isbn ? { isbn: fresh?.isbn ?? data.isbn } : {}),
                ...(fresh?.title ? { title: fresh.title } : {}),
              }
            : item,
        ),
      );

      return { summary: fresh?.ai_summary ?? data.summary, tags: fresh?.tags ?? data.tags };
    } catch (err) {
      console.error('Enrich item failed:', err);
      return null;
    }
  }, [user]);

  // Check for duplicate before upload
  const checkDuplicate = useCallback((fileName: string, fileSize: number): ManifestItem | null => {
    return items.find(
      (i) => i.file_name === fileName &&
        i.file_size_bytes !== null &&
        Math.abs((i.file_size_bytes || 0) - fileSize) < 1024,
    ) || null;
  }, [items]);

  // Fix garbled titles: re-enrich books with garbled-looking titles (CR!, .azw, etc.)
  // Uses ISBN + author context for confident identification. Very low API cost (Haiku).
  const fixGarbledTitles = useCallback(async () => {
    if (!user) return;

    const { data: allBooks, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, title, author, isbn')
      .eq('user_id', user.id)
      .eq('processing_status', 'completed')
      .is('archived_at', null)
      .neq('file_type', 'text_note');

    if (fetchErr || !allBooks) {
      console.error('[fix-garbled] Failed to fetch:', fetchErr);
      return;
    }

    // Filter to garbled titles
    const garbled = allBooks.filter((item) => {
      if (!item.title) return false;
      return (
        (!/\s/.test(item.title) && /[!@#$%^&]|^[A-Z0-9]{20,}/.test(item.title)) ||
        /^CR![A-Z0-9]+/i.test(item.title) ||
        /\.(azw|mobi|azw3)$/i.test(item.title)
      );
    });

    if (garbled.length === 0) {
      console.log('[fix-garbled] No garbled titles found.');
      return;
    }

    console.log(`[fix-garbled] Re-enriching ${garbled.length} books with garbled titles...`);
    for (const item of garbled) {
      console.log(`[fix-garbled] Fixing "${item.title}" (author: ${item.author || 'unknown'}, ISBN: ${item.isbn || 'none'})...`);
      await enrichItem(item.id, true); // force_all = true
      // Rate limit: 1.5 seconds between calls
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Refresh items list
    await fetchItems();
    console.log('[fix-garbled] Done.');
  }, [user, enrichItem, fetchItems]);

  // Backfill: enrich all completed books where author is null
  const backfillAuthors = useCallback(async () => {
    if (!user) return;

    const { data: needsAuthor, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('processing_status', 'completed')
      .is('author', null)
      .is('archived_at', null)
      .neq('file_type', 'text_note');

    if (fetchErr || !needsAuthor) {
      console.error('[backfill-authors] Failed to fetch:', fetchErr);
      return;
    }

    console.log(`[backfill-authors] Enriching ${needsAuthor.length} books for author/ISBN...`);
    for (const item of needsAuthor) {
      console.log(`[backfill-authors] Enriching "${item.title}"...`);
      await enrichItem(item.id, false);
      // Rate limit: 1 second between calls
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('[backfill-authors] Done.');
  }, [user, enrichItem]);

  // Backfill: clone all original (non-cloned) completed items to all other users
  // Fetches fresh data from DB to avoid stale React state
  const backfillCloneAll = useCallback(async () => {
    if (!user) return;

    const { data: freshItems, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('id, title, processing_status, extraction_status, source_manifest_item_id')
      .eq('user_id', user.id)
      .is('archived_at', null);

    if (fetchErr || !freshItems) {
      console.error('[backfill] Failed to fetch items:', fetchErr);
      return;
    }

    // Only clone books that have extractions — no reason to clone books without extracted content
    const originals = freshItems.filter(
      (i) => !i.source_manifest_item_id && i.processing_status === 'completed' && i.extraction_status === 'completed',
    );
    console.log(`[backfill] Cloning ${originals.length} extracted items to all users...`);
    for (const item of originals) {
      console.log(`[backfill] Cloning "${item.title}" with extractions...`);
      await cloneToAllUsers(item.id, true);
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('[backfill] Done.');
  }, [user, cloneToAllUsers]);

  // --- Ref syncing for functions called inside poll intervals ---
  useEffect(() => { runIntakeRef.current = runIntake; }, [runIntake]);
  useEffect(() => { applyIntakeRef.current = applyIntake; }, [applyIntake]);
  useEffect(() => { updateItemRef.current = updateItem as (id: string, updates: Record<string, unknown>) => Promise<boolean>; }, [updateItem]);

  // --- Queue Manager: auto-process pending items up to MAX_CONCURRENT ---
  // Fires whenever items state changes. Early-exits are cheap (just array filter).
  useEffect(() => {
    if (!user) return;

    // Count actively processing items
    const processingCount = items.filter((i) => i.processing_status === 'processing').length;
    if (processingCount >= MAX_CONCURRENT_PROCESSING) return;

    // Find pending items eligible for processing (have a file or are text notes)
    const pendingItems = items
      .filter((i) =>
        i.processing_status === 'pending' &&
        (i.storage_path || i.file_type === 'text_note'),
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (pendingItems.length === 0) return;

    const slotsAvailable = MAX_CONCURRENT_PROCESSING - processingCount;
    const toProcess = pendingItems.slice(0, slotsAvailable);
    const toProcessIds = new Set(toProcess.map((i) => i.id));

    console.log(`[queue] Starting ${toProcess.length} items (${processingCount} active, ${pendingItems.length} pending, ${slotsAvailable} slots)`);

    // Optimistically mark as processing
    setItems((prev) =>
      prev.map((i) =>
        toProcessIds.has(i.id)
          ? { ...i, processing_status: 'processing' as const }
          : i,
      ),
    );

    // Fire off processing and start polling for each
    for (const item of toProcess) {
      console.log(`[queue] Processing: "${item.title}" (${item.id})`);
      supabase.functions
        .invoke('manifest-process', {
          body: { manifest_item_id: item.id, user_id: user.id },
        })
        .then(({ data, error: invokeErr }) => {
          if (invokeErr) {
            console.error(`[queue] manifest-process failed for "${item.title}":`, invokeErr);
            supabase
              .from('manifest_items')
              .update({ processing_status: 'failed', processing_detail: `Edge Function error: ${invokeErr.message || 'unknown'}` })
              .eq('id', item.id)
              .then(() => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, processing_status: 'failed' as const, processing_detail: `Edge Function error: ${invokeErr.message || 'unknown'}` }
                      : i,
                  ),
                );
              });
            return;
          }
          // Phase 1 returned — text extracted, now call phase 2 for chunking
          if (data?.needs_chunking) {
            console.log(`[queue] Phase 1 done for "${item.title}" (${data.text_length} chars), starting chunking phase...`);
            supabase.functions
              .invoke('manifest-process', {
                body: { manifest_item_id: item.id, user_id: user.id, phase: 'chunk' },
              })
              .then(({ error: chunkErr }) => {
                if (chunkErr) {
                  console.error(`[queue] Chunking phase failed for "${item.title}":`, chunkErr);
                  // Text is saved — mark as completed with a note about missing chunks
                  supabase
                    .from('manifest_items')
                    .update({ processing_status: 'completed', processing_detail: 'Text extracted but chunking failed. Try reprocessing.' })
                    .eq('id', item.id);
                }
              })
              .catch((err) => {
                console.error(`[queue] Chunking phase invoke error for "${item.title}":`, err);
              });
          }
        })
        .catch((err) => {
          console.error(`[queue] manifest-process invoke error for "${item.title}":`, err);
          supabase
            .from('manifest_items')
            .update({ processing_status: 'failed', processing_detail: `Invoke error: ${(err as Error).message}` })
            .eq('id', item.id)
            .then(() => {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? { ...i, processing_status: 'failed' as const, processing_detail: `Invoke error: ${(err as Error).message}` }
                    : i,
                ),
              );
            });
        });
      pollProcessingStatus(item.id, true);
    }
  }, [items, user, pollProcessingStatus]);

  // --- Stuck detection: reset items stuck in 'processing' for >15 min on page load ---
  const stuckCheckDoneRef = useRef(false);
  useEffect(() => {
    if (!user || loading || stuckCheckDoneRef.current) return;
    if (items.length === 0) return;
    stuckCheckDoneRef.current = true;

    const stuckItems = items.filter((i) => {
      if (i.processing_status !== 'processing') return false;
      const updated = new Date(i.updated_at).getTime();
      const now = Date.now();
      return now - updated > 15 * 60 * 1000; // 15 minutes
    });

    if (stuckItems.length > 0) {
      console.log(`[queue] Found ${stuckItems.length} stuck items, resetting to pending`);
      const stuckIds = stuckItems.map((i) => i.id);

      // Batch DB update — single query for all stuck items
      supabase
        .from('manifest_items')
        .update({ processing_status: 'pending', processing_detail: null })
        .in('id', stuckIds)
        .eq('user_id', user.id)
        .then(() => {
          // Single state update for all stuck items
          const stuckIdSet = new Set(stuckIds);
          setItems((prev) =>
            prev.map((i) =>
              stuckIdSet.has(i.id)
                ? { ...i, processing_status: 'pending' as const, processing_detail: null }
                : i,
            ),
          );
        });
    }
  }, [items, user, loading]);

  // Get queue position for a pending item (1-based, null if not pending)
  const getQueuePosition = useCallback((itemId: string): number | null => {
    const pendingItems = items
      .filter((i) =>
        i.processing_status === 'pending' &&
        (i.storage_path || i.file_type === 'text_note'),
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const index = pendingItems.findIndex((i) => i.id === itemId);
    return index >= 0 ? index + 1 : null;
  }, [items]);

  // Cleanup all polls on unmount
  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pollIntervalsRef.current.clear();
    };
  }, []);

  return {
    items,
    loading,
    error,
    fetchItems,
    uploadFile,
    createTextNote,
    updateItem,
    reprocessItem,
    archiveItem,
    deleteItem,
    pollProcessingStatus,
    runIntake,
    applyIntake,
    getUniqueTags,
    getUniqueFolders,
    fetchItemDetail,
    fetchParts,
    processChildParts,
    reprocessSinglePart,
    checkDuplicate,
    enrichItem,
    autoIntakeItem,
    cloneToAllUsers,
    backfillCloneAll,
    backfillAuthors,
    fixGarbledTitles,
    getQueuePosition,
  };
}
