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

    // Admin gate
    if (callerEmail !== ADMIN_EMAIL) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, manifest_item_id } = await req.json();

    // ── LIST BOOKS ──
    if (action === 'list_books') {
      // Get admin's original (non-clone) books
      const { data: books, error: booksErr } = await supabase
        .from('manifest_items')
        .select('id, title, file_type, extraction_status, processing_status, created_at')
        .eq('user_id', callerUserId)
        .is('source_manifest_item_id', null)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (booksErr) return jsonResponse({ error: booksErr.message }, 500);

      // Get clone counts per book
      const bookIds = (books || []).map((b: { id: string }) => b.id);
      const cloneCounts: Record<string, number> = {};

      if (bookIds.length > 0) {
        const { data: clones } = await supabase
          .from('manifest_items')
          .select('source_manifest_item_id')
          .in('source_manifest_item_id', bookIds);

        for (const clone of clones || []) {
          const srcId = clone.source_manifest_item_id as string;
          cloneCounts[srcId] = (cloneCounts[srcId] || 0) + 1;
        }
      }

      const result = (books || []).map((b: Record<string, unknown>) => ({
        ...b,
        clone_count: cloneCounts[b.id as string] || 0,
      }));

      return jsonResponse({ books: result });
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
      // Invoke manifest-clone with force_update
      const { error: cloneErr } = await supabase.functions.invoke('manifest-clone', {
        body: {
          manifest_item_id,
          clone_extractions: true,
          force_update: true,
        },
      });

      if (cloneErr) {
        return jsonResponse({ error: `Repush failed: ${cloneErr.message}` }, 500);
      }

      return jsonResponse({ message: 'Repush complete' });
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
