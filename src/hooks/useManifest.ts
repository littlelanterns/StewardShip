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

export function useManifest() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<ManifestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Fetch all active manifest items
  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('manifest_items')
        .select('id, user_id, title, file_type, file_name, storage_path, file_size_bytes, usage_designations, tags, folder_group, processing_status, processing_detail, chunk_count, intake_completed, ai_summary, extraction_status, genres, source_manifest_item_id, parent_manifest_item_id, part_number, part_count, archived_at, created_at, updated_at')
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

    const storagePath = `${user.id}/${Date.now()}_${file.name}`;

    // 1. Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from('manifest-files')
      .upload(storagePath, file);

    if (uploadErr) {
      setError(uploadErr.message);
      return null;
    }

    // 2. Determine file type
    const ext = file.name.split('.').pop()?.toLowerCase();
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

    // 4. Trigger processing (fire and forget)
    supabase.functions
      .invoke('manifest-process', {
        body: { manifest_item_id: item.id, user_id: user.id },
      })
      .catch((err) => console.error('Processing trigger failed:', err));

    // 5. Add to local state
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

    // Trigger processing
    supabase.functions
      .invoke('manifest-process', {
        body: { manifest_item_id: item.id, user_id: user.id },
      })
      .catch((err) => console.error('Processing trigger failed:', err));

    setItems((prev) => [item as ManifestItem, ...prev]);
    return item as ManifestItem;
  }, [user]);

  // Update a manifest item
  const updateItem = useCallback(async (
    id: string,
    updates: Partial<Pick<ManifestItem, 'title' | 'tags' | 'usage_designations' | 'folder_group' | 'related_wheel_id' | 'related_goal_id' | 'intake_completed' | 'text_content'>>,
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

    const { error: updateErr } = await supabase
      .from('manifest_items')
      .update({ processing_status: 'pending', chunk_count: 0 })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
      return false;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, processing_status: 'pending' as const, chunk_count: 0 } : item,
      ),
    );

    supabase.functions
      .invoke('manifest-process', {
        body: { manifest_item_id: id, user_id: user.id },
      })
      .catch((err) => console.error('Reprocess trigger failed:', err));

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
  const pollProcessingStatus = useCallback((itemId: string) => {
    if (!user) return;

    // Clear any existing poll for this specific item
    const existing = pollIntervalsRef.current.get(itemId);
    if (existing) clearInterval(existing);

    const interval = setInterval(async () => {
      const { data, error: pollErr } = await supabase
        .from('manifest_items')
        .select('processing_status, processing_detail, chunk_count, ai_summary, toc')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      if (pollErr || !data) {
        const iv = pollIntervalsRef.current.get(itemId);
        if (iv) { clearInterval(iv); pollIntervalsRef.current.delete(itemId); }
        return;
      }

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
                  ? { chunk_count: data.chunk_count || 0, ai_summary: data.ai_summary, toc: data.toc }
                  : {}),
              }
            : item,
        ),
      );

      if (status === 'completed' || status === 'failed') {
        const iv = pollIntervalsRef.current.get(itemId);
        if (iv) { clearInterval(iv); pollIntervalsRef.current.delete(itemId); }

        // Clone is now manual — use "Push to Family" on ManifestItemDetail after reviewing extractions

        // Auto-enrich newly completed items that have no summary yet (fire-and-forget)
        if (status === 'completed' && !data.ai_summary) {
          supabase.functions
            .invoke('manifest-enrich', {
              body: { manifest_item_id: itemId, user_id: user.id },
            })
            .then(({ data: enrichData }) => {
              if (enrichData?.summary) {
                setItems((prev) =>
                  prev.map((item) =>
                    item.id === itemId
                      ? { ...item, ai_summary: enrichData.summary }
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

  // Used by bulk upload for hands-off processing. Fire-and-forget — runs in background.
  const autoIntakeItem = useCallback(async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    // Poll DB directly until processing completes (max 5 minutes)
    const MAX_ATTEMPTS = 100;
    const POLL_MS = 3000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));

      const { data } = await supabase
        .from('manifest_items')
        .select('processing_status')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      if (!data) return false;
      if (data.processing_status === 'failed') return false;
      if (data.processing_status === 'completed') break;
      if (attempt === MAX_ATTEMPTS - 1) return false; // timeout
    }

    // Run AI intake
    try {
      const suggestions = await runIntake(itemId);
      if (suggestions) {
        await applyIntake(itemId, {
          tags: suggestions.suggested_tags,
          folder_group: suggestions.suggested_folder,
          usage_designations: [suggestions.suggested_usage],
        });
      } else {
        // Intake failed but mark complete so item isn't stuck
        await updateItem(itemId, { intake_completed: true });
      }
      return true;
    } catch (err) {
      console.error('Auto-intake failed (non-fatal):', err);
      await updateItem(itemId, { intake_completed: true });
      return false;
    }
  }, [user, runIntake, applyIntake, updateItem]);

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
      .select('id, user_id, title, file_type, file_name, storage_path, file_size_bytes, usage_designations, tags, folder_group, processing_status, processing_detail, chunk_count, intake_completed, ai_summary, extraction_status, genres, source_manifest_item_id, parent_manifest_item_id, part_number, part_count, archived_at, created_at, updated_at')
      .eq('parent_manifest_item_id', parentItemId)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('part_number');

    if (fetchErr) return [];
    return (data as ManifestItem[]) || [];
  }, [user]);

  // Generate AI summary (and optionally regenerate tags) for a manifest item
  const enrichItem = useCallback(async (
    itemId: string,
    regenerateTags = false,
  ): Promise<{ summary: string; tags?: string[] } | null> => {
    if (!user) return null;
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manifest-enrich', {
        body: {
          manifest_item_id: itemId,
          user_id: user.id,
          regenerate_tags: regenerateTags,
        },
      });
      if (invokeErr) throw invokeErr;

      // Always re-fetch from DB to ensure UI reflects saved state
      // (Edge Function may have saved tags even if response parsing varied)
      const { data: fresh } = await supabase
        .from('manifest_items')
        .select('ai_summary, tags')
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

    const originals = freshItems.filter(
      (i) => !i.source_manifest_item_id && i.processing_status === 'completed',
    );
    console.log(`[backfill] Cloning ${originals.length} original items to all users...`);
    for (const item of originals) {
      const cloneExtractions = item.extraction_status === 'completed';
      console.log(`[backfill] Cloning "${item.title}" (extractions: ${cloneExtractions})...`);
      await cloneToAllUsers(item.id, cloneExtractions);
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('[backfill] Done.');
  }, [user, cloneToAllUsers]);

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
    checkDuplicate,
    enrichItem,
    autoIntakeItem,
    cloneToAllUsers,
    backfillCloneAll,
  };
}
