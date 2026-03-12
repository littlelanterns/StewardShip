import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'tenisewertman@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const jwt = authHeader.replace('Bearer ', '');
    const payloadB64 = jwt.split('.')[1];
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const jwtPayload = JSON.parse(atob(b64));
    const callerUserId = jwtPayload.sub as string;
    const callerEmail = jwtPayload.email as string;

    if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, manifest_item_id } = await req.json();

    // ── SYNC_FROM_USER ── (any authenticated user can call — syncs their extractions to admin's clone)
    if (action === 'sync_from_user') {
      if (!manifest_item_id) return jsonResponse({ error: 'Missing manifest_item_id' }, 400);

      // Skip if caller IS admin
      if (callerEmail === ADMIN_EMAIL) {
        return jsonResponse({ message: 'Caller is admin, no sync needed', synced: false });
      }

      // Find admin user
      const { data: adminListData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const adminUser = adminListData?.users?.find((u: { email?: string }) => u.email === ADMIN_EMAIL);
      if (!adminUser) {
        return jsonResponse({ message: 'Admin user not found', synced: false });
      }
      const adminId = adminUser.id;

      // Strategy 1: Admin has a clone of this item (user uploaded, admin auto-cloned)
      let adminTargetId: string | null = null;
      const { data: adminClone } = await supabase
        .from('manifest_items')
        .select('id')
        .eq('user_id', adminId)
        .eq('source_manifest_item_id', manifest_item_id)
        .is('archived_at', null)
        .maybeSingle();

      if (adminClone) {
        adminTargetId = adminClone.id;
      } else {
        // Strategy 2: Admin IS the original owner (admin uploaded, user has a clone)
        // Check if caller's item has a source_manifest_item_id pointing to an admin-owned item
        const { data: callerItem } = await supabase
          .from('manifest_items')
          .select('source_manifest_item_id')
          .eq('id', manifest_item_id)
          .eq('user_id', callerUserId)
          .maybeSingle();

        if (callerItem?.source_manifest_item_id) {
          // Verify the source item is owned by admin
          const { data: sourceItem } = await supabase
            .from('manifest_items')
            .select('id, user_id')
            .eq('id', callerItem.source_manifest_item_id)
            .is('archived_at', null)
            .maybeSingle();

          if (sourceItem && sourceItem.user_id === adminId) {
            adminTargetId = sourceItem.id;
          }
        }
      }

      if (!adminTargetId) {
        console.log(`[manifest-admin] sync_from_user: no admin target for ${manifest_item_id}, skipping`);
        return jsonResponse({ message: 'No admin target found', synced: false });
      }

      // Sync extraction data from caller's item to admin's target
      const synced = await syncExtractionsToTarget(
        supabase, manifest_item_id, callerUserId, adminTargetId, adminId,
      );

      // Update admin target's extraction_status
      if (synced) {
        await supabase
          .from('manifest_items')
          .update({ extraction_status: 'completed' })
          .eq('id', adminTargetId);

        // If the synced item is a child part, update the parent's extraction_status too
        const { data: targetItem } = await supabase
          .from('manifest_items')
          .select('parent_manifest_item_id')
          .eq('id', adminTargetId)
          .single();

        if (targetItem?.parent_manifest_item_id) {
          const parentId = targetItem.parent_manifest_item_id;
          // Check how many children are now extracted
          const { data: allChildren } = await supabase
            .from('manifest_items')
            .select('id, extraction_status')
            .eq('parent_manifest_item_id', parentId);

          const anyExtracted = allChildren?.some(
            (c: Record<string, unknown>) => c.extraction_status === 'completed',
          );

          if (anyExtracted) {
            await supabase
              .from('manifest_items')
              .update({ extraction_status: 'completed' })
              .eq('id', parentId);
            console.log(`[manifest-admin] sync_from_user: updated parent ${parentId} extraction_status to completed`);
          }
        }
      }

      return jsonResponse({ message: 'Sync complete', synced });
    }

    // ── All remaining actions require admin ──
    if (callerEmail !== ADMIN_EMAIL) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // ── LIST BOOKS ──
    if (action === 'list_books') {
      // Get admin's books — both original uploads AND auto-cloned from users
      const { data: books, error: booksErr } = await supabase
        .from('manifest_items')
        .select('id, title, file_type, extraction_status, processing_status, created_at, source_manifest_item_id, part_count, parent_manifest_item_id')
        .eq('user_id', callerUserId)
        .is('archived_at', null)
        .is('parent_manifest_item_id', null)
        .order('created_at', { ascending: false });

      if (booksErr) return jsonResponse({ error: booksErr.message }, 500);

      // Get clone counts per book (how many UNIQUE USERS have a clone of each)
      const bookIds = (books || []).map((b: { id: string }) => b.id);
      const cloneCounts: Record<string, number> = {};

      if (bookIds.length > 0) {
        const { data: clones } = await supabase
          .from('manifest_items')
          .select('source_manifest_item_id, user_id')
          .in('source_manifest_item_id', bookIds)
          .neq('user_id', callerUserId)
          .is('archived_at', null);

        // Count unique users per source (dedup in case of duplicate clone records)
        const perSource = new Map<string, Set<string>>();
        for (const clone of clones || []) {
          const srcId = clone.source_manifest_item_id as string;
          if (!perSource.has(srcId)) perSource.set(srcId, new Set());
          perSource.get(srcId)!.add(clone.user_id as string);
        }
        for (const [srcId, users] of perSource) {
          cloneCounts[srcId] = users.size;
        }
      }

      // For auto-cloned books, find the original uploader
      const sourcedBooks = (books || []).filter((b: Record<string, unknown>) => b.source_manifest_item_id);
      const uploaderMap: Record<string, string> = {};
      if (sourcedBooks.length > 0) {
        const sourceIds = sourcedBooks.map((b: Record<string, unknown>) => b.source_manifest_item_id as string);
        const { data: sourceItems } = await supabase
          .from('manifest_items')
          .select('id, user_id')
          .in('id', sourceIds);

        if (sourceItems) {
          const userIds = [...new Set(sourceItems.map((s: Record<string, unknown>) => s.user_id as string))];
          const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
          const emailMap = new Map<string, string>();
          for (const u of userList?.users || []) {
            emailMap.set(u.id, u.email || 'unknown');
          }
          for (const si of sourceItems) {
            uploaderMap[si.id as string] = emailMap.get(si.user_id as string) || 'unknown';
          }
        }
      }

      // Get extraction counts for multi-part books
      const partsMap: Record<string, { extracted: number; total: number }> = {};
      const parentBooks = (books || []).filter((b: Record<string, unknown>) => (b.part_count as number) > 0);
      if (parentBooks.length > 0) {
        const parentIds = parentBooks.map((b: { id: string }) => b.id);
        const { data: parts } = await supabase
          .from('manifest_items')
          .select('id, parent_manifest_item_id, extraction_status')
          .in('parent_manifest_item_id', parentIds);

        for (const part of parts || []) {
          const pid = part.parent_manifest_item_id as string;
          if (!partsMap[pid]) partsMap[pid] = { extracted: 0, total: 0 };
          partsMap[pid].total++;
          if (part.extraction_status === 'completed' || part.extraction_status === 'failed') {
            partsMap[pid].extracted++;
          }
        }
      }

      const result = (books || []).map((b: Record<string, unknown>) => ({
        ...b,
        clone_count: cloneCounts[b.id as string] || 0,
        is_auto_cloned: !!b.source_manifest_item_id,
        original_uploader: b.source_manifest_item_id ? uploaderMap[b.source_manifest_item_id as string] || null : null,
        part_extraction: partsMap[b.id as string] || null,
      }));

      return jsonResponse({ books: result });
    }

    // ── PUSH ALL ── (bulk push all extracted books to all users)
    if (action === 'push_all') {
      // Get all admin's books that have extraction data
      const { data: adminBooks } = await supabase
        .from('manifest_items')
        .select('id, title, extraction_status, part_count')
        .eq('user_id', callerUserId)
        .is('archived_at', null)
        .is('parent_manifest_item_id', null);

      if (!adminBooks || adminBooks.length === 0) {
        return jsonResponse({ message: 'No books to push', pushed: 0 });
      }

      // Filter to books with extractions (single or multi-part)
      const booksWithExtractions: string[] = [];

      for (const book of adminBooks) {
        if (book.extraction_status === 'completed') {
          booksWithExtractions.push(book.id);
          continue;
        }

        // Check multi-part: if any child part has extractions
        if (book.part_count && book.part_count > 0) {
          const { data: parts } = await supabase
            .from('manifest_items')
            .select('id, extraction_status')
            .eq('parent_manifest_item_id', book.id)
            .eq('user_id', callerUserId);

          const hasExtracted = parts?.some((p: Record<string, unknown>) =>
            p.extraction_status === 'completed' || p.extraction_status === 'failed'
          );
          if (hasExtracted) {
            booksWithExtractions.push(book.id);
          }
          continue;
        }

        // Check if any extraction tables have data for this book
        const { count } = await supabase
          .from('manifest_summaries')
          .select('id', { count: 'exact', head: true })
          .eq('manifest_item_id', book.id)
          .eq('user_id', callerUserId);

        if (count && count > 0) {
          booksWithExtractions.push(book.id);
        }
      }

      if (booksWithExtractions.length === 0) {
        return jsonResponse({ message: 'No books with extractions to push', pushed: 0 });
      }

      let pushed = 0;
      const errors: string[] = [];

      for (const bookId of booksWithExtractions) {
        try {
          const cloneRes = await fetch(
            `${supabaseUrl}/functions/v1/manifest-clone`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: JSON.stringify({
                manifest_item_id: bookId,
                clone_extractions: true,
                force_update: true,
              }),
            },
          );

          if (!cloneRes.ok) {
            const errText = await cloneRes.text();
            errors.push(`${bookId}: ${cloneRes.status} ${errText}`);
          } else {
            pushed++;
          }
        } catch (err) {
          errors.push(`${bookId}: ${(err as Error).message}`);
        }
      }

      return jsonResponse({
        message: `Pushed ${pushed} of ${booksWithExtractions.length} books`,
        pushed,
        total: booksWithExtractions.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ── CLEANUP DUPLICATES ── (remove duplicate clone records + orphan clones with no extractions)
    if (action === 'cleanup_duplicates') {
      let duplicatesRemoved = 0;
      let orphansRemoved = 0;

      // 1. Find all clone records (items with source_manifest_item_id set)
      const { data: allClones } = await supabase
        .from('manifest_items')
        .select('id, user_id, source_manifest_item_id, created_at')
        .not('source_manifest_item_id', 'is', null)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      if (allClones && allClones.length > 0) {
        // Group by user_id + source_manifest_item_id to find duplicates
        const groups = new Map<string, Array<{ id: string; created_at: string }>>();
        for (const clone of allClones) {
          const key = `${clone.user_id}::${clone.source_manifest_item_id}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push({ id: clone.id, created_at: clone.created_at });
        }

        // For each group with >1 entry, keep the oldest, delete the rest
        const dupeIds: string[] = [];
        for (const [, items] of groups) {
          if (items.length > 1) {
            // Keep first (oldest), remove rest
            for (let i = 1; i < items.length; i++) {
              dupeIds.push(items[i].id);
            }
          }
        }

        if (dupeIds.length > 0) {
          // Delete extraction data for duplicate items
          await Promise.all([
            supabase.from('manifest_summaries').delete().in('manifest_item_id', dupeIds),
            supabase.from('manifest_declarations').delete().in('manifest_item_id', dupeIds),
            supabase.from('manifest_action_steps').delete().in('manifest_item_id', dupeIds),
            supabase.from('manifest_chunks').delete().in('manifest_item_id', dupeIds),
          ]);

          const { data: dupeFws } = await supabase
            .from('ai_frameworks')
            .select('id')
            .in('manifest_item_id', dupeIds);

          if (dupeFws && dupeFws.length > 0) {
            const fwIds = dupeFws.map((f: { id: string }) => f.id);
            await supabase.from('ai_framework_principles').delete().in('framework_id', fwIds);
            await supabase.from('ai_frameworks').delete().in('id', fwIds);
          }

          // Delete child parts of duplicate parent items
          const { data: dupeChildren } = await supabase
            .from('manifest_items')
            .select('id')
            .in('parent_manifest_item_id', dupeIds);

          if (dupeChildren && dupeChildren.length > 0) {
            const childIds = dupeChildren.map((c: { id: string }) => c.id);
            await Promise.all([
              supabase.from('manifest_summaries').delete().in('manifest_item_id', childIds),
              supabase.from('manifest_declarations').delete().in('manifest_item_id', childIds),
              supabase.from('manifest_action_steps').delete().in('manifest_item_id', childIds),
              supabase.from('manifest_chunks').delete().in('manifest_item_id', childIds),
            ]);
            await supabase.from('manifest_items').delete().in('id', childIds);
          }

          await supabase.from('manifest_items').delete().in('id', dupeIds);
          duplicatesRemoved = dupeIds.length;
        }
      }

      // 2. Remove orphan clones — clones of books with no extractions (not admin's own)
      const { data: cloneItems } = await supabase
        .from('manifest_items')
        .select('id, source_manifest_item_id, user_id')
        .not('source_manifest_item_id', 'is', null)
        .neq('user_id', callerUserId)
        .is('archived_at', null)
        .is('parent_manifest_item_id', null);

      if (cloneItems && cloneItems.length > 0) {
        // Get unique source IDs
        const sourceIds = [...new Set(cloneItems.map((c: Record<string, unknown>) => c.source_manifest_item_id as string))];

        // Check which sources have extractions
        const sourcesWithExtractions = new Set<string>();
        for (const srcId of sourceIds) {
          const { count } = await supabase
            .from('manifest_summaries')
            .select('id', { count: 'exact', head: true })
            .eq('manifest_item_id', srcId);
          if (count && count > 0) { sourcesWithExtractions.add(srcId); continue; }

          const { count: fwCount } = await supabase
            .from('ai_frameworks')
            .select('id', { count: 'exact', head: true })
            .eq('manifest_item_id', srcId)
            .is('archived_at', null);
          if (fwCount && fwCount > 0) { sourcesWithExtractions.add(srcId); continue; }

          // Also check if admin's clone of this source has extractions
          const { data: adminClone } = await supabase
            .from('manifest_items')
            .select('id')
            .eq('user_id', callerUserId)
            .or(`id.eq.${srcId},source_manifest_item_id.eq.${srcId}`)
            .is('archived_at', null)
            .limit(1);

          if (adminClone && adminClone.length > 0) {
            const adminItemId = adminClone[0].id;
            const { count: adminSumCount } = await supabase
              .from('manifest_summaries')
              .select('id', { count: 'exact', head: true })
              .eq('manifest_item_id', adminItemId);
            if (adminSumCount && adminSumCount > 0) { sourcesWithExtractions.add(srcId); continue; }

            const { count: adminFwCount } = await supabase
              .from('ai_frameworks')
              .select('id', { count: 'exact', head: true })
              .eq('manifest_item_id', adminItemId)
              .is('archived_at', null);
            if (adminFwCount && adminFwCount > 0) { sourcesWithExtractions.add(srcId); continue; }
          }
        }

        // Remove clones whose source has no extractions
        const orphanIds = cloneItems
          .filter((c: Record<string, unknown>) => !sourcesWithExtractions.has(c.source_manifest_item_id as string))
          .map((c: Record<string, unknown>) => c.id as string);

        if (orphanIds.length > 0) {
          // Clean up child parts first
          const { data: orphanChildren } = await supabase
            .from('manifest_items')
            .select('id')
            .in('parent_manifest_item_id', orphanIds);

          if (orphanChildren && orphanChildren.length > 0) {
            const childIds = orphanChildren.map((c: { id: string }) => c.id);
            await Promise.all([
              supabase.from('manifest_chunks').delete().in('manifest_item_id', childIds),
            ]);
            await supabase.from('manifest_items').delete().in('id', childIds);
          }

          await Promise.all([
            supabase.from('manifest_chunks').delete().in('manifest_item_id', orphanIds),
          ]);
          await supabase.from('manifest_items').delete().in('id', orphanIds);
          orphansRemoved = orphanIds.length;
        }
      }

      return jsonResponse({
        message: `Cleanup complete: ${duplicatesRemoved} duplicates removed, ${orphansRemoved} orphan clones removed`,
        duplicates_removed: duplicatesRemoved,
        orphans_removed: orphansRemoved,
      });
    }

    // All remaining actions require manifest_item_id
    if (!manifest_item_id) {
      return jsonResponse({ error: 'Missing manifest_item_id' }, 400);
    }

    // ── REMOVE CLONES ── (delete clones from other users, keep original)
    if (action === 'remove_clones') {
      const { data: clones } = await supabase
        .from('manifest_items')
        .select('id, user_id')
        .eq('source_manifest_item_id', manifest_item_id);

      if (!clones || clones.length === 0) {
        return jsonResponse({ message: 'No clones found', removed: 0 });
      }

      const cloneIds = clones.map((c: { id: string }) => c.id);

      // Delete extraction data for all clones
      await Promise.all([
        supabase.from('manifest_summaries').delete().in('manifest_item_id', cloneIds),
        supabase.from('manifest_declarations').delete().in('manifest_item_id', cloneIds),
        supabase.from('manifest_action_steps').delete().in('manifest_item_id', cloneIds),
        supabase.from('manifest_chunks').delete().in('manifest_item_id', cloneIds),
      ]);

      // Delete framework principles then frameworks
      const { data: cloneFws } = await supabase
        .from('ai_frameworks')
        .select('id')
        .in('manifest_item_id', cloneIds);

      if (cloneFws && cloneFws.length > 0) {
        const fwIds = cloneFws.map((f: { id: string }) => f.id);
        await supabase.from('ai_framework_principles').delete().in('framework_id', fwIds);
        await supabase.from('ai_frameworks').delete().in('id', fwIds);
      }

      // Delete the clone items themselves
      await supabase.from('manifest_items').delete().in('id', cloneIds);

      return jsonResponse({ message: 'Clones removed', removed: cloneIds.length });
    }

    // ── REMOVE BOOK ── (delete original + all clones + all extraction data)
    if (action === 'remove_book') {
      // Get all related items (original + clones)
      const { data: allItems } = await supabase
        .from('manifest_items')
        .select('id')
        .or(`id.eq.${manifest_item_id},source_manifest_item_id.eq.${manifest_item_id}`);

      const allIds = (allItems || []).map((i: { id: string }) => i.id);
      if (allIds.length === 0) {
        return jsonResponse({ error: 'Book not found' }, 404);
      }

      // Delete all extraction data
      await Promise.all([
        supabase.from('manifest_summaries').delete().in('manifest_item_id', allIds),
        supabase.from('manifest_declarations').delete().in('manifest_item_id', allIds),
        supabase.from('manifest_action_steps').delete().in('manifest_item_id', allIds),
        supabase.from('manifest_chunks').delete().in('manifest_item_id', allIds),
      ]);

      // Delete frameworks
      const { data: allFws } = await supabase
        .from('ai_frameworks')
        .select('id')
        .in('manifest_item_id', allIds);

      if (allFws && allFws.length > 0) {
        const fwIds = allFws.map((f: { id: string }) => f.id);
        await supabase.from('ai_framework_principles').delete().in('framework_id', fwIds);
        await supabase.from('ai_frameworks').delete().in('id', fwIds);
      }

      // Delete all items
      await supabase.from('manifest_items').delete().in('id', allIds);

      return jsonResponse({ message: 'Book removed everywhere', removed: allIds.length });
    }

    // ── REPUSH ── (re-clone book + extractions to all users with force_update)
    if (action === 'repush') {
      // Invoke manifest-clone with force_update, forwarding the caller's JWT
      const cloneRes = await fetch(
        `${supabaseUrl}/functions/v1/manifest-clone`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            manifest_item_id,
            clone_extractions: true,
            force_update: true,
          }),
        },
      );

      if (!cloneRes.ok) {
        const errText = await cloneRes.text();
        console.error(`[admin] repush manifest-clone call failed: ${cloneRes.status} ${errText}`);
        return jsonResponse({ error: `Repush failed: ${cloneRes.status} ${errText}` }, 500);
      }

      const cloneData = await cloneRes.json();
      return jsonResponse({ message: 'Repush complete', ...cloneData });
    }

    // ── CLEAR EXTRACTIONS ── (clear extractions for one book, own copy only)
    if (action === 'clear_extractions') {
      // Delete extraction data for this specific item owned by the caller
      await Promise.all([
        supabase.from('manifest_summaries').delete()
          .eq('manifest_item_id', manifest_item_id).eq('user_id', callerUserId),
        supabase.from('manifest_declarations').delete()
          .eq('manifest_item_id', manifest_item_id).eq('user_id', callerUserId),
        supabase.from('manifest_action_steps').delete()
          .eq('manifest_item_id', manifest_item_id).eq('user_id', callerUserId),
      ]);

      // Delete frameworks for this item
      const { data: fws } = await supabase
        .from('ai_frameworks')
        .select('id')
        .eq('manifest_item_id', manifest_item_id)
        .eq('user_id', callerUserId);

      if (fws && fws.length > 0) {
        const fwIds = fws.map((f: { id: string }) => f.id);
        await supabase.from('ai_framework_principles').delete().in('framework_id', fwIds);
        await supabase.from('ai_frameworks').delete().in('id', fwIds);
      }

      // Reset extraction_status
      await supabase
        .from('manifest_items')
        .update({ extraction_status: 'none' })
        .eq('id', manifest_item_id)
        .eq('user_id', callerUserId);

      return jsonResponse({ message: 'Extractions cleared' });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('[manifest-admin] Error:', err);
    return jsonResponse({ error: `Admin action failed: ${(err as Error).message}` }, 500);
  }
});

// --- Sync extraction data from source item to target item (curation-aware merge) ---

async function syncExtractionsToTarget(
  supabase: ReturnType<typeof createClient>,
  sourceItemId: string,
  sourceUserId: string,
  targetItemId: string,
  targetUserId: string,
): Promise<boolean> {
  try {
    // Fetch source extraction data
    const [summariesRes, frameworksRes, declarationsRes, actionStepsRes] = await Promise.all([
      supabase
        .from('manifest_summaries')
        .select('*')
        .eq('manifest_item_id', sourceItemId)
        .eq('user_id', sourceUserId)
        .eq('is_deleted', false),
      supabase
        .from('ai_frameworks')
        .select('*, ai_framework_principles(*)')
        .eq('manifest_item_id', sourceItemId)
        .eq('user_id', sourceUserId)
        .is('archived_at', null),
      supabase
        .from('manifest_declarations')
        .select('*')
        .eq('manifest_item_id', sourceItemId)
        .eq('user_id', sourceUserId)
        .eq('is_deleted', false),
      supabase
        .from('manifest_action_steps')
        .select('*')
        .eq('manifest_item_id', sourceItemId)
        .eq('user_id', sourceUserId)
        .eq('is_deleted', false),
    ]);

    const sourceSummaries = summariesRes.data || [];
    const sourceFrameworks = frameworksRes.data || [];
    const sourceDeclarations = declarationsRes.data || [];
    const sourceActionSteps = actionStepsRes.data || [];

    // Nothing to sync
    if (sourceSummaries.length === 0 && sourceFrameworks.length === 0 &&
        sourceDeclarations.length === 0 && sourceActionSteps.length === 0) {
      return false;
    }

    // Check if target already has extractions
    const { data: existingSummaries } = await supabase
      .from('manifest_summaries')
      .select('id')
      .eq('manifest_item_id', targetItemId)
      .eq('user_id', targetUserId)
      .limit(1);

    const hasExisting = existingSummaries && existingSummaries.length > 0;

    if (hasExisting) {
      // --- Curation-aware merge: preserve hearted/noted items ---

      // Summaries merge
      const { data: targetSummaries } = await supabase
        .from('manifest_summaries')
        .select('id, text, section_title, section_index, is_hearted, is_deleted, user_note')
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId);

      const preservedSummaryKeys = new Set(
        (targetSummaries || [])
          .filter((s: Record<string, unknown>) => s.is_hearted || s.user_note)
          .map((s: Record<string, unknown>) => `${s.text}||${s.section_title}||${s.section_index}`),
      );

      // Delete neutral items (not hearted, no user_note, not deleted)
      await supabase
        .from('manifest_summaries')
        .delete()
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId)
        .eq('is_hearted', false)
        .eq('is_deleted', false)
        .is('user_note', null);

      const newSummaries = sourceSummaries
        .filter((s: Record<string, unknown>) =>
          !preservedSummaryKeys.has(`${s.text}||${s.section_title}||${s.section_index}`),
        )
        .map((s: Record<string, unknown>) => ({
          user_id: targetUserId,
          manifest_item_id: targetItemId,
          section_title: s.section_title,
          section_index: s.section_index,
          content_type: s.content_type,
          text: s.text,
          sort_order: s.sort_order,
          is_hearted: false,
          is_deleted: false,
          is_from_go_deeper: s.is_from_go_deeper || false,
        }));

      if (newSummaries.length > 0) {
        await supabase.from('manifest_summaries').insert(newSummaries);
      }

      // Declarations merge
      const { data: targetDeclarations } = await supabase
        .from('manifest_declarations')
        .select('id, declaration_text, section_title, section_index, is_hearted, is_deleted, sent_to_mast, user_note')
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId);

      const preservedDeclKeys = new Set(
        (targetDeclarations || [])
          .filter((d: Record<string, unknown>) => d.is_hearted || d.sent_to_mast || d.user_note)
          .map((d: Record<string, unknown>) => `${d.declaration_text}||${d.section_title}||${d.section_index}`),
      );

      await supabase
        .from('manifest_declarations')
        .delete()
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId)
        .eq('is_hearted', false)
        .eq('is_deleted', false)
        .eq('sent_to_mast', false)
        .is('user_note', null);

      const newDeclarations = sourceDeclarations
        .filter((d: Record<string, unknown>) =>
          !preservedDeclKeys.has(`${d.declaration_text}||${d.section_title}||${d.section_index}`),
        )
        .map((d: Record<string, unknown>) => ({
          user_id: targetUserId,
          manifest_item_id: targetItemId,
          section_title: d.section_title,
          section_index: d.section_index,
          value_name: d.value_name,
          declaration_text: d.declaration_text,
          declaration_style: d.declaration_style,
          sort_order: d.sort_order,
          is_hearted: false,
          is_deleted: false,
          is_from_go_deeper: d.is_from_go_deeper || false,
          sent_to_mast: false,
        }));

      if (newDeclarations.length > 0) {
        await supabase.from('manifest_declarations').insert(newDeclarations);
      }

      // Frameworks merge
      const { data: targetFw } = await supabase
        .from('ai_frameworks')
        .select('id, is_active')
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId)
        .is('archived_at', null)
        .maybeSingle();

      for (const fw of sourceFrameworks) {
        const sourcePrinciples = (fw as Record<string, unknown>).ai_framework_principles as Array<Record<string, unknown>> || [];

        if (targetFw) {
          await supabase.from('ai_frameworks').update({ name: fw.name }).eq('id', targetFw.id);

          const { data: targetPrinciples } = await supabase
            .from('ai_framework_principles')
            .select('id, text, section_title, is_hearted, is_deleted, user_note')
            .eq('framework_id', targetFw.id)
            .eq('user_id', targetUserId);

          const preservedPrincipleKeys = new Set(
            (targetPrinciples || [])
              .filter((p: Record<string, unknown>) => p.is_hearted || p.user_note)
              .map((p: Record<string, unknown>) => `${p.text}||${p.section_title}`),
          );

          await supabase
            .from('ai_framework_principles')
            .delete()
            .eq('framework_id', targetFw.id)
            .eq('user_id', targetUserId)
            .eq('is_hearted', false)
            .eq('is_deleted', false)
            .is('user_note', null);

          const newPrinciples = sourcePrinciples
            .filter((p: Record<string, unknown>) =>
              !preservedPrincipleKeys.has(`${p.text}||${p.section_title}`),
            )
            .map((p: Record<string, unknown>) => ({
              user_id: targetUserId,
              framework_id: targetFw.id,
              text: p.text,
              sort_order: p.sort_order,
              section_title: p.section_title || null,
              is_hearted: false,
              is_deleted: false,
              is_from_go_deeper: p.is_from_go_deeper || false,
            }));

          if (newPrinciples.length > 0) {
            await supabase.from('ai_framework_principles').insert(newPrinciples);
          }
        } else {
          const { data: newFw } = await supabase
            .from('ai_frameworks')
            .insert({
              user_id: targetUserId,
              manifest_item_id: targetItemId,
              name: fw.name,
              is_active: true,
            })
            .select('id')
            .single();

          if (newFw && sourcePrinciples.length > 0) {
            const principleRecords = sourcePrinciples.map((p: Record<string, unknown>) => ({
              user_id: targetUserId,
              framework_id: newFw.id,
              text: p.text,
              sort_order: p.sort_order,
              section_title: p.section_title || null,
              is_hearted: false,
              is_deleted: false,
              is_from_go_deeper: p.is_from_go_deeper || false,
            }));
            await supabase.from('ai_framework_principles').insert(principleRecords);
          }
        }
      }

      // Action steps merge
      const { data: targetActionSteps } = await supabase
        .from('manifest_action_steps')
        .select('id, text, section_title, section_index, is_hearted, is_deleted, sent_to_compass, user_note')
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId);

      const preservedActionKeys = new Set(
        (targetActionSteps || [])
          .filter((a: Record<string, unknown>) => a.is_hearted || a.sent_to_compass || a.user_note)
          .map((a: Record<string, unknown>) => `${a.text}||${a.section_title}||${a.section_index}`),
      );

      await supabase
        .from('manifest_action_steps')
        .delete()
        .eq('manifest_item_id', targetItemId)
        .eq('user_id', targetUserId)
        .eq('is_hearted', false)
        .eq('is_deleted', false)
        .eq('sent_to_compass', false)
        .is('user_note', null);

      const newActionSteps = sourceActionSteps
        .filter((a: Record<string, unknown>) =>
          !preservedActionKeys.has(`${a.text}||${a.section_title}||${a.section_index}`),
        )
        .map((a: Record<string, unknown>) => ({
          user_id: targetUserId,
          manifest_item_id: targetItemId,
          section_title: a.section_title,
          section_index: a.section_index,
          content_type: a.content_type,
          text: a.text,
          sort_order: a.sort_order,
          is_hearted: false,
          is_deleted: false,
          is_from_go_deeper: a.is_from_go_deeper || false,
          sent_to_compass: false,
        }));

      if (newActionSteps.length > 0) {
        await supabase.from('manifest_action_steps').insert(newActionSteps);
      }
    } else {
      // Fresh clone — no existing extractions
      if (sourceSummaries.length > 0) {
        await supabase.from('manifest_summaries').insert(
          sourceSummaries.map((s: Record<string, unknown>) => ({
            user_id: targetUserId,
            manifest_item_id: targetItemId,
            section_title: s.section_title,
            section_index: s.section_index,
            content_type: s.content_type,
            text: s.text,
            sort_order: s.sort_order,
            is_from_go_deeper: s.is_from_go_deeper || false,
          })),
        );
      }

      for (const fw of sourceFrameworks) {
        const principles = (fw as Record<string, unknown>).ai_framework_principles as Array<Record<string, unknown>> || [];
        const { data: newFw } = await supabase
          .from('ai_frameworks')
          .insert({
            user_id: targetUserId,
            manifest_item_id: targetItemId,
            name: fw.name,
            is_active: true,
          })
          .select('id')
          .single();

        if (newFw && principles.length > 0) {
          await supabase.from('ai_framework_principles').insert(
            principles.map((p: Record<string, unknown>) => ({
              user_id: targetUserId,
              framework_id: newFw.id,
              text: p.text,
              sort_order: p.sort_order,
              section_title: p.section_title || null,
              is_from_go_deeper: p.is_from_go_deeper || false,
            })),
          );
        }
      }

      if (sourceDeclarations.length > 0) {
        await supabase.from('manifest_declarations').insert(
          sourceDeclarations.map((d: Record<string, unknown>) => ({
            user_id: targetUserId,
            manifest_item_id: targetItemId,
            section_title: d.section_title,
            section_index: d.section_index,
            value_name: d.value_name,
            declaration_text: d.declaration_text,
            declaration_style: d.declaration_style,
            sort_order: d.sort_order,
            is_from_go_deeper: d.is_from_go_deeper || false,
          })),
        );
      }

      if (sourceActionSteps.length > 0) {
        await supabase.from('manifest_action_steps').insert(
          sourceActionSteps.map((a: Record<string, unknown>) => ({
            user_id: targetUserId,
            manifest_item_id: targetItemId,
            section_title: a.section_title,
            section_index: a.section_index,
            content_type: a.content_type,
            text: a.text,
            sort_order: a.sort_order,
            is_from_go_deeper: a.is_from_go_deeper || false,
          })),
        );
      }
    }

    console.log(`[manifest-admin] Synced extractions from ${sourceItemId} to ${targetItemId}`);
    return true;
  } catch (err) {
    console.error('[manifest-admin] syncExtractionsToTarget error:', err);
    return false;
  }
}
