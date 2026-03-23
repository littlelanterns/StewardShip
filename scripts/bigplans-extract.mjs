#!/usr/bin/env node
/**
 * BigPlans PRD-29 Extraction Script
 * Pulls all extracted content from target books + runs semantic searches
 * Outputs a single markdown file organized by concept cluster
 * Filtered to tenisewertman@gmail.com account only
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;
const USER_ID = '082b18e3-f2c4-4411-a5b6-8435e3b36e56';

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('Missing required env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Book title search patterns ─────────────────────────────────────────────
const BOOK_SEARCHES = [
  'Getting Things Done',
  'Goals!',
  'Traction',
  '7 Habits of Highly Effective People',
  'Essentialism',
  'Effortless',
  'Atomic Habits',
  'Tiny Experiments',
  'Straight-Line Leadership',
  'Straight Line Leadership',
  'Power of Consistency',
  'Get Er Done',
  'Executive Functioning Workbook',
  'Flow',
  'E-Myth Revisited',
  'Beyond the E-Myth',
  'Company of One',
  'Well-Oiled Operations',
  'Principles',
  'Extreme Ownership',
  'Inspired',
  'Absolutely Organize Your Family',
  'Habits of the Household',
  'How to Meal Plan',
  'Roles',
  'House United',
  'Parenting_Nicholeen Peck',
  'Opposite of Chaos',
  'Art of Raising Children',
  'So You Want to Raise a Boy',
  'How to Talk So Kids Will Listen',
  'Siblings Without Rivalry',
  'Good Inside',
  'Raising Human Beings',
  'Whole-Brain Child',
  'How to ADHD',
  'Supporting Positive Behavior',
  'Redefining the Reality of Down Syndrome',
  'How to Get Your Teen to Talk',
  'Emotionally Intelligent Teen',
  'Growth Mindset for Teens',
  'Influencer',
  'Outward Mindset',
  'Coaching Habit',
  'Bonds That Make Us Free',
  'Dangerous Love',
  'Nonviolent Communication',
  'Five Love Languages',
  '5 Love Languages of Children',
  'Ask Powerful Questions',
  'Multipliers',
  'Hooked',
  'Actionable Gamification',
  'Mindset',
  'Do Hard Things',
  'Power of TED',
  'Empowerment Dynamic',
  'Design of Everyday Things',
  'Building a StoryBrand',
  'Click',
  'Divine Center',
  'Spiritual Roots of Human Relations',
  'Dream Giver',
  'Purpose Code',
  'Mount of Olives',
  'Telling Yourself the Truth',
  'Happiness Project',
  'Intentional Legacy',
  "Man's Search for Meaning",
];

// ─── Semantic search queries ────────────────────────────────────────────────
const SEMANTIC_QUERIES = [
  'setting goals and working backward from the outcome',
  'breaking large projects into milestones and phases',
  'simplifying complex projects into manageable steps',
  'quarterly planning and rocks',
  'capture process organize workflow',
  'prioritizing what matters most and eliminating the rest',
  'the difference between urgent and important',
  'knowing when a goal is too big or too vague',
  'designing systems and routines that sustain themselves',
  'creating household routines that work for the whole family',
  'building habits and rhythms into daily life',
  'the difference between goals and systems',
  'making essential things effortless instead of adding willpower',
  'designing for the weakest link in a system',
  'reducing mental load and cognitive overhead',
  'simplifying family logistics and reducing daily decisions',
  'working on your business not in your business',
  'automating decisions and creating defaults',
  'diagnosing why a plan or routine fails',
  'friction in habits and systems',
  'why household routines fall apart and how to fix them',
  'obstacles to consistency and follow-through',
  'executive function challenges in daily life',
  'when systems break down under stress or change',
  'the gap between knowing what to do and actually doing it',
  'identifying bottlenecks in a process',
  'iteration and adjustment when plans are not working',
  'progressive improvement through small experiments',
  'how to know when to adjust a plan versus abandon it',
  'adapting when life circumstances change suddenly',
  'learning from what did not work without self-blame',
  'reflection and review as part of the planning cycle',
  'getting children to follow systems without constant reminding',
  'teaching children responsibility through systems not punishment',
  'introducing new expectations to reluctant family members',
  'managing complexity in a large or neurodiverse family',
  'communication patterns that support cooperation',
  'motivating without coercion shame or external pressure',
  'building intrinsic motivation in children and teens',
  'making responsibilities feel achievable for different ages and abilities',
  'accountability and check-in patterns',
  'tracking progress without obsessing over metrics',
  'celebrating progress and milestones',
  'maintaining momentum on long-term plans',
  'what to do when motivation fades',
  'sustainable pace versus burnout',
  'connecting daily actions to deeper purpose and values',
  'planning from identity and purpose rather than just outcomes',
  'aligning family rhythms with family values',
  'the relationship between vision and daily execution',
];

// ─── Section assignments for semantic queries ───────────────────────────────
const QUERY_TO_SECTION = {
  'setting goals and working backward from the outcome': 1,
  'breaking large projects into milestones and phases': 2,
  'simplifying complex projects into manageable steps': 2,
  'quarterly planning and rocks': 1,
  'capture process organize workflow': 2,
  'prioritizing what matters most and eliminating the rest': 11,
  'the difference between urgent and important': 11,
  'knowing when a goal is too big or too vague': 1,
  'designing systems and routines that sustain themselves': 3,
  'creating household routines that work for the whole family': 4,
  'building habits and rhythms into daily life': 8,
  'the difference between goals and systems': 3,
  'making essential things effortless instead of adding willpower': 11,
  'designing for the weakest link in a system': 12,
  'reducing mental load and cognitive overhead': 11,
  'simplifying family logistics and reducing daily decisions': 4,
  'working on your business not in your business': 3,
  'automating decisions and creating defaults': 12,
  'diagnosing why a plan or routine fails': 5,
  'friction in habits and systems': 5,
  'why household routines fall apart and how to fix them': 5,
  'obstacles to consistency and follow-through': 5,
  'executive function challenges in daily life': 5,
  'when systems break down under stress or change': 5,
  'the gap between knowing what to do and actually doing it': 5,
  'identifying bottlenecks in a process': 5,
  'iteration and adjustment when plans are not working': 6,
  'progressive improvement through small experiments': 6,
  'how to know when to adjust a plan versus abandon it': 6,
  'adapting when life circumstances change suddenly': 6,
  'learning from what did not work without self-blame': 6,
  'reflection and review as part of the planning cycle': 6,
  'getting children to follow systems without constant reminding': 7,
  'teaching children responsibility through systems not punishment': 7,
  'introducing new expectations to reluctant family members': 7,
  'managing complexity in a large or neurodiverse family': 7,
  'communication patterns that support cooperation': 7,
  'motivating without coercion shame or external pressure': 7,
  'building intrinsic motivation in children and teens': 7,
  'making responsibilities feel achievable for different ages and abilities': 7,
  'accountability and check-in patterns': 9,
  'tracking progress without obsessing over metrics': 9,
  'celebrating progress and milestones': 9,
  'maintaining momentum on long-term plans': 9,
  'what to do when motivation fades': 8,
  'sustainable pace versus burnout': 9,
  'connecting daily actions to deeper purpose and values': 10,
  'planning from identity and purpose rather than just outcomes': 10,
  'aligning family rhythms with family values': 10,
  'the relationship between vision and daily execution': 10,
};

// ─── Section definitions ────────────────────────────────────────────────────
const SECTIONS = {
  1: 'Goal Setting & Backward Planning',
  2: 'Project Decomposition & Milestone Design',
  3: 'System & Routine Design Principles',
  4: 'Household & Family-Specific Systems',
  5: 'The Friction Taxonomy — Why Plans & Systems Fail',
  6: 'Iteration, Adjustment & Recovery',
  7: 'Family Buy-In & Change Management',
  8: 'Motivation, Habits & Behavioral Design',
  9: 'Accountability, Check-Ins & Sustainable Pace',
  10: 'Values-Connected Planning & Purpose Alignment',
  11: 'Simplification & Essentialism in Planning',
  12: 'Design Thinking Applied to Life Systems',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findBooks() {
  const { data: allBooks } = await supabase
    .from('manifest_items')
    .select('id, title, author, extraction_status')
    .eq('user_id', USER_ID)
    .is('archived_at', null)
    .order('title');

  if (!allBooks) return { matched: [], unmatched: [] };

  const matched = [];
  const matchedSearches = new Set();

  for (const search of BOOK_SEARCHES) {
    const lower = search.toLowerCase();
    const found = allBooks.filter(b => b.title?.toLowerCase().includes(lower));
    if (found.length > 0) {
      for (const book of found) {
        if (!matched.find(m => m.id === book.id)) {
          matched.push(book);
        }
      }
      matchedSearches.add(search);
    }
  }

  const unmatched = BOOK_SEARCHES.filter(s => !matchedSearches.has(s));
  return { matched, unmatched };
}

async function fetchAllPaginated(table, bookIds, select) {
  const allData = [];
  const batchSize = 50;

  for (let i = 0; i < bookIds.length; i += batchSize) {
    const batch = bookIds.slice(i, i + batchSize);
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in('manifest_item_id', batch)
        .eq('user_id', USER_ID)
        .eq('is_deleted', false)
        .order('section_index')
        .order('sort_order')
        .range(offset, offset + pageSize - 1);

      if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return allData;
}

async function fetchFrameworkPrinciples(bookIds) {
  const allData = [];
  const batchSize = 50;

  for (let i = 0; i < bookIds.length; i += batchSize) {
    const batch = bookIds.slice(i, i + batchSize);

    const { data: fws } = await supabase
      .from('ai_frameworks')
      .select('id, manifest_item_id')
      .in('manifest_item_id', batch)
      .eq('user_id', USER_ID)
      .is('archived_at', null);

    if (!fws || fws.length === 0) continue;

    const fwIds = fws.map(f => f.id);
    const fwToBook = Object.fromEntries(fws.map(f => [f.id, f.manifest_item_id]));

    for (let j = 0; j < fwIds.length; j += 50) {
      const fwBatch = fwIds.slice(j, j + 50);
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from('ai_framework_principles')
          .select('id, framework_id, section_title, text, is_hearted, is_from_go_deeper, user_note')
          .in('framework_id', fwBatch)
          .eq('user_id', USER_ID)
          .is('archived_at', null)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('sort_order')
          .range(offset, offset + 999);

        if (error) { console.error('Error fetching frameworks:', error.message); break; }
        if (!data || data.length === 0) break;
        data.forEach(d => { d.manifest_item_id = fwToBook[d.framework_id]; });
        allData.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }
    }
  }
  return allData;
}

async function fetchExtractions(bookIds) {
  const [summaries, declarations, frameworks, actionSteps, questions] = await Promise.all([
    fetchAllPaginated('manifest_summaries', bookIds, 'id, manifest_item_id, section_title, section_index, content_type, text, is_hearted, is_from_go_deeper, user_note'),
    fetchAllPaginated('manifest_declarations', bookIds, 'id, manifest_item_id, section_title, section_index, value_name, declaration_text, declaration_style, is_hearted, is_from_go_deeper, user_note'),
    fetchFrameworkPrinciples(bookIds),
    fetchAllPaginated('manifest_action_steps', bookIds, 'id, manifest_item_id, section_title, section_index, content_type, text, is_hearted, is_from_go_deeper, user_note, sent_to_compass'),
    fetchAllPaginated('manifest_questions', bookIds, 'id, manifest_item_id, section_title, section_index, content_type, text, is_hearted, is_from_go_deeper, user_note'),
  ]);

  return { summaries, declarations, frameworks, actionSteps, questions };
}

async function getEmbedding(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message);
  return json.data[0].embedding;
}

async function semanticSearch(query, matchCount = 20) {
  const embedding = await getEmbedding(query);
  const { data, error } = await supabase.rpc('match_manifest_content', {
    query_embedding: embedding,
    target_user_id: USER_ID,
    match_threshold: 0.25,
    match_count: matchCount,
  });
  if (error) {
    console.error(`Semantic search failed for "${query}":`, error.message);
    return [];
  }
  return data || [];
}

async function fetchFullRecords(searchResults) {
  const byTable = {};
  for (const r of searchResults) {
    if (!byTable[r.source_table]) byTable[r.source_table] = [];
    byTable[r.source_table].push(r);
  }

  const fullRecords = [];

  for (const [table, results] of Object.entries(byTable)) {
    const ids = results.map(r => r.record_id);
    const simMap = Object.fromEntries(results.map(r => [r.record_id, { similarity: r.similarity, book_title: r.book_title }]));

    let select;
    switch (table) {
      case 'manifest_summaries':
        select = 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note';
        break;
      case 'manifest_declarations':
        select = 'id, manifest_item_id, section_title, value_name, declaration_text, declaration_style, is_hearted, user_note';
        break;
      case 'ai_framework_principles':
        select = 'id, framework_id, section_title, text, is_hearted, user_note';
        break;
      case 'manifest_action_steps':
        select = 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note';
        break;
      case 'manifest_questions':
        select = 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note';
        break;
      default:
        continue;
    }

    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { data } = await supabase.from(table).select(select).in('id', batch);
      if (data) {
        data.forEach(d => {
          d._source_table = table;
          d._similarity = simMap[d.id]?.similarity;
          d._book_title = simMap[d.id]?.book_title;
        });
        fullRecords.push(...data);
      }
    }
  }
  return fullRecords;
}

// ─── Classification ─────────────────────────────────────────────────────────

function classifyToSection(text, bookTitle, contentType) {
  const lower = (text + ' ' + (bookTitle || '')).toLowerCase();

  const rules = [
    { section: 1, patterns: [/\bgoal[s]?\b.*\b(set|plan|backward|reverse|outcome|vision|smart|specific|measurable)\b/, /\bwork(?:ing)? backward\b/, /\bend (?:in|with|state|result)\b.*\bstart\b/, /\bstart with the end\b/, /\bbegin with the end\b/, /\bclarity of (?:purpose|outcome|goal)\b/] },
    { section: 2, patterns: [/\bmilestone[s]?\b/, /\bdecompos[ei]/, /\bbreak(?:ing)? (?:down|into)\b/, /\bphase[s]?\b.*\bproject\b/, /\bproject[s]?\b.*\b(?:plan|track|manage)\b/, /\bwork breakdown\b/, /\bdependenc(?:y|ies)\b/, /\bparallel track/] },
    { section: 3, patterns: [/\bsystem[s]?\b.*\b(?:design|think|build|create|automat)\b/, /\broutine[s]?\b.*\b(?:design|build|sustain|maintain)\b/, /\bprocess(?:es)?\b.*\b(?:design|optim|improv)\b/, /\bwork on (?:your|the) (?:business|system)\b/, /\bsystems? (?:versus|vs|not|over) goals?\b/] },
    { section: 4, patterns: [/\bhousehold\b/, /\bfamily\b.*\b(?:routine|system|schedule|rhythm|chore|morning|evening|bedtime|meal)\b/, /\bchore[s]?\b/, /\bmeal plan/, /\bmorning routine\b/, /\bevening routine\b/, /\bbedtime\b.*\broutine\b/, /\bhome management\b/] },
    { section: 5, patterns: [/\bfail(?:ure|s|ing)?\b.*\b(?:plan|system|routine|habit)\b/, /\bfriction\b/, /\bbottleneck[s]?\b/, /\bbreak(?:s|ing)? down\b.*\b(?:system|routine|plan)\b/, /\bobstacle[s]?\b.*\b(?:consist|follow)\b/, /\bexecutive function\b/, /\bwhy (?:plans?|routines?|systems?) (?:fail|don't work|break)\b/, /\bgap between.*knowing.*doing\b/] },
    { section: 6, patterns: [/\biterat(?:e|ion|ing)\b/, /\badjust(?:ment|ing)?\b.*\b(?:plan|system|approach)\b/, /\bexperiment[s]?\b/, /\btry.*(?:again|different)\b/, /\breflect(?:ion)?\b.*\breview\b/, /\bpivot(?:ing)?\b/, /\bcourse correct/, /\brecovery\b.*\b(?:plan|system)\b/, /\badapt(?:ing)?\b.*\bchange/] },
    { section: 7, patterns: [/\bbuy.?in\b/, /\b(?:children|kids?|teen|family)\b.*\b(?:cooperat|willing|resist|reluctant|follow|responsib)\b/, /\bwithout (?:nagging|reminding|forcing|yelling)\b/, /\bteach(?:ing)?\b.*\bresponsib/, /\bintrinsic motivation\b.*\b(?:child|kid|teen)\b/, /\bage.?appropriate\b/, /\bneurodiver(?:se|gent|sity)\b/] },
    { section: 8, patterns: [/\bhabit[s]?\b.*\b(?:build|form|loop|stack|cue|reward|trigger)\b/, /\bmotivat(?:ion|e|ing)\b/, /\bbehavio(?:r|ur)\b.*\bdesign\b/, /\bgamif/, /\bhook(?:ed)?\b.*\bmodel\b/, /\breward\b.*\b(?:loop|system)\b/, /\bidentity.?based\b.*\bhabit/, /\b(?:tiny|small|atomic)\b.*\b(?:habit|step|change)\b/] },
    { section: 9, patterns: [/\baccountabilit/, /\bcheck.?in\b/, /\btrack(?:ing)?\b.*\bprogress\b/, /\bcelebrat(?:e|ing)?\b.*\b(?:progress|milestone|win)\b/, /\bmomentum\b/, /\bsustainable pace\b/, /\bburnout\b/, /\bstreak/] },
    { section: 10, patterns: [/\bvalue[s]?\b.*\b(?:connect|align|driven|purpose|identity)\b/, /\bpurpose\b.*\b(?:plan|action|daily)\b/, /\bidentity\b.*\b(?:plan|goal|action|habit)\b/, /\bwhy\b.*\bbefore\b.*\bwhat\b/, /\bvision\b.*\b(?:daily|execution|action)\b/, /\bfaith\b.*\b(?:plan|action|steward)\b/, /\bstewardship\b/] },
    { section: 11, patterns: [/\bessential(?:ism)?\b/, /\bsimplif(?:y|ication|ied)\b/, /\beliminat(?:e|ing)\b.*\bnon.?essential/, /\bless (?:but|is) better\b/, /\bfocus(?:ing)?\b.*\bfew(?:er)?\b/, /\bcognitive (?:load|overhead)\b/, /\bmental load\b/, /\bdecision fatigue\b/] },
    { section: 12, patterns: [/\bdesign think/, /\buser.?centered\b/, /\bprototyp(?:e|ing)\b/, /\baffordance[s]?\b/, /\bfeedback loop\b/, /\biteration\b.*\bdesign\b/, /\bdefault[s]?\b.*\bdesign/] },
  ];

  for (const rule of rules) {
    for (const pat of rule.patterns) {
      if (pat.test(lower)) return rule.section;
    }
  }

  // Fallback based on book title
  const bookLower = (bookTitle || '').toLowerCase();
  if (/e-myth|traction|well-oiled|company of one|principles.*dalio/i.test(bookLower)) return 3;
  if (/household|meal plan|organize your family|habits of the household|opposite of chaos/i.test(bookLower)) return 4;
  if (/atomic habits|hooked|gamification|tiny experiments|mindset|do hard things/i.test(bookLower)) return 8;
  if (/talk so kids|siblings|good inside|raising human|whole-brain|adhd|down syndrome|teen/i.test(bookLower)) return 7;
  if (/influencer|outward mindset|coaching habit|bonds|dangerous love|nonviolent|love language|multipliers|ask powerful/i.test(bookLower)) return 7;
  if (/design of everyday|storybrand|click|inspired/i.test(bookLower)) return 12;
  if (/divine center|spiritual roots|dream giver|purpose code|mount of olives|telling yourself|happiness|intentional legacy|man's search/i.test(bookLower)) return 10;
  if (/getting things done|goals!|flow|executive functioning/i.test(bookLower)) return 1;
  if (/essentialism|effortless/i.test(bookLower)) return 11;
  if (/extreme ownership|straight.?line/i.test(bookLower)) return 9;
  if (/7 habits|covey/i.test(bookLower)) return 1;
  if (/power of consistency/i.test(bookLower)) return 9;
  if (/roles|house united|art of raising|raise a boy|nicholeen peck/i.test(bookLower)) return 4;
  if (/get er done/i.test(bookLower)) return 1;

  return 3; // default to systems
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== BigPlans PRD-29 Extraction Pull ===');
  console.log(`User: tenisewertman@gmail.com (${USER_ID})\n`);

  // Step 1: Find matching books
  console.log('Finding books...');
  const { matched, unmatched } = await findBooks();
  console.log(`Found ${matched.length} books, ${unmatched.length} search terms not found\n`);

  if (unmatched.length > 0) {
    console.log('NOT FOUND:');
    unmatched.forEach(t => console.log(`  - ${t}`));
    console.log();
  }

  // Check extraction status
  const extracted = matched.filter(b => b.extraction_status === 'completed');
  const notExtracted = matched.filter(b => b.extraction_status !== 'completed');
  console.log(`${extracted.length} with completed extractions, ${notExtracted.length} without\n`);
  if (notExtracted.length > 0) {
    console.log('NO EXTRACTIONS:');
    notExtracted.forEach(b => console.log(`  - ${b.title} (status: ${b.extraction_status || 'null'})`));
    console.log();
  }

  // Build book ID to title map (all matched, but only extracted ones will have content)
  const bookMap = Object.fromEntries(matched.map(b => [b.id, { title: b.title, author: b.author }]));
  const bookIds = matched.map(b => b.id);

  // Step 2: Fetch all extractions from target books
  console.log('Fetching extractions from target books...');
  const extractions = await fetchExtractions(bookIds);
  console.log(`  Summaries: ${extractions.summaries.length}`);
  console.log(`  Declarations: ${extractions.declarations.length}`);
  console.log(`  Frameworks: ${extractions.frameworks.length}`);
  console.log(`  Action Steps: ${extractions.actionSteps.length}`);
  console.log(`  Questions: ${extractions.questions.length}`);
  const totalFromBooks = extractions.summaries.length + extractions.declarations.length +
    extractions.frameworks.length + extractions.actionSteps.length + extractions.questions.length;
  console.log(`  TOTAL: ${totalFromBooks}\n`);

  // Step 3: Collect all direct extraction IDs to dedupe against semantic results
  const directIds = new Set();
  [...extractions.summaries, ...extractions.actionSteps, ...extractions.questions].forEach(i => directIds.add(i.id));
  extractions.declarations.forEach(i => directIds.add(i.id));
  extractions.frameworks.forEach(i => directIds.add(i.id));

  // Step 4: Run semantic searches
  console.log(`Running ${SEMANTIC_QUERIES.length} semantic searches...\n`);
  const allSemanticNovel = [];

  for (let i = 0; i < SEMANTIC_QUERIES.length; i += 5) {
    const batch = SEMANTIC_QUERIES.slice(i, i + 5);
    const results = await Promise.all(batch.map(q => semanticSearch(q)));

    for (let j = 0; j < batch.length; j++) {
      const query = batch[j];
      const novel = results[j].filter(r => !directIds.has(r.record_id));
      // Track novel results with their query for section assignment
      novel.forEach(r => { r._query = query; r._section = QUERY_TO_SECTION[query] || 3; });
      allSemanticNovel.push(...novel);
      process.stdout.write(`  [${i + j + 1}/${SEMANTIC_QUERIES.length}] "${query.substring(0, 55)}..." → ${results[j].length} total, ${novel.length} new\n`);
    }

    if (i + 5 < SEMANTIC_QUERIES.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Dedupe semantic results by record_id (keep highest similarity)
  const semanticByRecordId = {};
  for (const r of allSemanticNovel) {
    if (!semanticByRecordId[r.record_id] || r.similarity > semanticByRecordId[r.record_id].similarity) {
      semanticByRecordId[r.record_id] = r;
    }
  }
  const dedupedSemantic = Object.values(semanticByRecordId);
  console.log(`\n${allSemanticNovel.length} raw semantic results → ${dedupedSemantic.length} unique after dedup\n`);

  // Fetch full records for semantic results
  console.log('Fetching full records for semantic results...');
  const semanticFullRecords = await fetchFullRecords(dedupedSemantic);
  // Re-attach section assignment
  const semanticMeta = Object.fromEntries(dedupedSemantic.map(r => [r.record_id, { section: r._section, query: r._query }]));
  semanticFullRecords.forEach(r => {
    const meta = semanticMeta[r.id];
    if (meta) { r._section = meta.section; r._query = meta.query; }
  });
  console.log(`  ${semanticFullRecords.length} full records retrieved\n`);

  // Step 5: Organize into sections
  console.log('Organizing into sections...');
  const sections = {};
  for (let i = 1; i <= 12; i++) sections[i] = [];

  function addItem(item, type, bookId) {
    const book = bookMap[bookId || item.manifest_item_id];
    const bookTitle = book?.title || item._book_title || 'Unknown';
    const text = type === 'declaration' ? item.declaration_text : item.text;
    if (!text) return;
    const section = classifyToSection(text, bookTitle, type);

    sections[section].push({
      text,
      type,
      contentType: item.content_type || item.declaration_style || null,
      sectionTitle: item.section_title,
      bookTitle,
      author: book?.author,
      isHearted: item.is_hearted,
      userNote: item.user_note,
      valueName: item.value_name,
    });
  }

  extractions.summaries.forEach(i => addItem(i, 'summary', i.manifest_item_id));
  extractions.declarations.forEach(i => addItem(i, 'declaration', i.manifest_item_id));
  extractions.frameworks.forEach(i => addItem(i, 'framework', i.manifest_item_id));
  extractions.actionSteps.forEach(i => addItem(i, 'action_step', i.manifest_item_id));
  extractions.questions.forEach(i => addItem(i, 'question', i.manifest_item_id));

  // Add semantic results from books NOT in our target list
  for (const item of semanticFullRecords) {
    const text = item.declaration_text || item.text;
    if (!text) continue;
    const section = item._section || 3;
    const typeMap = {
      manifest_summaries: 'summary',
      manifest_declarations: 'declaration',
      ai_framework_principles: 'framework',
      manifest_action_steps: 'action_step',
      manifest_questions: 'question',
    };
    sections[section].push({
      text,
      type: typeMap[item._source_table] || 'unknown',
      contentType: item.content_type || item.declaration_style || null,
      sectionTitle: item.section_title,
      bookTitle: item._book_title || 'Unknown',
      isHearted: item.is_hearted,
      userNote: item.user_note,
      valueName: item.value_name,
      similarity: item._similarity,
      fromSemanticSearch: true,
      searchQuery: item._query,
    });
  }

  // Step 6: Generate markdown
  console.log('Generating markdown...\n');
  let md = `# BigPlans PRD-29 — Extracted Wisdom for AI Planning Assistant\n\n`;
  md += `> Generated ${new Date().toISOString().split('T')[0]} from StewardShip Manifest library (tenisewertman@gmail.com)\n`;
  md += `> ${matched.length} books matched, ${extracted.length} with extractions, ${totalFromBooks} items from target books, ${semanticFullRecords.length} additional from semantic search across full library\n\n`;

  if (unmatched.length > 0) {
    md += `## Books Not Found in Library\n\n`;
    unmatched.forEach(t => { md += `- ${t}\n`; });
    md += `\n`;
  }

  if (notExtracted.length > 0) {
    md += `## Books Found But Not Yet Extracted\n\n`;
    notExtracted.forEach(b => { md += `- ${b.title}${b.author ? ` (${b.author})` : ''} — status: ${b.extraction_status || 'null'}\n`; });
    md += `\n`;
  }

  md += `---\n\n`;

  const TYPE_LABELS = {
    summary: 'SUMMARY',
    declaration: 'DECLARATION',
    framework: 'FRAMEWORK',
    action_step: 'ACTION STEP',
    question: 'QUESTION',
  };

  let grandTotal = 0;

  for (let i = 1; i <= 12; i++) {
    const items = sections[i];
    grandTotal += items.length;
    md += `## ${i}. ${SECTIONS[i]}\n\n`;

    if (items.length === 0) {
      md += `*No extracted content classified to this section.*\n\n`;
      continue;
    }

    // Group by book for readability
    const byBook = {};
    for (const item of items) {
      const key = item.bookTitle || 'Unknown';
      if (!byBook[key]) byBook[key] = [];
      byBook[key].push(item);
    }

    const sortedBooks = Object.keys(byBook).sort();

    for (const bookTitle of sortedBooks) {
      const bookItems = byBook[bookTitle];
      md += `### ${bookTitle}\n\n`;

      for (const item of bookItems) {
        const typeLabel = TYPE_LABELS[item.type] || item.type.toUpperCase();
        const heartIcon = item.isHearted ? ' ♥' : '';
        const ctLabel = item.contentType ? ` [${item.contentType}]` : '';
        const chapterLabel = item.sectionTitle ? ` — *${item.sectionTitle}*` : '';
        const semanticNote = item.fromSemanticSearch ? ` *(via semantic search, similarity: ${item.similarity?.toFixed(3)})*` : '';

        md += `**${typeLabel}**${ctLabel}${chapterLabel}${heartIcon}${semanticNote}\n`;
        md += `${item.text}\n`;

        if (item.valueName) {
          md += `*Value: ${item.valueName}*\n`;
        }
        if (item.userNote) {
          md += `> **My Note:** ${item.userNote}\n`;
        }
        md += `\n`;
      }
    }

    md += `---\n\n`;
  }

  // Write output
  const outPath = 'bigplans_extraction_pull.md';
  writeFileSync(outPath, md, 'utf-8');
  console.log(`Done! Written to ${outPath}`);
  console.log(`Grand total items in output: ${grandTotal}\n`);

  console.log('Section breakdown:');
  for (let i = 1; i <= 12; i++) {
    console.log(`  ${i}. ${SECTIONS[i]}: ${sections[i].length} items`);
  }
}

main().catch(console.error);
