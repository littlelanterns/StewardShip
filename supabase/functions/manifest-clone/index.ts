import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// --- Helper: clone extractions from one item to a target user's cloned item ---
async function cloneExtractionsForItem(
  supabase: SupabaseClient,
  sourceItemId: string,
  sourceUserId: string,
  targetUserId: string,
  clonedItemId: string,
  forceUpdate: boolean,
): Promise<boolean> {
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

  // deno-lint-ignore no-explicit-any
  const sourceSummaries = (summariesRes.data || []) as Record<string, any>[];
  // deno-lint-ignore no-explicit-any
  const sourceFrameworks = (frameworksRes.data || []) as Record<string, any>[];
  // deno-lint-ignore no-explicit-any
  const sourceDeclarations = (declarationsRes.data || []) as Record<string, any>[];
  // deno-lint-ignore no-explicit-any
  const sourceActionSteps = (actionStepsRes.data || []) as Record<string, any>[];

  const hasExtractions = sourceSummaries.length > 0 || sourceFrameworks.length > 0 ||
    sourceDeclarations.length > 0 || sourceActionSteps.length > 0;

  if (!hasExtractions) return false;

  // Check if target already has extractions
  const { data: existingSummaries } = await supabase
    .from('manifest_summaries')
    .select('id')
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId)
    .limit(1);

  if (existingSummaries && existingSummaries.length > 0) {
    if (!forceUpdate) {
      console.log(`[manifest-clone] User ${targetUserId} already has extractions for ${clonedItemId}, skipping`);
      return false;
    }
    // Curation-aware merge
    await mergeExtractions(supabase, targetUserId, clonedItemId, sourceSummaries, sourceFrameworks, sourceDeclarations, sourceActionSteps);
  } else {
    // Fresh clone
    await freshCloneExtractions(supabase, targetUserId, clonedItemId, sourceSummaries, sourceFrameworks, sourceDeclarations, sourceActionSteps);
  }

  return true;
}

