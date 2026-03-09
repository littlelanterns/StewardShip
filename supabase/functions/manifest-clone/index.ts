import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 3. Check which users already have a clone of this item
    const { data: existingClones } = await supabase
      .from('manifest_items')
      .select('user_id')
      .eq('source_manifest_item_id', sourceId);

    const existingUserIds = new Set((existingClones || []).map((c: { user_id: string }) => c.user_id));

    // Filter to users who don't have a clone yet
    const newTargetIds = targetUserIds.filter((uid: string) => !existingUserIds.has(uid));

    // 4. Clone manifest_items for new users
    const clonedItemMap = new Map<string, string>(); // userId → clonedItemId

    if (newTargetIds.length > 0) {
      const itemRecords = newTargetIds.map((uid: string) => ({
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
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('manifest_items')
        .insert(itemRecords)
        .select('id, user_id');

      if (insertErr) {
        console.error('[manifest-clone] Failed to insert cloned items:', insertErr);
        return new Response(
          JSON.stringify({ error: `Clone failed: ${insertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      for (const item of inserted || []) {
        clonedItemMap.set(item.user_id, item.id);
      }

      console.log(`[manifest-clone] Cloned manifest_items to ${inserted?.length || 0} users`);
    }

    // For users who already had clones, fetch their cloned item IDs
    if (existingClones && existingClones.length > 0) {
      const { data: existingItems } = await supabase
        .from('manifest_items')
        .select('id, user_id')
        .eq('source_manifest_item_id', sourceId);

      for (const item of existingItems || []) {
        if (!clonedItemMap.has(item.user_id)) {
          clonedItemMap.set(item.user_id, item.id);
        }
      }
    }

    // 5. Clone extractions if requested
    let extractionsCopied = 0;
    if (clone_extractions && originalItem.extraction_status === 'completed') {
      // Fetch source extraction data
      const [summariesRes, frameworksRes, declarationsRes, actionStepsRes] = await Promise.all([
        supabase
          .from('manifest_summaries')
          .select('*')
          .eq('manifest_item_id', sourceId)
          .eq('user_id', sourceUserId)
          .eq('is_deleted', false),
        supabase
          .from('ai_frameworks')
          .select('*, ai_framework_principles(*)')
          .eq('manifest_item_id', sourceId)
          .eq('user_id', sourceUserId)
          .is('archived_at', null),
        supabase
          .from('manifest_declarations')
          .select('*')
          .eq('manifest_item_id', sourceId)
          .eq('user_id', sourceUserId)
          .eq('is_deleted', false),
        supabase
          .from('manifest_action_steps')
          .select('*')
          .eq('manifest_item_id', sourceId)
          .eq('user_id', sourceUserId)
          .eq('is_deleted', false),
      ]);

      const sourceSummaries = summariesRes.data || [];
      const sourceFrameworks = frameworksRes.data || [];
      const sourceDeclarations = declarationsRes.data || [];
      const sourceActionSteps = actionStepsRes.data || [];

      for (const [targetUserId, clonedItemId] of clonedItemMap.entries()) {
        if (targetUserId === sourceUserId) continue;

        try {
          // Check if this user already has extractions for this cloned item
          const { data: existingSummaries } = await supabase
            .from('manifest_summaries')
            .select('id')
            .eq('manifest_item_id', clonedItemId)
            .eq('user_id', targetUserId)
            .limit(1);

          if (existingSummaries && existingSummaries.length > 0) {
            if (!force_update) {
              console.log(`[manifest-clone] User ${targetUserId} already has extractions, skipping (no force_update)`);
              continue;
            }

            // --- Curation-aware merge ---
            console.log(`[manifest-clone] Force updating extractions for user ${targetUserId}`);

            // --- Summaries merge ---
            const { data: targetSummaries } = await supabase
              .from('manifest_summaries')
              .select('id, text, section_title, section_index, is_hearted, is_deleted')
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId);

            const heartedSummaries = (targetSummaries || []).filter((s: Record<string, unknown>) => s.is_hearted);
            const heartedSummaryKeys = new Set(
              heartedSummaries.map((s: Record<string, unknown>) => `${s.text}||${s.section_title}||${s.section_index}`),
            );

            // Delete neutral items (not hearted, not deleted)
            await supabase
              .from('manifest_summaries')
              .delete()
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId)
              .eq('is_hearted', false)
              .eq('is_deleted', false);

            // Insert source summaries that don't duplicate hearted items
            const newSummaries = sourceSummaries
              .filter((s: Record<string, unknown>) =>
                !heartedSummaryKeys.has(`${s.text}||${s.section_title}||${s.section_index}`),
              )
              .map((s: Record<string, unknown>) => ({
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
              .select('id, declaration_text, section_title, section_index, is_hearted, is_deleted, sent_to_mast, mast_entry_id')
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId);

            const heartedDeclarations = (targetDeclarations || []).filter((d: Record<string, unknown>) => d.is_hearted);
            const heartedDeclKeys = new Set(
              heartedDeclarations.map((d: Record<string, unknown>) => `${d.declaration_text}||${d.section_title}||${d.section_index}`),
            );

            // Delete neutral declarations
            await supabase
              .from('manifest_declarations')
              .delete()
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId)
              .eq('is_hearted', false)
              .eq('is_deleted', false);

            // Insert source declarations that don't duplicate hearted items
            const newDeclarations = sourceDeclarations
              .filter((d: Record<string, unknown>) =>
                !heartedDeclKeys.has(`${d.declaration_text}||${d.section_title}||${d.section_index}`),
              )
              .map((d: Record<string, unknown>) => ({
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
              const sourcePrinciples = (fw as Record<string, unknown>).ai_framework_principles as Array<Record<string, unknown>> || [];

              if (targetFw) {
                // Update framework name, preserve is_active
                await supabase
                  .from('ai_frameworks')
                  .update({ name: fw.name })
                  .eq('id', targetFw.id);

                // Get existing principles
                const { data: targetPrinciples } = await supabase
                  .from('ai_framework_principles')
                  .select('id, text, section_title, is_hearted, is_deleted')
                  .eq('framework_id', targetFw.id)
                  .eq('user_id', targetUserId);

                const heartedPrinciples = (targetPrinciples || []).filter((p: Record<string, unknown>) => p.is_hearted);
                const heartedPrincipleKeys = new Set(
                  heartedPrinciples.map((p: Record<string, unknown>) => `${p.text}||${p.section_title}`),
                );

                // Delete neutral principles
                await supabase
                  .from('ai_framework_principles')
                  .delete()
                  .eq('framework_id', targetFw.id)
                  .eq('user_id', targetUserId)
                  .eq('is_hearted', false)
                  .eq('is_deleted', false);

                // Insert non-duplicate source principles
                const newPrinciples = sourcePrinciples
                  .filter((p: Record<string, unknown>) =>
                    !heartedPrincipleKeys.has(`${p.text}||${p.section_title}`),
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
                // No existing framework — create fresh
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

            // --- Action Steps merge ---
            const { data: targetActionSteps } = await supabase
              .from('manifest_action_steps')
              .select('id, text, section_title, section_index, is_hearted, is_deleted')
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId);

            const heartedActionSteps = (targetActionSteps || []).filter((a: Record<string, unknown>) => a.is_hearted);
            const heartedActionStepKeys = new Set(
              heartedActionSteps.map((a: Record<string, unknown>) => `${a.text}||${a.section_title}||${a.section_index}`),
            );

            // Delete neutral action steps
            await supabase
              .from('manifest_action_steps')
              .delete()
              .eq('manifest_item_id', clonedItemId)
              .eq('user_id', targetUserId)
              .eq('is_hearted', false)
              .eq('is_deleted', false);

            // Insert source action steps that don't duplicate hearted items
            const newActionSteps = sourceActionSteps
              .filter((a: Record<string, unknown>) =>
                !heartedActionStepKeys.has(`${a.text}||${a.section_title}||${a.section_index}`),
              )
              .map((a: Record<string, unknown>) => ({
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

            // Update cloned item metadata (extraction_status, genres, ai_summary, toc)
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
            continue;
          }

          // Clone summaries (fresh — no existing extractions)
          if (sourceSummaries.length > 0) {
            const summaryRecords = sourceSummaries.map((s: Record<string, unknown>) => ({
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
            await supabase.from('manifest_summaries').insert(summaryRecords);
          }

          // Clone frameworks + principles
          for (const fw of sourceFrameworks) {
            const principles = (fw as Record<string, unknown>).ai_framework_principles as Array<Record<string, unknown>> || [];

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
              const principleRecords = principles.map((p: Record<string, unknown>) => ({
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
            const declRecords = sourceDeclarations.map((d: Record<string, unknown>) => ({
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
            await supabase.from('manifest_declarations').insert(declRecords);
          }

          // Clone action steps
          if (sourceActionSteps.length > 0) {
            const actionStepRecords = sourceActionSteps.map((a: Record<string, unknown>) => ({
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
            await supabase.from('manifest_action_steps').insert(actionStepRecords);
          }

          // Update cloned item's extraction_status
          await supabase
            .from('manifest_items')
            .update({ extraction_status: 'completed' })
            .eq('id', clonedItemId);

          extractionsCopied++;
        } catch (err) {
          console.error(`[manifest-clone] Failed to clone extractions for user ${targetUserId}:`, err);
        }
      }

      console.log(`[manifest-clone] Cloned extractions to ${extractionsCopied} users`);
    }

    return new Response(
      JSON.stringify({
        message: 'Clone complete',
        cloned_items: newTargetIds.length,
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
