import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Discussion type system prompts ---

function buildDiscussionSystemPrompt(
  discussionType: string,
  audience: string,
  bookTitles: string[],
  isMultiBook: boolean,
  bookContext: string,
  userContext: string,
): string {
  const audienceGuidance = getAudienceGuidance(audience);
  const bookList = bookTitles.length === 1
    ? `"${bookTitles[0]}"`
    : bookTitles.map((t) => `"${t}"`).join(', ');

  const baseRules = `You are a thoughtful discussion partner helping someone engage deeply with ${isMultiBook ? 'books they\'ve been reading' : 'a book they\'ve been reading'}.

CRITICAL RULES:
- Never use emoji
- Never call the user "Captain" — they are the steward, not the captain
- Reference book content specifically — cite chapters, concepts, principles by name
- Connect insights to the user's personal values and principles when relevant
- Be warm, substantive, and thought-provoking — not generic or surface-level
- Keep responses focused and conversational (2-4 paragraphs typical)
- When the user's extracted/hearted content is available, prioritize those items — they represent what resonated most

${audienceGuidance}

BOOK CONTEXT:
${bookContext}

USER CONTEXT:
${userContext}`;

  switch (discussionType) {
    case 'discuss':
      return `${baseRules}

DISCUSSION MODE: Open Discussion about ${bookList}
${isMultiBook
    ? `The user wants to discuss multiple books together. Find the threads connecting them. Open with cross-book synthesis and 2-3 thought-provoking questions that bridge concepts across the books.
Question types to draw from: thought-provoking, context-altering, action-inspiring, character-improving, soul-stirring, heart-warming.`
    : `The user wants to discuss this book. Acknowledge what they've extracted and hearted to show you understand what resonated with them. Be ready to go deep on any concept, story, or principle from the book.`}
Draw from the RAG chunks and extracted content to give substantive, book-grounded responses. When you reference the book, be specific about which concept, chapter, or idea you're drawing from.`;

    case 'generate_goals':
      return `${baseRules}

GOAL GENERATION MODE: Generate actionable goals from ${bookList}
Review the user's hearted frameworks and declarations (prioritize hearted items). Suggest 3-5 specific, actionable goals tied to the book's principles.
Goals should be:
- Specific enough to track progress
- Connected to the book's core frameworks or principles
- Realistic for someone to start within the next month
- Connected to the user's values and life context when possible

Present goals conversationally — explain why each goal connects to the book's teaching. The user can refine, adjust, or request different goals.

When the user is satisfied with goals, format them clearly so they can be routed to Rigging (the planning tool).`;

    case 'generate_questions':
      return `${baseRules}

QUESTION GENERATION MODE: Generate discussion questions from ${bookList}
Generate 5-8 discussion questions drawing from the extracted content and the user's personal context.
Questions should be open-ended, thought-provoking, and designed to deepen understanding.

${audienceGuidance}

Present questions in a natural, conversational way. The user can ask for more, adjust difficulty, or change focus areas.`;

    case 'generate_tasks':
      return `${baseRules}

TASK GENERATION MODE: Generate actionable tasks from ${bookList}
Review the book's frameworks and principles. Suggest 3-5 concrete tasks the user could do this week to implement what they've learned.
Tasks should be:
- Immediately actionable (can start today or this week)
- Specific and concrete (not vague aspirations)
- Connected to specific book principles
- Varied in effort level (mix of quick wins and deeper commitments)

Present conversationally. The user can refine or request different tasks.

When satisfied, format tasks clearly so they can be routed to Compass (the task manager).`;

    case 'generate_tracker':
      return `${baseRules}

TRACKER GENERATION MODE: Suggest tracking ideas from ${bookList}
Based on the book's frameworks, suggest 2-4 things worth tracking — habits, behaviors, metrics, or practices.
For each suggestion, explain:
- What to track and why (connected to which book principle)
- How often to track (daily, weekly, etc.)
- How to measure (simple yes/no, scale, count, etc.)

Present conversationally. The user can refine tracking criteria and approach.`;

    default:
      return baseRules;
  }
}

