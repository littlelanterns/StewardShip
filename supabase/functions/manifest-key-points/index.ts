import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-haiku-4.5';

const SYSTEM_PROMPT = `You are analyzing extracted content from a book. For each group of items, identify the 2-3 MOST important ones — the items that best capture the essential idea of that section. Return ONLY a JSON array of 0-based indices of the key items. Example: [0, 2, 4]

Rules:
- Pick 2-3 items maximum per group (2 for groups of 5 or fewer, 3 for groups of 6+)
- For a group of 1-2 items, return all indices
- Prefer items that capture core concepts over examples or details
- Return ONLY the JSON array, no other text`;

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
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { manifest_item_id } = await req.json();
    if (!manifest_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing manifest_item_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all extraction items for this book
    const [summariesRes, declarationsRes, actionStepsRes, questionsRes, principlesRes] = await Promise.all([
      supabase.from('manifest_summaries').select('id, text, section_title, sort_order').eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).order('section_title').order('sort_order'),
      supabase.from('manifest_declarations').select('id, declaration_text, section_title, sort_order').eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).order('section_title').order('sort_order'),
      supabase.from('manifest_action_steps').select('id, text, section_title, sort_order').eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).order('section_title').order('sort_order'),
      supabase.from('manifest_questions').select('id, text, section_title, sort_order').eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).order('section_title').order('sort_order'),
      supabase.from('ai_framework_principles').select('id, text, section_title, sort_order, framework_id').eq('user_id', userId).is('archived_at', null).order('section_title').order('sort_order'),
    ]);

    // Filter principles to only those belonging to frameworks for this manifest item
    const frameworksRes = await supabase.from('ai_frameworks').select('id').eq('manifest_item_id', manifest_item_id).eq('user_id', userId).is('archived_at', null);
    const frameworkIds = new Set((frameworksRes.data || []).map((f: { id: string }) => f.id));
    const principles = (principlesRes.data || []).filter((p: { framework_id: string }) => frameworkIds.has(p.framework_id));

    // Group items by table + section_title
    interface ItemGroup {
      table: string;
      sectionTitle: string;
      items: Array<{ id: string; text: string }>;
    }

    function groupBySection(items: Array<{ id: string; text?: string; declaration_text?: string; section_title: string | null }>, table: string): ItemGroup[] {
      const map = new Map<string, Array<{ id: string; text: string }>>();
      for (const item of items) {
        const key = item.section_title || '__full_book__';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ id: item.id, text: (item as { text?: string }).text || (item as { declaration_text?: string }).declaration_text || '' });
      }
      return Array.from(map.entries()).map(([sectionTitle, items]) => ({ table, sectionTitle, items }));
    }

    const allGroups: ItemGroup[] = [
      ...groupBySection(summariesRes.data || [], 'manifest_summaries'),
      ...groupBySection(declarationsRes.data || [], 'manifest_declarations'),
      ...groupBySection(actionStepsRes.data || [], 'manifest_action_steps'),
      ...groupBySection(questionsRes.data || [], 'manifest_questions'),
      ...groupBySection(principles, 'ai_framework_principles'),
    ];

    // For groups with ≤2 items, mark all as key points (no AI needed)
    // For groups with 3+ items, ask AI to pick the best 2-3
    const updates: Array<{ table: string; keyIds: Set<string>; allIds: string[] }> = [];

    for (const group of allGroups) {
      if (group.items.length <= 2) {
        updates.push({ table: group.table, keyIds: new Set(group.items.map((i) => i.id)), allIds: group.items.map((i) => i.id) });
        continue;
      }

      // Ask AI
      const itemList = group.items.map((item, idx) => `${idx}. ${item.text.substring(0, 200)}`).join('\n');
      const userPrompt = `Section: "${group.sectionTitle === '__full_book__' ? 'Full Book' : group.sectionTitle}"\nContent type: ${group.table.replace('manifest_', '').replace('ai_framework_', '')}\n\nItems:\n${itemList}`;

      try {
        const aiRes = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 64,
            temperature: 0,
          }),
        });

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content?.trim() || '[]';
        // Parse JSON array of indices
        const match = content.match(/\[[\d,\s]*\]/);
        const indices: number[] = match ? JSON.parse(match[0]) : [];

        const keyIds = new Set<string>();
        for (const idx of indices) {
          if (idx >= 0 && idx < group.items.length) {
            keyIds.add(group.items[idx].id);
          }
        }
        // Fallback: if AI returned nothing useful, use first 2
        if (keyIds.size === 0) {
          keyIds.add(group.items[0].id);
          if (group.items.length > 1) keyIds.add(group.items[1].id);
        }

        updates.push({ table: group.table, keyIds, allIds: group.items.map((i) => i.id) });
      } catch {
        // On AI failure, fallback to first 2
        const keyIds = new Set<string>();
        keyIds.add(group.items[0].id);
        if (group.items.length > 1) keyIds.add(group.items[1].id);
        updates.push({ table: group.table, keyIds, allIds: group.items.map((i) => i.id) });
      }
    }

    // Apply updates — batch by table
    const tableUpdates = new Map<string, { keyIds: Set<string>; nonKeyIds: string[] }>();
    for (const u of updates) {
      if (!tableUpdates.has(u.table)) tableUpdates.set(u.table, { keyIds: new Set(), nonKeyIds: [] });
      const entry = tableUpdates.get(u.table)!;
      for (const id of u.keyIds) entry.keyIds.add(id);
      for (const id of u.allIds) {
        if (!u.keyIds.has(id)) entry.nonKeyIds.push(id);
      }
    }

    for (const [table, { keyIds, nonKeyIds }] of tableUpdates.entries()) {
      const keyArr = Array.from(keyIds);
      if (keyArr.length > 0) {
        await supabase.from(table).update({ is_key_point: true }).in('id', keyArr);
      }
      if (nonKeyIds.length > 0) {
        await supabase.from(table).update({ is_key_point: false }).in('id', nonKeyIds);
      }
    }

    const totalKeyPoints = Array.from(tableUpdates.values()).reduce((sum, v) => sum + v.keyIds.size, 0);

    return new Response(
      JSON.stringify({ success: true, key_points: totalKeyPoints, groups: allGroups.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
