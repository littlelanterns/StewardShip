#!/usr/bin/env node
/**
 * ThoughtSift Extraction Script
 * Pulls extracted content for 5 thinking tools + cross-tool sections
 * Organized by tool → concept cluster → book
 * Filtered to tenisewertman@gmail.com
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

// ─── Tool/Section definitions ───────────────────────────────────────────────

const TOOLS = {
  'T1': 'Tool 1: Board of Directors (Persona Advisory Panel)',
  'T2': 'Tool 2: Perspective Shifter (Framework Lens Library)',
  'T3': 'Tool 3: Decision Guide (Structured Decision Frameworks)',
  'T4': 'Tool 4: Mediator (Conflict Resolution Guide)',
  'T5': 'Tool 5: Translator (Fun Rewrite Tool)',
  'X1': 'Cross-Tool: Ethics & Guardrails',
  'X2': 'Cross-Tool: Conversation Flow Patterns',
  'X3': 'Cross-Tool: Cross-Tool Frameworks',
};

const SUBSECTIONS = {
  // Tool 1
  'T1_personality': 'Personality Modeling & Communication Style',
  'T1_wisdom': 'Wisdom & Counsel Frameworks',
  'T1_voice': 'Author Voice Enrichment',
  // Tool 2
  'T2_ifs': 'IFS Parts Framework',
  'T2_ted': 'Empowerment Dynamic',
  'T2_mindset_io': 'Inward/Outward Mindset & Self-Deception',
  'T2_enneagram': 'Enneagram Lens',
  'T2_hero': "Hero's Journey",
  'T2_growth': 'Growth vs. Fixed Mindset',
  'T2_consciousness': 'Consciousness / Energy Mapping',
  'T2_meaning': 'Meaning-Making / Existential',
  'T2_family_ctx': 'Family-Context Perspective Taking',
  'T2_other_fw': 'Additional Perspective Frameworks',
  // Tool 3
  'T3_core': 'Core Decision Frameworks',
  'T3_bias': 'Cognitive Bias Awareness',
  'T3_values': 'Values & Identity Alignment',
  'T3_questions': 'Question-Based Decision Tools',
  'T3_time': 'Time & Energy Decisions',
  'T3_financial': 'Financial & Resource Decisions',
  'T3_relationship': 'Relationship & Family Decisions',
  'T3_goals': 'Goal & Planning Decisions',
  'T3_courage': 'Courage & Action',
  // Tool 4
  'T4_nvc': 'NVC / Needs-Based Communication',
  'T4_family': 'Family Conflict',
  'T4_deception': 'Self-Deception in Conflict',
  'T4_repair': 'Relationship Repair',
  'T4_workplace': 'Workplace & Non-Family Conflict',
  'T4_special': 'Special Situations (Neurodiversity, Disability, Crisis)',
  'T4_self': 'Self-Reflection for Solo Use',
  // Tool 5
  'T5_audience': 'Audience Adaptation',
  'T5_personality': 'Personality-Based Communication',
  'T5_rewrite': 'Practical Rewrites',
  // Cross-tool
  'X1_ethics': 'Ethics & Guardrails',
  'X2_flow': 'Conversation Flow Patterns',
  'X3_cross': 'Cross-Tool Frameworks',
};

// ─── Book search terms → tool mapping ───────────────────────────────────────
// Each entry: [searchTerm, [tools it belongs to]]
// Books in 2+ tools go to X3 (cross-tool) unless one tool is clearly primary

const BOOK_TOOL_MAP = [
  // Tool 1 primary
  ['Wisdom of the Enneagram', ['T1','T2','T3','T4','T5']], // cross-tool
  ['Coaching Habit', ['T1','T3','X2']], // cross-tool
  ['Ask Powerful Questions', ['T1','T4','X2']], // cross-tool
  ['How to Win Friends', ['T1','T4','X2']], // cross-tool
  ['Multipliers', ['T1','T3']], // cross-tool
  ['StandOut', ['T1']],
  ['StrengthsFinder', ['T1']],
  ['Beyond Emotional Intelligence', ['T1','T4']],

  // Tool 1 author-voice enrichment (these are also in other tools)
  ['Principles', ['T1','T3']], // Dalio - cross-tool
  ['7 Habits', ['T1','T3']], // Covey - cross-tool
  ['Mere Christianity', ['T1']],
  ['Narnia', ['T1']],
  ['Orthodoxy', ['T1']],
  ['Extreme Ownership', ['T1','T3','T4']], // cross-tool
  ['Man\'s Search for Meaning', ['T1','T2','T3']], // cross-tool
  ['Company of One', ['T1','T3']],
  ['Good Inside', ['T1','T2','T4','X1']], // cross-tool
  ['Essentialism', ['T1','T3']],
  ['Effortless', ['T1','T3']],
  ['Nonviolent Communication', ['T1','T4','X1','X2']], // cross-tool
  ['Outward Mindset', ['T1','T2','T3','T4']], // cross-tool
  ['Power vs. Force', ['T1','T2','T3']], // cross-tool
  ['Warrior of the Light', ['T1','T2']],
  ['Straight-Line Leadership', ['T1','T3']],
  ['Influencer', ['T1','T3','T4']], // cross-tool
  ['Dangerous Love', ['T1','T3','T4']], // cross-tool
  ['Critical Thinking', ['T1','T3']],
  ['Atomic Habits', ['T1','T3']],
  ['Total Money Makeover', ['T1','T3']],
  ['Thou Shall Prosper', ['T1','T3']],
  ['Building a StoryBrand', ['T1','T3']],
  ['Inspired', ['T1','T3']],
  ['Roles', ['T1','T4']],
  ['Parenting_Nicholeen Peck', ['T1','T4']],
  ['House United', ['T1','T4']],
  ['Habits of the Household', ['T1']],

  // Swedenborg
  ['Heaven and its Wonders', ['T1']],
  ['Divine Providence', ['T1','T3']],
  ['Divine Love and the Divine Wisdom', ['T1']],
  ['Conjugial Love', ['T1','T3']],
  ['Swedenborg Sampler', ['T1']],

  // Faith voices
  ['Yearning for the Living God', ['T1','T3']],
  ['God Seed', ['T1']],
  ['Light in the Wilderness', ['T1','T3']],
  ['Spiritual Lightening', ['T1']],
  ['Following Christ', ['T1','T3']],
  ['Believing Christ', ['T1','T3']],
  ['Divine Center', ['T1','T3']],
  ['Lost Mode of Prayer', ['T1','T3']],
  ['Exodus Endowment', ['T1']],
  ['Endowed with Power', ['T1']],

  // Tool 2 primary
  ['Internal Family Systems', ['T2']],
  ['You Are the One You', ['T2']],
  ['Power of TED', ['T2','T3']], // cross-tool
  ['Empowerment Dynamic', ['T2','T3']],
  ['Bonds That Make Us Free', ['T2','T4','X1']], // cross-tool
  ['Writer\'s Journey', ['T2']],
  ['Ultimate Hero', ['T2']],
  ['Twelve Steps', ['T2']],
  ['12-Steps', ['T2']],
  ['Mindset', ['T2','T3']],
  ['Emotional Agility', ['T2']],
  ['Telling Yourself the Truth', ['T2','T3','T4']],
  ['Whole-Brain Child', ['T2','T4']],
  ['80/80 Marriage', ['T2','T4']],
  ['Five Love Languages', ['T2','T4','T5']], // cross-tool
  ['5 Love Languages of Children', ['T2','T4','T5']],
  ['Now You\'re Speaking My Language', ['T2','T4','T5']],
  ['Sharing Love Abundantly', ['T2','T4']],
  ['Uniquely Human', ['T2','T4']],
  ['Emotionally Intelligent Teen', ['T2','T4','T5']],
  ['How to Talk So Kids', ['T2','T4']],
  ['Siblings Without Rivalry', ['T2','T4']],
  ['Supporting Positive Behavior', ['T2','T4']],
  ['Opposite of Chaos', ['T2','T4']],
  ['Continuum Concept', ['T2']],
  ['Redefining the Reality of Down Syndrome', ['T2','T4']],
  ['Your Forces', ['T2']],
  ['Thoughts are Things', ['T2']],
  ['My True Type', ['T2']],
  ['Flow', ['T2','T3']],
  ['The Fix', ['T2','T4']],
  ['Growth Mindset for Teens', ['T2','T5']],
  ['And There Was Light', ['T2']],
  ['Exceptional Life', ['T2']],

  // Tool 3 primary (not already listed)
  ['Seven Decisions', ['T3']],
  ['10 Ways to Make Decisions', ['T3']],
  ['Goals!', ['T3']],
  ['Tiny Experiments', ['T3']],
  ['Getting Things Done', ['T3']],
  ['Traction', ['T3']],
  ['Do Hard Things', ['T3']],
  ['Dream Giver', ['T3']],
  ['Power of Consistency', ['T3']],
  ['Hooked', ['T3']],
  ['Happiness Project', ['T3']],
  ['$100M Offers', ['T3']],
  ['$100M Leads', ['T3']],
  ['Pitch Anything', ['T3']],
  ['Click', ['T3']],
  ['Royal Path of Life', ['T3']],
  ['Self Help', ['T3']],
  ['Character', ['T3']],
  ['Art of Raising Children', ['T3']],
  ['Thomas Jefferson Education', ['T3']],
  ['Independent Homeschool', ['T3']],
  ['Learning Zone', ['T3']],
  ['Absolutely Organize', ['T3']],
  ['Executive Functioning Workbook', ['T3']],
  ['How to Meal Plan', ['T3']],
  ['Uninvited', ['T3']],
  ['Crisis & Trauma Counseling', ['T3','T4','X1']],
  ['Emotionally Destructive Marriage', ['T3','T4','X1']],
  ['How to Save Your Marriage', ['T3','T4']],
  ['Raising Human Beings', ['T3','T4']],
  ['Actionable Gamification', ['T3']],
  ['Outliers', ['T3']],
  ['Mount of Olives', ['T3']],
  ['Selling Blue Elephants', ['T3']],
  ['Made to Stick', ['T3']],
  ['E-Myth', ['T3']],
  ['Stop Worrying About Politics', ['T3']],
  ['40 Days in Heaven', ['T3']],
  ['Purpose Code', ['T3']],
  ['Intentional Legacy', ['T3']],

  // Tool 4 primary (not already listed)
  ['How to Get Your Teen to Talk', ['T4','T5']],
  ['What Radical Husbands', ['T4']],
  ['Emotional Intelligence', ['T4']],

  // Tool 5 primary (not already listed)
  ['How to Not Suck', ['T5']],
  ['Teen\'s Guide to Social Skills', ['T5']],
  ['How to Get Your Husband to Talk', ['T5']],
  ['Multiple Intelligences', ['T5']],

  // Cross-tool ethics
  ['So You Want to Raise a Boy', ['T4']],
];

// ─── Semantic queries → tool/subsection mapping ─────────────────────────────
const SEMANTIC_QUERIES = [
  // Tool 1: Board of Directors
  { q: 'what makes someone\'s communication style distinct and recognizable', tool: 'T1', sub: 'T1_personality' },
  { q: 'personality traits that shape how people give advice', tool: 'T1', sub: 'T1_personality' },
  { q: 'how values and principles shape decision-making perspective', tool: 'T1', sub: 'T1_personality' },
  { q: 'leadership philosophy and values frameworks', tool: 'T1', sub: 'T1_personality' },
  { q: 'how different personality types approach the same problem differently', tool: 'T1', sub: 'T1_personality' },
  { q: 'coaching vs advising vs directing communication modes', tool: 'T1', sub: 'T1_personality' },
  { q: 'active listening and question-asking styles', tool: 'T1', sub: 'T1_personality' },
  { q: 'what makes advice trustworthy and actionable', tool: 'T1', sub: 'T1_wisdom' },
  { q: 'wisdom and counsel from advisors and mentors', tool: 'T1', sub: 'T1_wisdom' },
  { q: 'principles for giving good counsel to others', tool: 'T1', sub: 'T1_wisdom' },
  { q: 'how to weigh conflicting advice from multiple sources', tool: 'T1', sub: 'T1_wisdom' },
  { q: 'discernment in evaluating guidance', tool: 'T1', sub: 'T1_wisdom' },
  { q: 'how this author explains their ideas and reasoning process', tool: 'T1', sub: 'T1_voice' },
  { q: 'characteristic phrases metaphors or analogies this author uses', tool: 'T1', sub: 'T1_voice' },
  { q: 'this author\'s core principles stated in their own framework', tool: 'T1', sub: 'T1_voice' },

  // Tool 2: Perspective Shifter
  { q: 'internal family systems parts and protectors', tool: 'T2', sub: 'T2_ifs' },
  { q: 'exiles managers and firefighters in IFS', tool: 'T2', sub: 'T2_ifs' },
  { q: 'self energy and the eight C\'s of self-leadership', tool: 'T2', sub: 'T2_ifs' },
  { q: 'unburdening and healing wounded parts', tool: 'T2', sub: 'T2_ifs' },
  { q: 'IFS in intimate relationships and family systems', tool: 'T2', sub: 'T2_ifs' },
  { q: 'recognizing which part is driving your reaction', tool: 'T2', sub: 'T2_ifs' },
  { q: 'victim villain hero reframe to creator challenger coach', tool: 'T2', sub: 'T2_ted' },
  { q: 'the empowerment dynamic triangle', tool: 'T2', sub: 'T2_ted' },
  { q: 'moving from victim to creator stance', tool: 'T2', sub: 'T2_ted' },
  { q: 'recognizing drama triangle patterns in your life', tool: 'T2', sub: 'T2_ted' },
  { q: 'challenger energy versus persecutor energy', tool: 'T2', sub: 'T2_ted' },
  { q: 'inward mindset outward mindset self-deception', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'seeing people as people versus objects obstacles vehicles', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'self-deception and the box', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'how we betray ourselves and justify it', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'collusion patterns in relationships', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'turning mindset outward in conflict', tool: 'T2', sub: 'T2_mindset_io' },
  { q: 'enneagram type core fears and desires', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'how each enneagram type perceives situations differently', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'enneagram stress and growth arrows', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'personality type affects how you see situations', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'enneagram wings and subtypes in real situations', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'discernment through enneagram awareness', tool: 'T2', sub: 'T2_enneagram' },
  { q: 'hero\'s journey stages and where you are in the story', tool: 'T2', sub: 'T2_hero' },
  { q: 'the ordinary world and the call to adventure', tool: 'T2', sub: 'T2_hero' },
  { q: 'threshold guardians and mentors in life transitions', tool: 'T2', sub: 'T2_hero' },
  { q: 'the ordeal death and rebirth in personal growth', tool: 'T2', sub: 'T2_hero' },
  { q: 'return with the elixir and sharing what you\'ve learned', tool: 'T2', sub: 'T2_hero' },
  { q: 'mythic structure applied to real life situations', tool: 'T2', sub: 'T2_hero' },
  { q: 'growth mindset versus fixed mindset responses', tool: 'T2', sub: 'T2_growth' },
  { q: 'the power of yet and learning orientation', tool: 'T2', sub: 'T2_growth' },
  { q: 'how mindset shapes interpretation of failure', tool: 'T2', sub: 'T2_growth' },
  { q: 'effort as path to mastery not as proof of inadequacy', tool: 'T2', sub: 'T2_growth' },
  { q: 'levels of consciousness and human behavior', tool: 'T2', sub: 'T2_consciousness' },
  { q: 'courage as the threshold between power and force', tool: 'T2', sub: 'T2_consciousness' },
  { q: 'shame guilt apathy grief fear versus courage willingness love', tool: 'T2', sub: 'T2_consciousness' },
  { q: 'calibrating emotional responses on a scale', tool: 'T2', sub: 'T2_consciousness' },
  { q: 'choosing meaning in suffering and difficulty', tool: 'T2', sub: 'T2_meaning' },
  { q: 'the space between stimulus and response', tool: 'T2', sub: 'T2_meaning' },
  { q: 'logotherapy and finding purpose', tool: 'T2', sub: 'T2_meaning' },
  { q: 'emotional agility and stepping back from reactions', tool: 'T2', sub: 'T2_meaning' },
  { q: 'cognitive reframing and perspective taking', tool: 'T2', sub: 'T2_meaning' },
  { q: 'narrative identity and the stories we tell ourselves', tool: 'T2', sub: 'T2_meaning' },
  { q: 'understanding how different personality types perceive the same situation', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'seeing through someone else\'s worldview', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'developmental stages and how children perceive adult decisions', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'how brain development affects teen perspective and behavior', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'empathy mapping for family members', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'love languages as perspective lenses', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'how sensory processing differences change perception', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'neurodiversity and different ways of experiencing the world', tool: 'T2', sub: 'T2_family_ctx' },
  { q: 'twelve step recovery as a perspective framework', tool: 'T2', sub: 'T2_other_fw' },
  { q: 'strengths-based perspective versus deficit thinking', tool: 'T2', sub: 'T2_other_fw' },
  { q: 'systems thinking and seeing the whole pattern', tool: 'T2', sub: 'T2_other_fw' },
  { q: 'abundance versus scarcity mindset', tool: 'T2', sub: 'T2_other_fw' },
  { q: 'telling yourself the truth versus believing lies', tool: 'T2', sub: 'T2_other_fw' },
  { q: 'your forces and how to use them mental energy', tool: 'T2', sub: 'T2_other_fw' },

  // Tool 3: Decision Guide
  { q: 'structured decision making process steps', tool: 'T3', sub: 'T3_core' },
  { q: 'pros and cons analysis with weighted criteria', tool: 'T3', sub: 'T3_core' },
  { q: 'how to make hard choices when options seem equal', tool: 'T3', sub: 'T3_core' },
  { q: 'principles-based decision making test against values', tool: 'T3', sub: 'T3_core' },
  { q: 'decision matrix weighted scoring method', tool: 'T3', sub: 'T3_core' },
  { q: 'SODAS decision framework situations options disadvantages advantages', tool: 'T3', sub: 'T3_core' },
  { q: 'the seven decisions that determine personal success', tool: 'T3', sub: 'T3_core' },
  { q: 'ten ways to make decisions aligned with faith', tool: 'T3', sub: 'T3_core' },
  { q: 'essentialism filter what is absolutely essential', tool: 'T3', sub: 'T3_core' },
  { q: 'effortless decision making removing unnecessary complexity', tool: 'T3', sub: 'T3_core' },
  { q: 'cognitive biases that affect decisions', tool: 'T3', sub: 'T3_bias' },
  { q: 'system 1 system 2 fast and slow thinking', tool: 'T3', sub: 'T3_bias' },
  { q: 'anchoring bias confirmation bias sunk cost fallacy', tool: 'T3', sub: 'T3_bias' },
  { q: 'intuition versus analysis when to trust your gut', tool: 'T3', sub: 'T3_bias' },
  { q: 'thin-slicing rapid cognition and snap judgments', tool: 'T3', sub: 'T3_bias' },
  { q: 'thinking traps and logical fallacies in everyday decisions', tool: 'T3', sub: 'T3_bias' },
  { q: 'how emotions distort decision making', tool: 'T3', sub: 'T3_bias' },
  { q: 'critical thinking tools for evaluating options', tool: 'T3', sub: 'T3_bias' },
  { q: 'aligning decisions with personal values and principles', tool: 'T3', sub: 'T3_values' },
  { q: 'integrity testing for choices does this match who I am', tool: 'T3', sub: 'T3_values' },
  { q: 'identity-based decision making who do I want to become', tool: 'T3', sub: 'T3_values' },
  { q: 'purpose alignment for major life decisions', tool: 'T3', sub: 'T3_values' },
  { q: 'testing decisions against your mission and calling', tool: 'T3', sub: 'T3_values' },
  { q: 'when your heart and head disagree', tool: 'T3', sub: 'T3_values' },
  { q: 'faith integration for big decisions discernment', tool: 'T3', sub: 'T3_values' },
  { q: 'asking better questions to clarify decisions', tool: 'T3', sub: 'T3_questions' },
  { q: 'powerful questions that unlock clarity', tool: 'T3', sub: 'T3_questions' },
  { q: 'the coaching question what do you really want', tool: 'T3', sub: 'T3_questions' },
  { q: 'questions to ask before making a major change', tool: 'T3', sub: 'T3_questions' },
  { q: 'what would you advise your best friend to do', tool: 'T3', sub: 'T3_questions' },
  { q: 'essential versus nonessential filtering', tool: 'T3', sub: 'T3_time' },
  { q: 'opportunity cost and saying no', tool: 'T3', sub: 'T3_time' },
  { q: 'the 80/20 principle applied to decisions', tool: 'T3', sub: 'T3_time' },
  { q: 'energy management versus time management decisions', tool: 'T3', sub: 'T3_time' },
  { q: 'when to quit and when to persevere', tool: 'T3', sub: 'T3_time' },
  { q: 'flow state as a decision signal', tool: 'T3', sub: 'T3_time' },
  { q: 'designing your work and life intentionally', tool: 'T3', sub: 'T3_time' },
  { q: 'financial decision making principles', tool: 'T3', sub: 'T3_financial' },
  { q: 'debt versus investment thinking', tool: 'T3', sub: 'T3_financial' },
  { q: 'total money makeover financial decision framework', tool: 'T3', sub: 'T3_financial' },
  { q: 'enough and sufficiency in financial decisions', tool: 'T3', sub: 'T3_financial' },
  { q: 'business decisions with limited resources', tool: 'T3', sub: 'T3_financial' },
  { q: 'company of one thinking about growth decisions', tool: 'T3', sub: 'T3_financial' },
  { q: 'making decisions that affect the whole family', tool: 'T3', sub: 'T3_relationship' },
  { q: 'collaborative decision making with a spouse', tool: 'T3', sub: 'T3_relationship' },
  { q: 'decisions about children\'s education and development', tool: 'T3', sub: 'T3_relationship' },
  { q: 'when to prioritize individual needs versus family needs', tool: 'T3', sub: 'T3_relationship' },
  { q: 'marriage decisions communication and alignment', tool: 'T3', sub: 'T3_relationship' },
  { q: 'setting goals that align with who you really are', tool: 'T3', sub: 'T3_goals' },
  { q: 'backward planning from desired outcome', tool: 'T3', sub: 'T3_goals' },
  { q: 'tiny experiments and testing before committing', tool: 'T3', sub: 'T3_goals' },
  { q: 'getting things done next action thinking', tool: 'T3', sub: 'T3_goals' },
  { q: 'traction and focus in business decisions', tool: 'T3', sub: 'T3_goals' },
  { q: 'do hard things overcoming fear in decisions', tool: 'T3', sub: 'T3_courage' },
  { q: 'the courage to act on conviction', tool: 'T3', sub: 'T3_courage' },
  { q: 'extreme ownership taking responsibility for outcomes', tool: 'T3', sub: 'T3_courage' },
  { q: 'straight-line thinking cutting through indecision', tool: 'T3', sub: 'T3_courage' },
  { q: 'the dream giver stepping into calling', tool: 'T3', sub: 'T3_courage' },
  { q: 'consistency and following through on decisions', tool: 'T3', sub: 'T3_courage' },

  // Tool 4: Mediator
  { q: 'observations feelings needs requests communication', tool: 'T4', sub: 'T4_nvc' },
  { q: 'nonviolent communication steps and process', tool: 'T4', sub: 'T4_nvc' },
  { q: 'identifying unmet needs beneath anger and frustration', tool: 'T4', sub: 'T4_nvc' },
  { q: 'making requests not demands', tool: 'T4', sub: 'T4_nvc' },
  { q: 'empathic listening and reflecting feelings', tool: 'T4', sub: 'T4_nvc' },
  { q: 'separating observation from evaluation', tool: 'T4', sub: 'T4_nvc' },
  { q: 'conflict resolution between parent and child', tool: 'T4', sub: 'T4_family' },
  { q: 'sibling conflict and fairness and jealousy', tool: 'T4', sub: 'T4_family' },
  { q: 'marriage communication breakdown and repair', tool: 'T4', sub: 'T4_family' },
  { q: 'collaborative problem solving with children', tool: 'T4', sub: 'T4_family' },
  { q: 'the explosive child plan B approach', tool: 'T4', sub: 'T4_family' },
  { q: 'how to talk so kids will listen in conflict', tool: 'T4', sub: 'T4_family' },
  { q: 'teen conflict and maintaining connection', tool: 'T4', sub: 'T4_family' },
  { q: 'blended family conflict and loyalty binds', tool: 'T4', sub: 'T4_family' },
  { q: 'self-deception in conflict seeing yourself clearly', tool: 'T4', sub: 'T4_deception' },
  { q: 'how we betray ourselves and then blame others', tool: 'T4', sub: 'T4_deception' },
  { q: 'the box and getting out of the box', tool: 'T4', sub: 'T4_deception' },
  { q: 'collusion patterns where both sides keep the conflict alive', tool: 'T4', sub: 'T4_deception' },
  { q: 'recognizing your contribution to the problem', tool: 'T4', sub: 'T4_deception' },
  { q: 'repairing relationships after conflict', tool: 'T4', sub: 'T4_repair' },
  { q: 'what the other person needs to hear', tool: 'T4', sub: 'T4_repair' },
  { q: 'apology languages and how different people receive repair', tool: 'T4', sub: 'T4_repair' },
  { q: 'rebuilding trust after betrayal or broken promises', tool: 'T4', sub: 'T4_repair' },
  { q: 'forgiveness as a process not an event', tool: 'T4', sub: 'T4_repair' },
  { q: 'when to work on a relationship and when to set boundaries', tool: 'T4', sub: 'T4_repair' },
  { q: 'workplace conflict resolution with a difficult coworker', tool: 'T4', sub: 'T4_workplace' },
  { q: 'conflict with friends or extended family', tool: 'T4', sub: 'T4_workplace' },
  { q: 'neighbor disputes and community conflict', tool: 'T4', sub: 'T4_workplace' },
  { q: 'boundary setting in conflict without escalation', tool: 'T4', sub: 'T4_workplace' },
  { q: 'influence without authority in disagreements', tool: 'T4', sub: 'T4_workplace' },
  { q: 'communicating with someone who has different sensory or processing needs', tool: 'T4', sub: 'T4_special' },
  { q: 'conflict involving neurodivergent family members', tool: 'T4', sub: 'T4_special' },
  { q: 'conflict in high-stress caregiving situations', tool: 'T4', sub: 'T4_special' },
  { q: 'emotionally destructive relationship patterns when to get help', tool: 'T4', sub: 'T4_special' },
  { q: 'crisis counseling and de-escalation', tool: 'T4', sub: 'T4_special' },
  { q: 'processing anger and frustration on your own', tool: 'T4', sub: 'T4_self' },
  { q: 'journaling through conflict for clarity', tool: 'T4', sub: 'T4_self' },
  { q: 'identifying your triggers and patterns in conflict', tool: 'T4', sub: 'T4_self' },
  { q: 'what your emotional reaction tells you about your unmet needs', tool: 'T4', sub: 'T4_self' },
  { q: 'preparing for a difficult conversation', tool: 'T4', sub: 'T4_self' },

  // Tool 5: Translator
  { q: 'communicating the same idea to different audiences', tool: 'T5', sub: 'T5_audience' },
  { q: 'age appropriate language and explanation for children', tool: 'T5', sub: 'T5_audience' },
  { q: 'how to explain complex ideas simply', tool: 'T5', sub: 'T5_audience' },
  { q: 'adjusting tone and register formal informal', tool: 'T5', sub: 'T5_audience' },
  { q: 'love languages and communication preferences', tool: 'T5', sub: 'T5_personality' },
  { q: 'personality type communication style differences', tool: 'T5', sub: 'T5_personality' },
  { q: 'how different enneagram types prefer to receive information', tool: 'T5', sub: 'T5_personality' },
  { q: 'multiple intelligences and learning style communication', tool: 'T5', sub: 'T5_personality' },
  { q: 'softening a harsh message without losing meaning', tool: 'T5', sub: 'T5_rewrite' },
  { q: 'making a request sound like an invitation', tool: 'T5', sub: 'T5_rewrite' },
  { q: 'professional versus casual communication norms', tool: 'T5', sub: 'T5_rewrite' },
  { q: 'how teens communicate differently from adults', tool: 'T5', sub: 'T5_rewrite' },

  // Cross-Tool 1: Ethics
  { q: 'the difference between guidance and manipulation', tool: 'X1', sub: 'X1_ethics' },
  { q: 'respecting autonomy in advice giving', tool: 'X1', sub: 'X1_ethics' },
  { q: 'when to refer someone to a professional instead of helping yourself', tool: 'X1', sub: 'X1_ethics' },
  { q: 'ethical boundaries in counseling and coaching', tool: 'X1', sub: 'X1_ethics' },
  { q: 'recognizing when someone needs crisis help not conversation', tool: 'X1', sub: 'X1_ethics' },
  { q: 'discernment as protection against harmful guidance', tool: 'X1', sub: 'X1_ethics' },
  { q: 'force coercion shame versus invitation encouragement', tool: 'X1', sub: 'X1_ethics' },
  { q: 'the danger of spiritual bypassing', tool: 'X1', sub: 'X1_ethics' },
  { q: 'when helping becomes controlling', tool: 'X1', sub: 'X1_ethics' },
  { q: 'healthy versus unhealthy dependency on advisors', tool: 'X1', sub: 'X1_ethics' },

  // Cross-Tool 2: Conversation Flow
  { q: 'how to ask questions that deepen thinking', tool: 'X2', sub: 'X2_flow' },
  { q: 'coaching conversation structure and flow', tool: 'X2', sub: 'X2_flow' },
  { q: 'the art of active listening and reflection', tool: 'X2', sub: 'X2_flow' },
  { q: 'when to offer advice versus ask another question', tool: 'X2', sub: 'X2_flow' },
  { q: 'how to summarize and close a coaching conversation', tool: 'X2', sub: 'X2_flow' },
  { q: 'creating psychological safety in conversation', tool: 'X2', sub: 'X2_flow' },
  { q: 'motivational interviewing techniques', tool: 'X2', sub: 'X2_flow' },
  { q: 'socratic questioning method and approach', tool: 'X2', sub: 'X2_flow' },
];

// ─── Helpers (same pattern as bigplans-extract.mjs) ─────────────────────────

async function findBooks() {
  const { data: allBooks } = await supabase
    .from('manifest_items')
    .select('id, title, author, extraction_status')
    .eq('user_id', USER_ID)
    .is('archived_at', null)
    .order('title');

  if (!allBooks) return { matched: [], unmatched: [], bookToolAssignments: {} };

  const matched = [];
  const matchedSearches = new Set();
  const bookToolAssignments = {}; // bookId → Set of tools

  for (const [search, tools] of BOOK_TOOL_MAP) {
    const lower = search.toLowerCase();
    const found = allBooks.filter(b => b.title?.toLowerCase().includes(lower));
    if (found.length > 0) {
      for (const book of found) {
        if (!matched.find(m => m.id === book.id)) {
          matched.push(book);
        }
        if (!bookToolAssignments[book.id]) bookToolAssignments[book.id] = new Set();
        tools.forEach(t => bookToolAssignments[book.id].add(t));
      }
      matchedSearches.add(search);
    }
  }

  const unmatched = BOOK_TOOL_MAP.map(([s]) => s).filter(s => !matchedSearches.has(s));
  // Dedupe unmatched
  const uniqueUnmatched = [...new Set(unmatched)];
  return { matched, unmatched: uniqueUnmatched, bookToolAssignments };
}

async function fetchAllPaginated(table, bookIds, select) {
  const allData = [];
  const batchSize = 50;
  for (let i = 0; i < bookIds.length; i += batchSize) {
    const batch = bookIds.slice(i, i + batchSize);
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table).select(select)
        .in('manifest_item_id', batch)
        .eq('user_id', USER_ID)
        .eq('is_deleted', false)
        .order('section_index').order('sort_order')
        .range(offset, offset + 999);
      if (error) { console.error(`Error ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
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
      .from('ai_frameworks').select('id, manifest_item_id')
      .in('manifest_item_id', batch).eq('user_id', USER_ID).is('archived_at', null);
    if (!fws || fws.length === 0) continue;
    const fwToBook = Object.fromEntries(fws.map(f => [f.id, f.manifest_item_id]));
    const fwIds = fws.map(f => f.id);
    for (let j = 0; j < fwIds.length; j += 50) {
      const fwBatch = fwIds.slice(j, j + 50);
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('ai_framework_principles')
          .select('id, framework_id, section_title, text, is_hearted, is_from_go_deeper, user_note')
          .in('framework_id', fwBatch).eq('user_id', USER_ID).is('archived_at', null)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('sort_order').range(offset, offset + 999);
        if (error) { console.error('Error frameworks:', error.message); break; }
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
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message);
  return json.data[0].embedding;
}

async function semanticSearch(query, matchCount = 20) {
  const embedding = await getEmbedding(query);
  const { data, error } = await supabase.rpc('match_manifest_content', {
    query_embedding: embedding, target_user_id: USER_ID,
    match_threshold: 0.25, match_count: matchCount,
  });
  if (error) { console.error(`Search failed: "${query}":`, error.message); return []; }
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
    const selects = {
      manifest_summaries: 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note',
      manifest_declarations: 'id, manifest_item_id, section_title, value_name, declaration_text, declaration_style, is_hearted, user_note',
      ai_framework_principles: 'id, framework_id, section_title, text, is_hearted, user_note',
      manifest_action_steps: 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note',
      manifest_questions: 'id, manifest_item_id, section_title, content_type, text, is_hearted, user_note',
    };
    if (!selects[table]) continue;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { data } = await supabase.from(table).select(selects[table]).in('id', batch);
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

function classifyBookContent(text, bookTitle, tools) {
  // If book only belongs to one tool, use that tool
  const toolList = [...tools];
  if (toolList.length === 1) return { tool: toolList[0], sub: getDefaultSub(toolList[0], text, bookTitle) };

  // For multi-tool books, try content-based classification
  const lower = (text + ' ' + (bookTitle || '')).toLowerCase();

  // IFS
  if (/\b(parts|protector|exile|manager|firefighter|self.?energy|ifs|internal family)\b/i.test(lower)) return { tool: 'T2', sub: 'T2_ifs' };
  // Empowerment Dynamic
  if (/\b(victim|creator|challenger|coach|drama triangle|empowerment dynamic|ted)\b/i.test(lower) && /\b(reframe|stance|role|shift)\b/i.test(lower)) return { tool: 'T2', sub: 'T2_ted' };
  // Enneagram
  if (/\benneagram\b/i.test(lower)) return { tool: 'T2', sub: 'T2_enneagram' };
  // Hero's journey
  if (/\b(hero.?s journey|ordinary world|call to adventure|ordeal|elixir|threshold)\b/i.test(lower)) return { tool: 'T2', sub: 'T2_hero' };
  // Consciousness
  if (/\b(consciousness|calibrat|power vs|force vs|hawkins)\b/i.test(lower)) return { tool: 'T2', sub: 'T2_consciousness' };

  // NVC / conflict
  if (/\b(nonviolent|nvc|observation|feeling|need|request)\b/i.test(lower) && /\bcommunicat/i.test(lower)) return { tool: 'T4', sub: 'T4_nvc' };
  if (/\b(conflict|argument|fight|disagree|repair|apolog|forgiv)\b/i.test(lower)) return { tool: 'T4', sub: 'T4_family' };
  if (/\b(self.?deception|betray|collusion|the box)\b/i.test(lower)) return { tool: 'T4', sub: 'T4_deception' };

  // Decision-making
  if (/\b(decision|decide|choose|choice|weigh|option|trade.?off|pros and cons)\b/i.test(lower)) return { tool: 'T3', sub: 'T3_core' };
  if (/\b(bias|fallacy|heuristic|system 1|system 2|cognitive trap)\b/i.test(lower)) return { tool: 'T3', sub: 'T3_bias' };
  if (/\b(financial|money|debt|invest|budget|income)\b/i.test(lower)) return { tool: 'T3', sub: 'T3_financial' };

  // Ethics/guardrails
  if (/\b(ethic|boundar|manipulat|autonomy|crisis|professional help|refer)\b/i.test(lower)) return { tool: 'X1', sub: 'X1_ethics' };

  // Coaching/conversation
  if (/\b(coaching|socratic|question.*ask|listen.*reflect|motivational interview)\b/i.test(lower)) return { tool: 'X2', sub: 'X2_flow' };

  // Communication style / personality for translation
  if (/\b(tone|register|audience|rewrite|rephrase|simplif.*explain)\b/i.test(lower)) return { tool: 'T5', sub: 'T5_audience' };

  // Default: assign to the first tool in the list
  return { tool: toolList[0], sub: getDefaultSub(toolList[0], text, bookTitle) };
}

function getDefaultSub(tool, text, bookTitle) {
  const lower = (text + ' ' + (bookTitle || '')).toLowerCase();

  switch (tool) {
    case 'T1': {
      if (/\b(personality|trait|style|type|enneagram|strength|communication)\b/i.test(lower)) return 'T1_personality';
      if (/\b(wisdom|counsel|mentor|advisor|guidance)\b/i.test(lower)) return 'T1_wisdom';
      return 'T1_voice';
    }
    case 'T2': {
      if (/\b(ifs|parts|protector|exile|self.?energy)\b/i.test(lower)) return 'T2_ifs';
      if (/\b(victim|creator|empowerment|drama)\b/i.test(lower)) return 'T2_ted';
      if (/\b(inward|outward|box|self.?deception)\b/i.test(lower)) return 'T2_mindset_io';
      if (/\benneagram\b/i.test(lower)) return 'T2_enneagram';
      if (/\b(hero|journey|quest|adventure|myth)\b/i.test(lower)) return 'T2_hero';
      if (/\b(growth|fixed|mindset|yet)\b/i.test(lower)) return 'T2_growth';
      if (/\b(consciousness|calibr|power.*force)\b/i.test(lower)) return 'T2_consciousness';
      if (/\b(meaning|purpose|suffering|stimulus.*response|existential|logotherapy)\b/i.test(lower)) return 'T2_meaning';
      if (/\b(child|teen|family|develop|age|brain)\b/i.test(lower)) return 'T2_family_ctx';
      return 'T2_other_fw';
    }
    case 'T3': {
      if (/\b(bias|fallacy|trap|system [12])\b/i.test(lower)) return 'T3_bias';
      if (/\b(value|identity|integrity|mission|purpose|faith)\b/i.test(lower)) return 'T3_values';
      if (/\b(question|ask|clarif)\b/i.test(lower)) return 'T3_questions';
      if (/\b(time|energy|essential|80.?20|say no|opportunit)\b/i.test(lower)) return 'T3_time';
      if (/\b(financial|money|debt|budget)\b/i.test(lower)) return 'T3_financial';
      if (/\b(family|spouse|marriage|children|partner)\b/i.test(lower)) return 'T3_relationship';
      if (/\b(goal|plan|backward|milestone)\b/i.test(lower)) return 'T3_goals';
      if (/\b(courage|fear|bold|ownership|discipline)\b/i.test(lower)) return 'T3_courage';
      return 'T3_core';
    }
    case 'T4': {
      if (/\b(nvc|nonviolent|feeling|need|request|observation)\b/i.test(lower)) return 'T4_nvc';
      if (/\b(self.?deception|betray|collusion|box)\b/i.test(lower)) return 'T4_deception';
      if (/\b(repair|forgiv|trust|apolog)\b/i.test(lower)) return 'T4_repair';
      if (/\b(workplace|coworker|neighbor|communit|boundar)\b/i.test(lower)) return 'T4_workplace';
      if (/\b(neurodiver|disabilit|sensory|crisis|caregiv)\b/i.test(lower)) return 'T4_special';
      if (/\b(journal|trigger|reflect|process|anger|frustrat|prepar)\b/i.test(lower)) return 'T4_self';
      return 'T4_family';
    }
    case 'T5': {
      if (/\b(personalit|type|enneagram|love language|intelligence)\b/i.test(lower)) return 'T5_personality';
      if (/\b(soften|rewrite|professional|casual|tone)\b/i.test(lower)) return 'T5_rewrite';
      return 'T5_audience';
    }
    case 'X1': return 'X1_ethics';
    case 'X2': return 'X2_flow';
    case 'X3': return 'X3_cross';
    default: return 'X3_cross';
  }
}

// Map extraction content_type to output labels
function getTypeLabel(extractionType, contentType) {
  if (extractionType === 'question') return 'question';
  if (extractionType === 'action_step') return 'action_step';
  if (extractionType === 'declaration') return 'principle';

  // For summaries and frameworks, use content_type to pick label
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('question') || ct.includes('reflection')) return 'question';
  if (ct.includes('exercise') || ct.includes('practice') || ct.includes('habit') || ct.includes('daily') || ct.includes('weekly')) return 'action_step';
  if (ct.includes('story') || ct.includes('metaphor') || ct.includes('analogy') || ct.includes('example')) return 'pattern';
  if (ct.includes('reframe') || ct.includes('insight') || ct.includes('perspective')) return 'reframe';
  if (ct.includes('principle') || ct.includes('lesson') || ct.includes('theme') || ct.includes('key_concept')) return 'principle';
  if (ct.includes('script') || ct.includes('conversation') || ct.includes('template')) return 'script';
  if (extractionType === 'framework') return 'framework';
  return 'principle';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== ThoughtSift Extraction Pull ===');
  console.log(`User: tenisewertman@gmail.com (${USER_ID})\n`);

  // Step 1: Find books
  console.log('Finding books...');
  const { matched, unmatched, bookToolAssignments } = await findBooks();
  const extracted = matched.filter(b => b.extraction_status === 'completed');
  const notExtracted = matched.filter(b => b.extraction_status !== 'completed');
  console.log(`Found ${matched.length} books (${extracted.length} extracted, ${notExtracted.length} not), ${unmatched.length} search terms not found\n`);

  if (unmatched.length > 0) {
    console.log('NOT FOUND:');
    unmatched.forEach(t => console.log(`  - ${t}`));
    console.log();
  }

  const bookMap = Object.fromEntries(matched.map(b => [b.id, { title: b.title, author: b.author }]));
  const bookIds = matched.map(b => b.id);

  // Step 2: Fetch extractions
  console.log('Fetching extractions...');
  const ext = await fetchExtractions(bookIds);
  const total = ext.summaries.length + ext.declarations.length + ext.frameworks.length + ext.actionSteps.length + ext.questions.length;
  console.log(`  S:${ext.summaries.length} D:${ext.declarations.length} F:${ext.frameworks.length} A:${ext.actionSteps.length} Q:${ext.questions.length} = ${total}\n`);

  // Collect direct IDs for dedup
  const directIds = new Set();
  [...ext.summaries, ...ext.actionSteps, ...ext.questions].forEach(i => directIds.add(i.id));
  ext.declarations.forEach(i => directIds.add(i.id));
  ext.frameworks.forEach(i => directIds.add(i.id));

  // Step 3: Semantic searches
  console.log(`Running ${SEMANTIC_QUERIES.length} semantic searches...\n`);
  const allSemanticNovel = [];

  for (let i = 0; i < SEMANTIC_QUERIES.length; i += 5) {
    const batch = SEMANTIC_QUERIES.slice(i, i + 5);
    const results = await Promise.all(batch.map(sq => semanticSearch(sq.q)));

    for (let j = 0; j < batch.length; j++) {
      const sq = batch[j];
      const novel = results[j].filter(r => !directIds.has(r.record_id));
      novel.forEach(r => { r._tool = sq.tool; r._sub = sq.sub; r._query = sq.q; });
      allSemanticNovel.push(...novel);
      process.stdout.write(`  [${i+j+1}/${SEMANTIC_QUERIES.length}] "${sq.q.substring(0,55)}..." → ${results[j].length} total, ${novel.length} new\n`);
    }

    if (i + 5 < SEMANTIC_QUERIES.length) await new Promise(r => setTimeout(r, 500));
  }

  // Dedupe
  const semanticByRecordId = {};
  for (const r of allSemanticNovel) {
    if (!semanticByRecordId[r.record_id] || r.similarity > semanticByRecordId[r.record_id].similarity) {
      semanticByRecordId[r.record_id] = r;
    }
  }
  const dedupedSemantic = Object.values(semanticByRecordId);
  console.log(`\n${allSemanticNovel.length} raw → ${dedupedSemantic.length} unique\n`);

  console.log('Fetching full semantic records...');
  const semanticFull = await fetchFullRecords(dedupedSemantic);
  const semanticMeta = Object.fromEntries(dedupedSemantic.map(r => [r.record_id, { tool: r._tool, sub: r._sub, query: r._query }]));
  semanticFull.forEach(r => {
    const m = semanticMeta[r.id];
    if (m) { r._tool = m.tool; r._sub = m.sub; r._query = m.query; }
  });
  console.log(`  ${semanticFull.length} full records\n`);

  // Step 4: Organize into tool → subsection → items
  console.log('Organizing...');
  const sections = {};
  for (const sub of Object.keys(SUBSECTIONS)) {
    sections[sub] = [];
  }

  function addDirectItem(item, type, bookId) {
    const book = bookMap[bookId || item.manifest_item_id];
    const bookTitle = book?.title || 'Unknown';
    const text = type === 'declaration' ? item.declaration_text : item.text;
    if (!text) return;

    const tools = bookToolAssignments[bookId || item.manifest_item_id];
    if (!tools) return;

    const { tool, sub } = classifyBookContent(text, bookTitle, tools);
    const typeLabel = getTypeLabel(type, item.content_type || item.declaration_style);

    if (!sections[sub]) sections[sub] = [];
    sections[sub].push({
      text, typeLabel, type,
      contentType: item.content_type || item.declaration_style || null,
      sectionTitle: item.section_title,
      bookTitle, author: book?.author,
      isHearted: item.is_hearted, userNote: item.user_note,
      valueName: item.value_name,
    });
  }

  ext.summaries.forEach(i => addDirectItem(i, 'summary', i.manifest_item_id));
  ext.declarations.forEach(i => addDirectItem(i, 'declaration', i.manifest_item_id));
  ext.frameworks.forEach(i => addDirectItem(i, 'framework', i.manifest_item_id));
  ext.actionSteps.forEach(i => addDirectItem(i, 'action_step', i.manifest_item_id));
  ext.questions.forEach(i => addDirectItem(i, 'question', i.manifest_item_id));

  // Add semantic results
  for (const item of semanticFull) {
    const text = item.declaration_text || item.text;
    if (!text) continue;
    const sub = item._sub || 'X3_cross';
    const typeMap = {
      manifest_summaries: 'summary', manifest_declarations: 'declaration',
      ai_framework_principles: 'framework', manifest_action_steps: 'action_step',
      manifest_questions: 'question',
    };
    const type = typeMap[item._source_table] || 'unknown';
    const typeLabel = getTypeLabel(type, item.content_type || item.declaration_style);

    if (!sections[sub]) sections[sub] = [];
    sections[sub].push({
      text, typeLabel, type,
      contentType: item.content_type || item.declaration_style || null,
      sectionTitle: item.section_title,
      bookTitle: item._book_title || 'Unknown',
      isHearted: item.is_hearted, userNote: item.user_note,
      similarity: item._similarity,
      fromSemanticSearch: true,
    });
  }

  // Step 5: Generate markdown
  console.log('Generating markdown...\n');
  let md = `# ThoughtSift — Extracted Wisdom for AI Thinking Tools\n\n`;
  md += `> Generated ${new Date().toISOString().split('T')[0]} from StewardShip Manifest library (tenisewertman@gmail.com)\n`;
  md += `> ${matched.length} books matched, ${extracted.length} with extractions, ${total} items from target books, ${semanticFull.length} additional from semantic search\n\n`;

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

  let grandTotal = 0;

  // Group subsections by tool
  const toolOrder = ['T1','T2','T3','T4','T5','X1','X2','X3'];
  for (const toolKey of toolOrder) {
    md += `## ${TOOLS[toolKey]}\n\n`;

    const toolSubs = Object.keys(SUBSECTIONS).filter(s => s.startsWith(toolKey));
    let toolTotal = 0;

    for (const sub of toolSubs) {
      const items = sections[sub] || [];
      toolTotal += items.length;
      grandTotal += items.length;

      md += `### ${SUBSECTIONS[sub]}\n\n`;

      if (items.length === 0) {
        md += `*No extracted content for this subsection.*\n\n`;
        continue;
      }

      // Group by book
      const byBook = {};
      for (const item of items) {
        const key = item.bookTitle || 'Unknown';
        if (!byBook[key]) byBook[key] = [];
        byBook[key].push(item);
      }

      for (const bookTitle of Object.keys(byBook).sort()) {
        const bookItems = byBook[bookTitle];
        md += `#### ${bookTitle}\n\n`;

        for (const item of bookItems) {
          const heartIcon = item.isHearted ? ' ♥' : '';
          const chapterLabel = item.sectionTitle ? ` — *${item.sectionTitle}*` : '';
          const semanticNote = item.fromSemanticSearch ? ` *(semantic search, sim: ${item.similarity?.toFixed(3)})*` : '';

          md += `**[${item.typeLabel}]**${chapterLabel}${heartIcon}${semanticNote}\n`;
          md += `${item.text}\n`;

          if (item.valueName) md += `*Value: ${item.valueName}*\n`;
          if (item.userNote) md += `> **My Note:** ${item.userNote}\n`;
          md += `\n`;
        }
      }
    }

    md += `*${toolTotal} items in this tool section.*\n\n---\n\n`;
  }

  writeFileSync('thoughtsift_extraction_pull.md', md, 'utf-8');
  console.log(`Done! Written to thoughtsift_extraction_pull.md`);
  console.log(`Grand total: ${grandTotal} items\n`);

  console.log('Per-tool breakdown:');
  for (const toolKey of toolOrder) {
    const toolSubs = Object.keys(SUBSECTIONS).filter(s => s.startsWith(toolKey));
    const count = toolSubs.reduce((a, s) => a + (sections[s]?.length || 0), 0);
    console.log(`  ${TOOLS[toolKey]}: ${count}`);
  }
  console.log('\nPer-subsection:');
  for (const sub of Object.keys(SUBSECTIONS)) {
    console.log(`  ${sub}: ${sections[sub]?.length || 0} — ${SUBSECTIONS[sub]}`);
  }
}

main().catch(console.error);
