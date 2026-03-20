import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-haiku-4.5';

function buildSystemPrompt(childContext?: string): string {
  let prompt = `You are rewriting book extractions for a younger audience. Transform each item to be:

1. SIMPLER LANGUAGE — Replace jargon, complex sentences, and abstract concepts with clear, concrete language.
2. RELATABLE EXAMPLES — Connect ideas to their world (school, friendships, family, hobbies, sports, growing up).
3. "WHAT THIS MEANS FOR YOU" FRAMING — Don't just simplify — make it personally relevant.
4. CONVERSATIONAL TONE — Write like a wise older sibling, not a textbook. Warm but not condescending.
5. KEEP THE CORE IDEA — Don't water down the principle. Young people can handle deep ideas when explained well.

For ACTION STEPS: Adapt to things they can actually do in their daily life.
For QUESTIONS: Make them reflective and personal ("Have you ever..." not "Analyze the paradigm...").
For SUMMARIES: Tell the story or idea in a way that hooks their attention.`;

  if (childContext) {
    prompt += `\n\nIMPORTANT — You are personalizing this for a SPECIFIC person. Use what you know about them to make examples and language resonate with THEIR interests, personality, and life:\n\n${childContext}`;
  }

  prompt += `\n\nYou will receive items as a JSON array. Return a JSON array of the SAME LENGTH with rewritten text. Each item: { "text": "rewritten version" }\n\nReturn ONLY the JSON array.`;

  return prompt;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const jwt = authHeader.replace('Bearer ', '');
    const payloadB64 = jwt.split('.')[1];
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const jwtPayload = JSON.parse(atob(b64));
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { manifest_item_id, child_id } = await req.json();
    if (!manifest_item_id) {
      return new Response(JSON.stringify({ error: 'Missing manifest_item_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Determine audience tag
    const audienceTag = child_id ? `study_guide_${child_id}` : 'teen_study_guide';

    // Build child context if a specific child was selected
    let childContext: string | undefined;
    let childName = 'a young person';
    if (child_id) {
      // Fetch person info
      const { data: person } = await supabase.from('people')
        .select('name, nickname, relationship_type, date_of_birth, notes')
        .eq('id', child_id).eq('user_id', userId).single();

      if (person) {
        childName = person.nickname || person.name || 'this child';
        const age = person.date_of_birth
          ? Math.floor((Date.now() - new Date(person.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;

        let context = `Name: ${childName}`;
        if (age) context += `\nAge: ${age} years old`;
        if (person.relationship_type) context += `\nRelationship: ${person.relationship_type}`;
        if (person.notes) context += `\nGeneral notes: ${person.notes}`;

        // Fetch rich context (crew_notes) if available
        const { data: notes } = await supabase.from('crew_notes')
          .select('category, content')
          .eq('person_id', child_id).eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (notes && notes.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const n of notes) {
            const cat = n.category || 'general';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(n.content);
          }
          for (const [cat, items] of Object.entries(grouped)) {
            context += `\n${cat.replace(/_/g, ' ').toUpperCase()}:\n${items.map((i) => `- ${i}`).join('\n')}`;
          }
        }

        childContext = context;
      }
    }

    // Delete existing study guide items for this audience tag
    await Promise.all([
      supabase.from('manifest_summaries').delete().eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('audience', audienceTag),
      supabase.from('manifest_action_steps').delete().eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('audience', audienceTag),
      supabase.from('manifest_questions').delete().eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('audience', audienceTag),
      supabase.from('manifest_declarations').delete().eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('audience', audienceTag),
    ]);

    // Fetch key point items (original audience only)
    const [sumRes, actRes, qRes, declRes] = await Promise.all([
      supabase.from('manifest_summaries').select('id, text, content_type, section_title, section_index, sort_order')
        .eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).eq('audience', 'original')
        .or('is_key_point.eq.true,is_hearted.eq.true')
        .order('section_index').order('sort_order'),
      supabase.from('manifest_action_steps').select('id, text, content_type, section_title, section_index, sort_order')
        .eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).eq('audience', 'original')
        .or('is_key_point.eq.true,is_hearted.eq.true')
        .order('section_index').order('sort_order'),
      supabase.from('manifest_questions').select('id, text, content_type, section_title, section_index, sort_order')
        .eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).eq('audience', 'original')
        .or('is_key_point.eq.true,is_hearted.eq.true')
        .order('section_index').order('sort_order'),
      supabase.from('manifest_declarations').select('id, declaration_text, declaration_style, value_name, section_title, section_index, sort_order')
        .eq('manifest_item_id', manifest_item_id).eq('user_id', userId).eq('is_deleted', false).eq('audience', 'original')
        .or('is_key_point.eq.true,is_hearted.eq.true')
        .order('section_index').order('sort_order'),
    ]);

    const summaries = sumRes.data || [];
    const actionSteps = actRes.data || [];
    const questions = qRes.data || [];
    const declarations = declRes.data || [];

    const totalItems = summaries.length + actionSteps.length + questions.length + declarations.length;
    if (totalItems === 0) {
      return new Response(JSON.stringify({ success: true, items_created: 0, audience: audienceTag, child_name: childName, message: 'No key points to transform. Run "Refresh Key Points" first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = buildSystemPrompt(childContext);

    // Helper: call AI to rewrite a batch
    async function rewriteBatch(items: Array<{ text: string }>, typeHint: string): Promise<string[]> {
      if (items.length === 0) return [];

      const userPrompt = `Content type: ${typeHint}\n\nItems to rewrite for ${childName}:\n${JSON.stringify(items.map((i) => ({ text: i.text })))}`;

      const aiRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });

      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content?.trim() || '[]';

      try {
        const match = content.match(/\[[\s\S]*\]/);
        if (!match) return items.map((i) => i.text);
        const parsed = JSON.parse(match[0]);
        return parsed.map((p: { text: string }, idx: number) => p.text || items[idx]?.text || '');
      } catch {
        return items.map((i) => i.text);
      }
    }

    const [rewrittenSummaries, rewrittenActions, rewrittenQuestions, rewrittenDeclarations] = await Promise.all([
      rewriteBatch(summaries.map((s) => ({ text: s.text })), 'Key Ideas (summaries)'),
      rewriteBatch(actionSteps.map((a) => ({ text: a.text })), 'Try This (action steps)'),
      rewriteBatch(questions.map((q) => ({ text: q.text })), 'Think About (reflection questions)'),
      rewriteBatch(declarations.map((d) => ({ text: d.declaration_text })), 'Principles to Remember (declarations)'),
    ]);

    // Save study guide items
    let created = 0;

    if (summaries.length > 0) {
      const rows = summaries.map((s, i) => ({
        user_id: userId, manifest_item_id, section_title: s.section_title, section_index: s.section_index,
        content_type: s.content_type, text: rewrittenSummaries[i], sort_order: s.sort_order,
        is_key_point: true, audience: audienceTag,
      }));
      const { data } = await supabase.from('manifest_summaries').insert(rows).select('id');
      created += data?.length || 0;
    }

    if (actionSteps.length > 0) {
      const rows = actionSteps.map((a, i) => ({
        user_id: userId, manifest_item_id, section_title: a.section_title, section_index: a.section_index,
        content_type: a.content_type, text: rewrittenActions[i], sort_order: a.sort_order,
        is_key_point: true, audience: audienceTag,
      }));
      const { data } = await supabase.from('manifest_action_steps').insert(rows).select('id');
      created += data?.length || 0;
    }

    if (questions.length > 0) {
      const rows = questions.map((q, i) => ({
        user_id: userId, manifest_item_id, section_title: q.section_title, section_index: q.section_index,
        content_type: q.content_type, text: rewrittenQuestions[i], sort_order: q.sort_order,
        is_key_point: true, audience: audienceTag,
      }));
      const { data } = await supabase.from('manifest_questions').insert(rows).select('id');
      created += data?.length || 0;
    }

    if (declarations.length > 0) {
      const rows = declarations.map((d, i) => ({
        user_id: userId, manifest_item_id, section_title: d.section_title, section_index: d.section_index,
        value_name: d.value_name, declaration_text: rewrittenDeclarations[i], declaration_style: d.declaration_style,
        sort_order: d.sort_order, is_key_point: true, audience: audienceTag,
      }));
      const { data } = await supabase.from('manifest_declarations').insert(rows).select('id');
      created += data?.length || 0;
    }

    return new Response(
      JSON.stringify({ success: true, items_created: created, source_items: totalItems, audience: audienceTag, child_name: childName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