function getAudienceGuidance(audience: string): string {
  const base = `AUDIENCE TARGET: "${audience.toUpperCase()}" — You MUST tailor ALL content for this audience. If previous messages in the conversation used a different audience style, ADAPT NOW to the current audience.`;
  switch (audience) {
    case 'personal':
      return `${base}\nGenerate questions appropriate for: Personal reflection. Speak directly to the user. Questions should be introspective, individually focused, and personally challenging.`;
    case 'family':
      return `${base}\nGenerate questions appropriate for: Family discussion. Questions and content should be age-appropriate for the whole family, including children. Use accessible language. Focus on shared values and family application. Frame questions so family members can discuss together.`;
    case 'teen':
      return `${base}\nGenerate questions appropriate for: Teen engagement. Use language and examples that resonate with teenage thinking. Connect concepts to their world — school, friendships, identity, social media, future dreams. Make it engaging, not preachy. Use a tone that respects their intelligence while being accessible.`;
    case 'spouse':
      return `${base}\nGenerate questions appropriate for: Couples discussion. Frame content for partners to discuss together. Focus on relationship application, shared growth, mutual understanding, and how the book's ideas apply to their partnership.`;
    case 'children':
      return `${base}\nGenerate questions appropriate for: Children. Simplify concepts dramatically. Use wonder-driven, curiosity-sparking language. Keep questions short and concrete. Use stories and examples children can relate to. Make it fun and engaging.`;
    default:
      return '';
  }
}

// --- Context building ---