// --- Helper: fresh clone extractions (no existing data) ---
async function freshCloneExtractions(
  supabase: SupabaseClient,
  targetUserId: string,
  clonedItemId: string,
  // deno-lint-ignore no-explicit-any
  sourceSummaries: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceFrameworks: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceDeclarations: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceActionSteps: Record<string, any>[],
) {
  // Clone summaries
  if (sourceSummaries.length > 0) {
    const records = sourceSummaries.map((s) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
      section_title: s.section_title,
      section_index: s.section_index,
      content_type: s.content_type,
      text: s.text,
      sort_order: s.sort_order,
      is_hearted: false,
      is_deleted: false,
      is_from_go_deeper: s.is_from_go_deeper || false,
    }));
    await supabase.from('manifest_summaries').insert(records);
  }

  // Clone frameworks + principles
  for (const fw of sourceFrameworks) {
    const principles = (fw.ai_framework_principles || []) as Array<Record<string, unknown>>;

    const { data: newFw } = await supabase
      .from('ai_frameworks')
      .insert({
        user_id: targetUserId,
        manifest_item_id: clonedItemId,
        name: fw.name,
        is_active: true,
      })
      .select('id')
      .single();

    if (newFw && principles.length > 0) {
      const principleRecords = principles.map((p) => ({
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

  // Clone declarations
  if (sourceDeclarations.length > 0) {
    const records = sourceDeclarations.map((d) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
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
    await supabase.from('manifest_declarations').insert(records);
  }

  // Clone action steps
  if (sourceActionSteps.length > 0) {
    const records = sourceActionSteps.map((a) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
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
    await supabase.from('manifest_action_steps').insert(records);
  }
}

// --- Helper: curation-aware merge of extractions ---
async function mergeExtractions(
  supabase: SupabaseClient,
  targetUserId: string,
  clonedItemId: string,
  // deno-lint-ignore no-explicit-any
  sourceSummaries: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceFrameworks: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceDeclarations: Record<string, any>[],
  // deno-lint-ignore no-explicit-any
  sourceActionSteps: Record<string, any>[],
) {
  console.log(`[manifest-clone] Curation-aware merge for user ${targetUserId}, item ${clonedItemId}`);

  // --- Summaries merge ---
  const { data: targetSummaries } = await supabase
    .from('manifest_summaries')
    .select('id, text, section_title, section_index, is_hearted, is_deleted, user_note')
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId);

  const preservedSummaryKeys = new Set(
    (targetSummaries || [])
      .filter((s: Record<string, unknown>) => s.is_hearted || s.user_note)
      .map((s: Record<string, unknown>) => `${s.text}||${s.section_title}||${s.section_index}`),
  );

  // Delete neutral items
  await supabase
    .from('manifest_summaries')
    .delete()
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId)
    .eq('is_hearted', false)
    .eq('is_deleted', false)
    .is('user_note', null);

  // Insert non-duplicate source summaries
  const newSummaries = sourceSummaries
    .filter((s) => !preservedSummaryKeys.has(`${s.text}||${s.section_title}||${s.section_index}`))
    .map((s) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
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

  // --- Declarations merge ---
  const { data: targetDeclarations } = await supabase
    .from('manifest_declarations')
    .select('id, declaration_text, section_title, section_index, is_hearted, is_deleted, sent_to_mast, user_note')
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId);

  const preservedDeclKeys = new Set(
    (targetDeclarations || [])
      .filter((d: Record<string, unknown>) => d.is_hearted || d.sent_to_mast || d.user_note)
      .map((d: Record<string, unknown>) => `${d.declaration_text}||${d.section_title}||${d.section_index}`),
  );

  await supabase
    .from('manifest_declarations')
    .delete()
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId)
    .eq('is_hearted', false)
    .eq('is_deleted', false)
    .eq('sent_to_mast', false)
    .is('user_note', null);

  const newDeclarations = sourceDeclarations
    .filter((d) => !preservedDeclKeys.has(`${d.declaration_text}||${d.section_title}||${d.section_index}`))
    .map((d) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
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

  // --- Frameworks merge ---
  const { data: targetFw } = await supabase
    .from('ai_frameworks')
    .select('id, is_active')
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId)
    .is('archived_at', null)
    .maybeSingle();

  for (const fw of sourceFrameworks) {
    const sourcePrinciples = (fw.ai_framework_principles || []) as Array<Record<string, unknown>>;

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

      // Delete neutral principles (also check user_note is null)
      await supabase
        .from('ai_framework_principles')
        .delete()
        .eq('framework_id', targetFw.id)
        .eq('user_id', targetUserId)
        .eq('is_hearted', false)
        .eq('is_deleted', false)
        .is('user_note', null);

      const newPrinciples = sourcePrinciples
        .filter((p) => !preservedPrincipleKeys.has(`${p.text}||${p.section_title}`))
        .map((p) => ({
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
          manifest_item_id: clonedItemId,
          name: fw.name,
          is_active: true,
        })
        .select('id')
        .single();

      if (newFw && sourcePrinciples.length > 0) {
        const principleRecords = sourcePrinciples.map((p) => ({
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

  // --- Action Steps merge ---
  const { data: targetActionSteps } = await supabase
    .from('manifest_action_steps')
    .select('id, text, section_title, section_index, is_hearted, is_deleted, sent_to_compass, user_note')
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId);

  const preservedActionStepKeys = new Set(
    (targetActionSteps || [])
      .filter((a: Record<string, unknown>) => a.is_hearted || a.sent_to_compass || a.user_note)
      .map((a: Record<string, unknown>) => `${a.text}||${a.section_title}||${a.section_index}`),
  );

  await supabase
    .from('manifest_action_steps')
    .delete()
    .eq('manifest_item_id', clonedItemId)
    .eq('user_id', targetUserId)
    .eq('is_hearted', false)
    .eq('is_deleted', false)
    .eq('sent_to_compass', false)
    .is('user_note', null);

  const newActionSteps = sourceActionSteps
    .filter((a) => !preservedActionStepKeys.has(`${a.text}||${a.section_title}||${a.section_index}`))
    .map((a) => ({
      user_id: targetUserId,
      manifest_item_id: clonedItemId,
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
}

// --- Helper: clone a single item to target users, returns map of userId → clonedItemId ---
async function cloneItemToUsers(
  supabase: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  originalItem: Record<string, any>,
  sourceId: string,
  sourceUserId: string,
  targetUserIds: string[],
  parentCloneMap?: Map<string, string>, // userId → cloned parent ID (for child parts)
): Promise<{ clonedItemMap: Map<string, string>; newCount: number }> {
  const clonedItemMap = new Map<string, string>();

  // Check which users already have a clone of this item
  const { data: existingClones } = await supabase
    .from('manifest_items')
    .select('id, user_id')
    .eq('source_manifest_item_id', sourceId);

  const existingUserIds = new Set((existingClones || []).map((c: { user_id: string }) => c.user_id));
  const newTargetIds = targetUserIds.filter((uid) => !existingUserIds.has(uid));

  // Create cloned items for new users
  if (newTargetIds.length > 0) {
    const itemRecords = newTargetIds.map((uid) => ({
      user_id: uid,
      title: originalItem.title,
      file_type: originalItem.file_type,
      file_name: originalItem.file_name,
      storage_path: originalItem.storage_path,
      text_content: originalItem.text_content,
      file_size_bytes: originalItem.file_size_bytes,
      tags: originalItem.tags || [],
      folder_group: originalItem.folder_group || 'uncategorized',
      genres: originalItem.genres || [],
      ai_summary: originalItem.ai_summary,
      toc: originalItem.toc,
      chunk_count: originalItem.chunk_count || 0,
      processing_status: 'completed',
      extraction_status: originalItem.extraction_status || 'none',
      intake_completed: true,
      source_manifest_item_id: sourceId,
      part_number: originalItem.part_number || null,
      part_count: originalItem.part_count || null,
      parent_manifest_item_id: parentCloneMap?.get(uid) || null,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('manifest_items')
      .insert(itemRecords)
      .select('id, user_id');

    if (insertErr) {
      console.error('[manifest-clone] Failed to insert cloned items:', insertErr);
      throw new Error(`Clone failed: ${insertErr.message}`);
    }

    for (const item of inserted || []) {
      clonedItemMap.set(item.user_id, item.id);
    }
  }

  // Fetch existing clone IDs for users who already had them
  for (const clone of existingClones || []) {
    if (!clonedItemMap.has(clone.user_id)) {
      clonedItemMap.set(clone.user_id, clone.id);
    }
  }

  return { clonedItemMap, newCount: newTargetIds.length };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const jwt = authHeader.replace('Bearer ', '');
    const payloadB64 = jwt.split('.')[1];
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const jwtPayload = JSON.parse(atob(b64));
    const callerUserId = jwtPayload.sub as string;
    if (!callerUserId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { manifest_item_id, clone_extractions, force_update } = await req.json();

    if (!manifest_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing manifest_item_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Fetch the source manifest item
    const { data: source, error: fetchErr } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('id', manifest_item_id)
      .single();

    if (fetchErr || !source) {
      return new Response(
        JSON.stringify({ error: 'Source manifest item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Don't clone a clone — use the original source
    const sourceId = source.source_manifest_item_id || source.id;
    const sourceUserId = source.user_id;

    // If this is itself a clone, fetch the original for data
    let originalItem = source;
    if (source.source_manifest_item_id) {
      const { data: orig } = await supabase
        .from('manifest_items')
        .select('*')
        .eq('id', source.source_manifest_item_id)
        .single();
      if (orig) originalItem = orig;
    }

    // 2. Get all users except the source item's owner
    const { data: allUsers, error: usersErr } = await supabase
      .from('user_profiles')
      .select('user_id');

    if (usersErr || !allUsers) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const targetUserIds = allUsers
      .map((u: { user_id: string }) => u.user_id)
      .filter((uid: string) => uid !== sourceUserId);

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No other users to clone to', cloned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Clone the main/parent item to all target users
    const { clonedItemMap, newCount } = await cloneItemToUsers(
      supabase, originalItem, sourceId, sourceUserId, targetUserIds,
    );

    console.log(`[manifest-clone] Cloned parent item to ${newCount} new users (${clonedItemMap.size} total)`);

    // 4. Handle multi-part books: clone child parts too
    let childrenCloned = 0;
    const { data: childParts } = await supabase
      .from('manifest_items')
      .select('*')
      .eq('parent_manifest_item_id', sourceId)
      .eq('user_id', sourceUserId)
      .order('part_number');

    if (childParts && childParts.length > 0) {
      console.log(`[manifest-clone] Found ${childParts.length} child parts to clone`);

      for (const child of childParts) {
        try {
          const { newCount: childNew } = await cloneItemToUsers(
            supabase, child, child.id, sourceUserId, targetUserIds, clonedItemMap,
          );
          childrenCloned += childNew;
        } catch (err) {
          console.error(`[manifest-clone] Failed to clone child part ${child.id}:`, err);
        }
      }
    }

    // 5. Clone extractions if requested
    let extractionsCopied = 0;
    if (clone_extractions) {
      // Clone extractions for the main item
      if (originalItem.extraction_status === 'completed') {
        for (const [targetUserId, clonedItemId] of clonedItemMap.entries()) {
          if (targetUserId === sourceUserId) continue;
          try {
            const copied = await cloneExtractionsForItem(
              supabase, sourceId, sourceUserId, targetUserId, clonedItemId, !!force_update,
            );
            if (copied) {
              await supabase
                .from('manifest_items')
                .update({
                  extraction_status: 'completed',
                  genres: originalItem.genres || [],
                  ai_summary: originalItem.ai_summary,
                  toc: originalItem.toc,
                })
                .eq('id', clonedItemId);
              extractionsCopied++;
            }
          } catch (err) {
            console.error(`[manifest-clone] Failed to clone extractions for user ${targetUserId}:`, err);
          }
        }
      }

      // Clone extractions for child parts
      if (childParts && childParts.length > 0) {
        for (const child of childParts) {
          if (child.extraction_status !== 'completed') continue;

          // Get each user's clone of this child
          const { data: childClones } = await supabase
            .from('manifest_items')
            .select('id, user_id')
            .eq('source_manifest_item_id', child.id);

          for (const childClone of childClones || []) {
            if (childClone.user_id === sourceUserId) continue;
            try {
              const copied = await cloneExtractionsForItem(
                supabase, child.id, sourceUserId, childClone.user_id, childClone.id, !!force_update,
              );
              if (copied) {
                await supabase
                  .from('manifest_items')
                  .update({
                    extraction_status: 'completed',
                    genres: child.genres || [],
                    ai_summary: child.ai_summary,
                    toc: child.toc,
                  })
                  .eq('id', childClone.id);
              }
            } catch (err) {
              console.error(`[manifest-clone] Failed to clone child extractions for user ${childClone.user_id}:`, err);
            }
          }
        }
      }

      console.log(`[manifest-clone] Cloned extractions to ${extractionsCopied} users`);
    }

    return new Response(
      JSON.stringify({
        message: 'Clone complete',
        cloned_items: newCount,
        children_cloned: childrenCloned,
        extractions_copied: extractionsCopied,
        source_id: sourceId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[manifest-clone] Error:', err);
    return new Response(
      JSON.stringify({ error: `Clone failed: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