async function buildBookContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  manifestItemIds: string[],
  userMessage: string,
): Promise<{ context: string; titles: string[] }> {
  const parts: string[] = [];
  const titles: string[] = [];

  for (const itemId of manifestItemIds) {
    // 1. Book metadata
    const { data: item } = await supabase
      .from('manifest_items')
      .select('title, author, genres, ai_summary, source_manifest_item_id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!item) continue;
    const displayTitle = item.author ? `${item.title} by ${item.author}` : item.title;
    titles.push(displayTitle);
    const sourceItemId = item.source_manifest_item_id;

    let bookSection = `\n--- ${displayTitle} ---`;
    if (item.ai_summary) {
      bookSection += `\nSummary: ${item.ai_summary}`;
    }
    if (item.genres?.length > 0) {
      bookSection += `\nGenres: ${item.genres.join(', ')}`;
    }

    // 2. Extracted summaries (hearted first, then non-deleted)
    const { data: summaries } = await supabase
      .from('manifest_summaries')
      .select('*')
      .eq('manifest_item_id', itemId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('is_hearted', { ascending: false })
      .order('section_index', { ascending: true })
      .order('sort_order', { ascending: true });

    if (summaries && summaries.length > 0) {
      const heartedSummaries = summaries.filter((s: { is_hearted: boolean }) => s.is_hearted);
      const otherSummaries = summaries.filter((s: { is_hearted: boolean }) => !s.is_hearted);

      if (heartedSummaries.length > 0) {
        bookSection += '\n\nHearted Key Insights:';
        for (const s of heartedSummaries) {
          bookSection += `\n- [${s.content_type}] ${s.text}`;
        }
      }
      if (otherSummaries.length > 0) {
        // Limit non-hearted to keep context manageable
        const limited = otherSummaries.slice(0, 15);
        bookSection += '\n\nOther Key Insights:';
        for (const s of limited) {
          bookSection += `\n- [${s.content_type}] ${s.text}`;
        }
      }
    }

    // 3. Framework principles
    const { data: frameworks } = await supabase
      .from('ai_frameworks')
      .select('id, name')
      .eq('manifest_item_id', itemId)
      .eq('user_id', userId)
      .maybeSingle();

    if (frameworks) {
      const { data: principles } = await supabase
        .from('ai_framework_principles')
        .select('*')
        .eq('framework_id', frameworks.id)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_hearted', { ascending: false })
        .order('sort_order', { ascending: true });

      if (principles && principles.length > 0) {
        const heartedPrinciples = principles.filter((p: { is_hearted: boolean }) => p.is_hearted);
        const otherPrinciples = principles.filter((p: { is_hearted: boolean }) => !p.is_hearted);

        if (heartedPrinciples.length > 0) {
          bookSection += `\n\nHearted Principles (${frameworks.name}):`;
          for (const p of heartedPrinciples) {
            bookSection += `\n- ${p.text}`;
          }
        }
        if (otherPrinciples.length > 0) {
          const limited = otherPrinciples.slice(0, 10);
          bookSection += `\n\nOther Principles (${frameworks.name}):`;
          for (const p of limited) {
            bookSection += `\n- ${p.text}`;
          }
        }
      }
    }

    // 4. Declarations
    const { data: declarations } = await supabase
      .from('manifest_declarations')
      .select('*')
      .eq('manifest_item_id', itemId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('is_hearted', { ascending: false })
      .order('sort_order', { ascending: true });

    if (declarations && declarations.length > 0) {
      const heartedDecls = declarations.filter((d: { is_hearted: boolean }) => d.is_hearted);
      const otherDecls = declarations.filter((d: { is_hearted: boolean }) => !d.is_hearted);

      if (heartedDecls.length > 0) {
        bookSection += '\n\nHearted Declarations:';
        for (const d of heartedDecls) {
          bookSection += `\n- ${d.value_name ? `[${d.value_name}] ` : ''}${d.declaration_text}`;
        }
      }
      if (otherDecls.length > 0) {
        const limited = otherDecls.slice(0, 8);
        bookSection += '\n\nOther Declarations:';
        for (const d of limited) {
          bookSection += `\n- ${d.value_name ? `[${d.value_name}] ` : ''}${d.declaration_text}`;
        }
      }
    }

    // 5. RAG chunks + semantic search for deeper content
    try {
      // Generate embeddings: ada-002 for RAG chunks, 3-small for semantic extracted content
      const embedUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/manifest-embed`;
      const [ragEmbedRes, semanticEmbedRes] = await Promise.all([
        fetch(embedUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: userMessage || item.title, user_id: userId }),
        }),
        fetch(embedUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: userMessage || item.title, user_id: userId, model: 'text-embedding-3-small' }),
        }),
      ]);

      // RAG chunk search (ada-002 embeddings)
      if (ragEmbedRes.ok) {
        const embedData = await ragEmbedRes.json();
        if (embedData?.embedding) {
          const { data: chunks } = await supabase.rpc('match_manifest_chunks', {
            query_embedding: embedData.embedding,
            p_user_id: userId,
            match_threshold: 0.65,
            match_count: manifestItemIds.length === 1 ? 8 : 5,
          });

          if (chunks && chunks.length > 0) {
            const filtered = chunks.filter((c: { manifest_item_id: string }) =>
              c.manifest_item_id === itemId || (sourceItemId && c.manifest_item_id === sourceItemId)
            );
            if (filtered.length > 0) {
              bookSection += '\n\nRelevant Passages:';
              for (const c of filtered.slice(0, manifestItemIds.length === 1 ? 8 : 5)) {
                const snippet = c.chunk_text.length > 600
                  ? c.chunk_text.substring(0, 600) + '...'
                  : c.chunk_text;
                bookSection += `\n---\n${snippet}`;
              }
            }
          }
        }
      }

      // Semantic search on extracted content (text-embedding-3-small embeddings)
      if (semanticEmbedRes.ok) {
        const semanticData = await semanticEmbedRes.json();
        if (semanticData?.embedding) {
          const { data: semanticMatches } = await supabase.rpc('match_manifest_content', {
            query_embedding: semanticData.embedding,
            target_user_id: userId,
            match_threshold: 0.4,
            match_count: manifestItemIds.length === 1 ? 6 : 10,
          });

          if (semanticMatches && semanticMatches.length > 0) {
            // For single book: only show matches from OTHER books (cross-references)
            // For multi-book: show all matches (cross-book synthesis)
            const relevant = manifestItemIds.length === 1
              ? semanticMatches.filter((m: { manifest_item_id: string }) => m.manifest_item_id !== itemId)
              : semanticMatches;

            if (relevant.length > 0) {
              bookSection += manifestItemIds.length === 1
                ? '\n\nRelated content from other books (semantic match):'
                : '\n\nSemantically related content across library:';
              for (const m of relevant.slice(0, 6)) {
                const sourceType = m.source_table.replace('manifest_', '').replace('ai_framework_', '').replace(/_/g, ' ');
                bookSection += `\n- [${m.book_title} — ${sourceType}] ${m.content_preview}`;
              }
            }
          }
        }
      }
    } catch (ragErr) {
      console.error('RAG/semantic search failed for book context:', ragErr);
    }

    parts.push(bookSection);
  }

  return { context: parts.join('\n\n'), titles };
}

async function buildUserContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const parts: string[] = [];

  // Mast entries (always loaded)
  const { data: mastEntries } = await supabase
    .from('mast_entries')
    .select('type, text')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  if (mastEntries && mastEntries.length > 0) {
    parts.push('User\'s Guiding Principles (The Mast):');
    const grouped: Record<string, string[]> = {};
    for (const e of mastEntries) {
      if (!grouped[e.type]) grouped[e.type] = [];
      grouped[e.type].push(e.text);
    }
    for (const [type, entries] of Object.entries(grouped)) {
      parts.push(`${type.toUpperCase()}:`);
      for (const text of entries) {
        parts.push(`- ${text}`);
      }
    }
  }

  // Keel entries (for personalization)
  const { data: keelEntries } = await supabase
    .from('keel_entries')
    .select('category, text')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .limit(20);

  if (keelEntries && keelEntries.length > 0) {
    parts.push('\nAbout the User (The Keel):');
    for (const e of keelEntries) {
      const prefix = e.category !== 'general' ? `[${e.category}] ` : '';
      parts.push(`- ${prefix}${e.text.substring(0, 200)}`);
    }
  }

  // Active framework principles from OTHER books (for cross-referencing)
  const { data: otherFrameworks } = await supabase
    .from('ai_frameworks')
    .select('name, manifest_item_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('archived_at', null);

  if (otherFrameworks && otherFrameworks.length > 0) {
    const fwIds = otherFrameworks.map((f: { name: string; manifest_item_id: string }) => f.name);
    if (fwIds.length > 0) {
      parts.push(`\nUser has active frameworks from other books: ${fwIds.join(', ')}`);
    }
  }

  return parts.join('\n');
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
    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token payload' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      manifest_item_ids,
      discussion_type,
      audience,
      message,
      conversation_history,
    } = await req.json();

    if (!manifest_item_ids || !Array.isArray(manifest_item_ids) || manifest_item_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: manifest_item_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!discussion_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: discussion_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get API key
    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_api_key_encrypted')
      .eq('user_id', userId)
      .maybeSingle();

    let apiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
    if (settings?.ai_api_key_encrypted) {
      apiKey = settings.ai_api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build context
    const isMultiBook = manifest_item_ids.length > 1;
    const { context: bookContext, titles: bookTitles } = await buildBookContext(
      supabase,
      userId,
      manifest_item_ids,
      message || '',
    );
    const userContext = await buildUserContext(supabase, userId);

    // Build system prompt
    const systemPrompt = buildDiscussionSystemPrompt(
      discussion_type,
      audience || 'personal',
      bookTitles,
      isMultiBook,
      bookContext,
      userContext,
    );

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add the current user message (if provided — empty message triggers opening)
    if (message) {
      messages.push({ role: 'user', content: message });
    } else if (messages.length === 0) {
      // No history and no message — this is the opening. Send a synthetic user message
      // to trigger the AI's opening response
      if (isMultiBook) {
        messages.push({
          role: 'user',
          content: `I'd like to explore these books together: ${bookTitles.join(', ')}. What connections do you see?`,
        });
      } else {
        messages.push({
          role: 'user',
          content: `I'd like to ${discussion_type === 'discuss' ? 'discuss' : discussion_type === 'generate_goals' ? 'generate goals from' : discussion_type === 'generate_questions' ? 'generate discussion questions from' : discussion_type === 'generate_tasks' ? 'generate action items from' : 'explore tracking ideas from'} "${bookTitles[0]}".`,
        });
      }
    }

    // Call OpenRouter with Sonnet
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://stewardship.app',
        'X-Title': 'StewardShip',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.text();
      const status = openRouterResponse.status;

      if (status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key. Check your AI configuration in Settings.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ error: `AI provider error (${status}): ${errorBody}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await openRouterResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('manifest-discuss error:', err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
