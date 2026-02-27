/**
 * CaptainsBriefing — Beginner's Guide to StewardShip
 *
 * A nautical-themed walkthrough that introduces new users to every feature
 * in a suggested setup order. Accessible from Settings > Help/Guide.
 *
 * CRITICAL: CSS variables only — theme compatible.
 * No emoji — text-based buttons only (per adult interface rules).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ArrowRight,
  Anchor,
  Star,
  MessageCircle,
  BookOpen,
  Compass,
  BarChart3,
  Sun,
  Moon,
  Layers,
  Users,
  Heart,
  Shield,
  FileText,
  Map,
  CircleDot,
  Calendar,
  Bell,
  ClipboardList,
  Lightbulb,
  Brain,
  Eye,
  Award
} from 'lucide-react';
import './CaptainsBriefing.css';

/* ============================================
   TYPES
   ============================================ */

interface SubTool {
  name: string;
  brief: string;
  detail: string;
}

interface Feature {
  name: string;
  icon: React.ReactNode;
  description: string;
  connections: string;
  route: string;
  subTools?: SubTool[];
}

interface VoyageStage {
  number: number;
  name: string;
  tagline: string;
  narrative: string;
  features: Feature[];
}

/* ============================================
   VOYAGE DATA
   ============================================ */

const VOYAGE_STAGES: VoyageStage[] = [
  {
    number: 1,
    name: 'Chart Your Course',
    tagline: 'The Mast and The Keel',
    narrative:
      'Before a ship sets sail, the captain must know two things: where they\'re headed and what keeps them steady in the water. Your Mast holds your guiding principles — the north star you navigate by. Your Keel holds your self-knowledge — the ballast that keeps you upright when seas get rough. Set these first, and everything the AI does for you becomes personal.',
    features: [
      {
        name: 'The Mast — Your Guiding Principles',
        icon: <Star size={18} />,
        description:
          'Your values, declarations, faith foundations, and vision statements. These aren\'t affirmations — they\'re honest commitments about who you\'re choosing to become. The AI references your Mast in every conversation, grounding its advice in what matters most to you.',
        connections:
          'Feeds into: Every AI conversation, Reveille morning thoughts, Safe Harbor grounding, Rigging plan alignment.',
        route: '/mast',
        subTools: [
          {
            name: 'Craft at Helm',
            brief: 'AI-guided declaration writing',
            detail:
              'Opens a guided conversation where the AI helps you articulate a principle in honest commitment language. It asks what matters, why it matters, and helps you shape it into words that resonate — then saves it directly to your Mast.',
          },
          {
            name: 'Manifest-to-Mast',
            brief: 'Extract principles from your reading',
            detail:
              'When you upload a book or article to The Manifest, you can choose to extract key principles and add them to your Mast. The AI identifies the core ideas and presents them for your review before saving.',
          },
        ],
      },
      {
        name: 'The Keel — Know Yourself',
        icon: <Anchor size={18} />,
        description:
          'Your personality assessments, traits, strengths, growth areas, and professional self-knowledge. Upload test results, journal what you\'ve observed, or let the AI help you discover patterns through conversation. Contradictions are welcome — people are complex.',
        connections:
          'Feeds into: AI personalization, Safe Harbor processing style, relationship advice, career guidance.',
        route: '/keel',
        subTools: [
          {
            name: 'Self-Discovery at Helm',
            brief: 'AI-guided personality exploration',
            detail:
              'A guided conversation where the AI asks thoughtful questions about how you think, react, and process. It identifies patterns, compiles its findings, and presents a summary for you to edit and confirm before anything is saved.',
          },
          {
            name: 'File Upload',
            brief: 'Import assessment results',
            detail:
              'Upload PDFs or images of personality tests (Enneagram, MBTI, StrengthsFinder, etc.). The AI generates a structured summary you can review and edit. The original file is stored, and the summary becomes part of your Keel.',
          },
        ],
      },
    ],
  },
  {
    number: 2,
    name: 'Take the Wheel',
    tagline: 'The Helm — Your AI Companion',
    narrative:
      'Every great captain has a trusted advisor — someone who knows the charts, remembers the journey, and speaks plainly. The Helm is yours. It\'s not just a chat window; it\'s the engine that powers guided processes throughout the entire ship. The more it knows about you, the more useful it becomes.',
    features: [
      {
        name: 'The Helm — Your AI Companion',
        icon: <MessageCircle size={18} />,
        description:
          'Talk through anything — plans, decisions, struggles, celebrations. The AI knows your principles, personality, goals, tasks, journal, and relationships. It loads relevant context automatically based on what you\'re discussing. Available as a pull-up drawer from any page, or as a dedicated full-screen page.',
        connections:
          'Connected to: Everything. The Helm reads from and can write to almost every feature in the app.',
        route: '/helm',
        subTools: [
          {
            name: 'Guided Modes',
            brief: 'Specialized conversations for specific tasks',
            detail:
              'The Helm can enter guided modes that structure the conversation for a purpose: writing declarations (Mast), self-discovery (Keel), change processes (Wheel), life assessment (Life Inventory), project planning (Rigging), brain dumps (Unload the Hold), relationship tools (First Mate), meeting facilitation, and crisis support (Safe Harbor). Each mode adjusts the AI\'s approach and what context it loads.',
          },
          {
            name: 'Voice Input',
            brief: 'Speak instead of type',
            detail:
              'Tap the microphone icon to record your thoughts. Your audio is transcribed and sent as a message. Available in both the Helm and The Log for hands-free journaling or conversation.',
          },
          {
            name: 'Helm Drawer',
            brief: 'Access from any page',
            detail:
              'A pull-up drawer at the bottom of every page gives you instant access to the AI without leaving what you\'re doing. The AI knows which page you\'re on and adjusts its context accordingly. Expand to full screen for longer conversations.',
          },
        ],
      },
    ],
  },
  {
    number: 3,
    name: 'Keep the Log',
    tagline: 'The Log — A Record of the Voyage',
    narrative:
      'Every captain keeps a log — not because someone requires it, but because the voyage is worth recording. Your Log is a universal inbox for thoughts, gratitude, reflections, meeting notes, and anything else worth capturing. Write it down, then decide what to do with it.',
    features: [
      {
        name: 'The Log — Your Journal',
        icon: <BookOpen size={18} />,
        description:
          'Capture anything: journal entries, gratitude, reflections, quick notes, meeting notes, or voice recordings. After saving, you can route entries to other features — create a task, flag a victory, save a principle to your Mast, or add self-knowledge to your Keel. The AI auto-tags your entries by life area.',
        connections:
          'Routes to: Compass (tasks), Mast (principles), Keel (self-knowledge), Victory Recorder, Reminders.',
        route: '/log',
        subTools: [
          {
            name: 'Entry Routing',
            brief: 'Send entries to other features after saving',
            detail:
              'After saving a Log entry, routing options appear: create a Compass task from it, save a principle to your Mast, add self-knowledge to your Keel, flag it as a victory, or set a reminder. Your original entry stays in the Log — routing creates a new item in the destination.',
          },
          {
            name: 'Voice Recording',
            brief: 'Speak your journal entries',
            detail:
              'Tap the microphone to record your thoughts. The audio is transcribed and saved as a Log entry. Perfect for capturing ideas on the go or processing thoughts aloud.',
          },
        ],
      },
    ],
  },
  {
    number: 4,
    name: 'Set Your Compass',
    tagline: 'Navigate Your Daily Actions',
    narrative:
      'A compass doesn\'t tell you what to do — it shows you which direction you\'re facing so you can decide where to go. Your Compass holds every task and to-do, but what makes it powerful is the seven different ways you can view the same list. Switch frameworks to see your priorities through a different lens.',
    features: [
      {
        name: 'The Compass — Task Management',
        icon: <Compass size={18} />,
        description:
          'Your daily action hub. Quick-add tasks with minimal friction, and the AI suggests life area tags automatically. Toggle between seven prioritization views — same tasks, different frameworks — to find what needs your attention right now.',
        connections:
          'Fed by: Log routing, Helm suggestions, Rigging milestones, Unload the Hold triage. Feeds into: Crow\'s Nest summary, Charts tracking, Reveille/Reckoning priorities.',
        route: '/compass',
        subTools: [
          {
            name: 'View Toggles (7 Frameworks)',
            brief: 'Simple List, By Category, Eisenhower, Eat the Frog, 1-3-9, Big Rocks, Ivy Lee',
            detail:
              'Each view organizes your same tasks using a different prioritization philosophy. Simple List shows everything flat. Eisenhower Matrix sorts by urgency and importance. Eat the Frog puts your hardest task front and center. One-Three-Nine limits you to one big thing, three medium, and nine small. Big Rocks ensures the important things go in first. Ivy Lee picks your top six for tomorrow. Long-press any toggle for a description of the framework.',
          },
          {
            name: 'Task Breaker',
            brief: 'AI breaks big tasks into smaller steps',
            detail:
              'Select any task and tap "Break Down." The AI decomposes it into manageable subtasks at three detail levels: quick (3-5 steps), detailed (5-10 steps), or granular (10+ steps). Created subtasks appear as children of the original task in your Compass.',
          },
          {
            name: 'Lists',
            brief: 'Flexible shareable lists beyond tasks',
            detail:
              'Create standalone lists for anything — grocery lists, packing lists, project checklists, or reference lists. Lists live under a separate "Lists" tab in the Compass. They can be shared with others via a link.',
          },
          {
            name: 'Routines',
            brief: 'Reusable checklists that reset on schedule',
            detail:
              'Turn any list into a routine with a schedule — daily, weekdays, weekly, or custom. Routines reset automatically and can appear as cards in your Compass views. They track streaks and generate auto-victories when completed. Perfect for morning routines, workout checklists, or weekly reviews.',
          },
        ],
      },
    ],
  },
  {
    number: 5,
    name: 'Scan the Horizon',
    tagline: 'See Where You\'ve Been and Where You\'re Headed',
    narrative:
      'From the crow\'s nest, a lookout can see the whole ocean. These three features give you that vantage point — your dashboard for today, your progress over time, and a record of every win along the way.',
    features: [
      {
        name: 'Crow\'s Nest — Your Dashboard',
        icon: <Eye size={18} />,
        description:
          'Your daily command center. Summary cards surface what\'s happening across every feature — today\'s tasks, active streaks, recent victories, goal progress, journal snapshots, and a rotating thought from your Mast. Cards only appear when they have data, so it fills in naturally as you use the app.',
        connections:
          'Reads from: Every major feature. The Crow\'s Nest is read-only — it aggregates, never creates.',
        route: '/',
      },
      {
        name: 'Charts — Track Your Progress',
        icon: <BarChart3 size={18} />,
        description:
          'Visualize your journey with task completion rates, active streaks, goal progress bars, victory summaries, and journal activity over time. Create custom trackers to measure anything daily — count, yes/no, or scale type.',
        connections:
          'Reads from: Compass tasks, Victories, Log entries. Custom trackers prompt in Reveille and Reckoning.',
        route: '/charts',
        subTools: [
          {
            name: 'Goals',
            brief: 'Track progress toward measurable objectives',
            detail:
              'Set goals with a target value and track progress over time. Goals appear on your Charts page and in the Crow\'s Nest. Progress updates can come from manual entry or automatically from connected tasks.',
          },
          {
            name: 'Custom Trackers',
            brief: 'Track anything daily with count, yes/no, or scale',
            detail:
              'Create a tracker for anything you want to measure — glasses of water, hours of sleep, mood rating, pages read. Trackers prompt you during Reveille and Reckoning so you don\'t forget. Data feeds into Charts for visualization over time.',
          },
        ],
      },
      {
        name: 'Victory Recorder — Celebrate Your Wins',
        icon: <Award size={18} />,
        description:
          'Record accomplishments large and small. The AI generates identity-based celebration text that connects your wins to your principles — not generic praise, but recognition rooted in who you\'re becoming. Victories can come from manual entry, Log routing, task completion, or routine completion.',
        connections:
          'Fed by: Log routing, Compass completions, Routine completions. Feeds into: Crow\'s Nest, Charts, Reckoning Victory Review.',
        route: '/victories',
      },
    ],
  },
  {
    number: 6,
    name: 'Morning and Evening Watch',
    tagline: 'The Daily Rhythms of a Well-Run Ship',
    narrative:
      'A ship runs on watches — set times when the crew takes stock, adjusts course, and prepares for what\'s ahead. Your morning Reveille and evening Reckoning bookend each day with intention. They\'re brief, they\'re optional, and they keep you anchored.',
    features: [
      {
        name: 'Reveille — Morning Briefing',
        icon: <Sun size={18} />,
        description:
          'A morning card that greets you with a thought from your Mast, shows today\'s priorities, displays active streaks to maintain, and prompts for any custom trackers. It sets the tone for the day without demanding anything. Configurable in Settings — you can adjust timing or disable it entirely.',
        connections:
          'Reads from: Mast, Compass, Charts (streaks and trackers), Reminders, First Mate (spouse prompts).',
        route: '/reveille',
      },
      {
        name: 'Reckoning — Evening Review',
        icon: <Moon size={18} />,
        description:
          'An evening card for reviewing the day. Triage today\'s victories, carry forward incomplete tasks, set tomorrow\'s top priorities, log a prompted journal entry, and update your trackers. Includes a Victory Review — the AI weaves your day\'s wins into a brief narrative.',
        connections:
          'Reads from: Compass, Log, Victories, Charts. Writes to: Compass (tomorrow\'s priorities), Log (prompted entries).',
        route: '/reckoning',
      },
      {
        name: 'Reflections — Daily Contemplation',
        icon: <Lightbulb size={18} />,
        description:
          'A lighter daily practice alongside Reveille and Reckoning. Each day presents a thoughtful question for contemplation. Write your response, and over time build a personal collection of reflections you can revisit. No pressure, no streak guilt — just a quiet moment of self-examination.',
        connections:
          'Standalone practice. Responses appear in your weekly Reports summary.',
        route: '/reflections',
      },
    ],
  },
  {
    number: 7,
    name: 'Plot Deeper Waters',
    tagline: 'Tools for Transformation and Planning',
    narrative:
      'Some journeys require more than a daily compass heading. When you\'re ready to chart a deeper course — changing a pattern, assessing your whole life, planning a major project, or building your personal library of wisdom — these tools are waiting. There\'s no rush. They\'ll be here when you need them.',
    features: [
      {
        name: 'The Wheel — Deep Change Process',
        icon: <CircleDot size={18} />,
        description:
          'A structured six-spoke process for meaningful personal change, based on the Change Wheel framework. Start by describing what you want to change, then work through each spoke: Why, When, Self-Inventory, Support, Evidence, and Becoming. Periodic Rim check-ins assess your progress across all spokes.',
        connections:
          'Uses: Mast (alignment), Keel (self-inventory), Helm (guided conversations). Feeds into: Compass tasks, Reveille/Reckoning nudges.',
        route: '/wheel',
        subTools: [
          {
            name: 'The Six Spokes',
            brief: 'Why, When, Self-Inventory, Support, Evidence, Becoming',
            detail:
              'Each spoke explores a different dimension of change. Why examines motivation. When explores timing and triggers. Self-Inventory maps your current reality. Support identifies who can help. Evidence defines how you\'ll know it\'s working. Becoming envisions who you\'re growing into. The AI guides you through each spoke in conversation.',
          },
          {
            name: 'Rim Check-In',
            brief: 'Periodic progress assessment across all spokes',
            detail:
              'After roughly two weeks, the Rim check-in invites you to assess progress on each spoke. It\'s not a test — it\'s a honest look at where you are in the change process, what\'s shifted, and where to focus next.',
          },
        ],
      },
      {
        name: 'Life Inventory — Where You Stand',
        icon: <Map size={18} />,
        description:
          'An honest assessment of where you are across every area of life — spiritual, marriage, family, health, career, financial, social, and more. No ratings or scales. Just three columns: where you were (baseline), where you are (current), and where you\'re heading (vision). The AI helps you explore each area through conversation.',
        connections:
          'Uses: Helm (guided assessment). Feeds into: AI context for relevant conversations, Quarterly Inventory rhythm.',
        route: '/life-inventory',
      },
      {
        name: 'Rigging — Plan Your Projects',
        icon: <Layers size={18} />,
        description:
          'For goals and projects that need real planning. The AI helps you choose the right framework — milestones, prioritization, obstacle mapping, or decision analysis — then breaks the plan into actionable steps. Connected to your Mast so plans stay aligned with what matters.',
        connections:
          'Uses: Mast (alignment), Manifest (reference material). Feeds into: Compass tasks via Task Breaker, Reveille/Reckoning milestone nudges.',
        route: '/rigging',
        subTools: [
          {
            name: 'Five Planning Frameworks',
            brief: 'MoSCoW, Backward Planning, Milestones, Pre-mortem, 10-10-10',
            detail:
              'MoSCoW prioritizes what Must, Should, Could, or Won\'t happen. Backward Planning works from the desired end state. Milestone Mapping creates phases with checkpoints. Obstacle Pre-mortem anticipates what could go wrong and plans mitigation. 10-10-10 Decision Framework evaluates impact at 10 days, 10 months, and 10 years. The AI selects appropriate frameworks based on what you describe — or combines them.',
          },
        ],
      },
      {
        name: 'The Manifest — Your Knowledge Base',
        icon: <FileText size={18} />,
        description:
          'Upload books, articles, notes, and documents. The AI processes and indexes them so it can draw on your personal library during conversations. Extract frameworks to teach the AI new principles. Over time, the AI grows wiser as your library grows.',
        connections:
          'Feeds into: Helm (relevant passages in conversation), Mast (extracted principles), Keel (personality data), Safe Harbor (wisdom), Reveille (thoughts).',
        route: '/manifest',
        subTools: [
          {
            name: 'Intake Flow',
            brief: 'AI asks how to use each upload',
            detail:
              'When you upload something, the AI asks what to do with it: keep as general reference, extract principles for your Mast, inform your Keel, connect to a specific goal or Wheel, or just store for later. This ensures your library stays organized and useful.',
          },
          {
            name: 'Framework Extraction',
            brief: 'Teach the AI new principles from your reading',
            detail:
              'The AI reads your uploaded material, extracts key principles and tools, and presents them for your confirmation. Confirmed frameworks become part of the AI\'s toolkit — loaded alongside your Mast in every conversation. You control which frameworks are active.',
          },
        ],
      },
    ],
  },
  {
    number: 8,
    name: 'Know Your Crew',
    tagline: 'The People Sailing With You',
    narrative:
      'No captain sails alone. The people in your life — your partner, your family, your mentors, your community — shape the voyage as much as any wind or current. These tools help you invest in those relationships with the same intentionality you bring to everything else.',
    features: [
      {
        name: 'First Mate — Your Relationship Partner',
        icon: <Heart size={18} />,
        description:
          'Build a profile of your spouse or partner through conversation, uploads, and observations. The AI uses this to help you love better — planning dates, writing encouragement, noticing patterns, and preparing for important conversations. Only appears if your relationship status includes a partner.',
        connections:
          'Uses: Keel (your communication style), Helm (guided modes). Feeds into: Reveille (spouse prompts), Couple Meetings.',
        route: '/first-mate',
        subTools: [
          {
            name: 'Marriage Toolbox',
            brief: 'Guided modes for relationship goals',
            detail:
              'A collection of AI-guided conversation modes focused on your relationship: planning quality time, choosing gifts, observing and serving, expressing words of affirmation, and capturing gratitude. Each mode loads your spouse\'s profile so the AI\'s suggestions are personal, not generic.',
          },
          {
            name: 'Cyrano Me',
            brief: 'AI helps you find the right words',
            detail:
              'Named after Cyrano de Bergerac — the AI helps you craft messages, texts, letters, or words of encouragement for your spouse. It draws on what it knows about both of you to suggest words that will land, not just sound nice. You always edit and send yourself.',
          },
          {
            name: 'Spouse Questions',
            brief: 'Conversation starters and deeper connection',
            detail:
              'Curated questions designed to spark meaningful conversation with your partner — from light and fun to deep and vulnerable. Use them at dinner, on walks, or during your Couple Meeting.',
          },
        ],
      },
      {
        name: 'Crew — Your People',
        icon: <Users size={18} />,
        description:
          'Profiles for the important people in your life — family, friends, mentors, colleagues. Add context the AI can reference when you\'re discussing someone: personality notes, relationship dynamics, important dates, and communication preferences.',
        connections:
          'Feeds into: Helm (loaded when discussing specific people), Reminders (important dates), Meeting notes.',
        route: '/crew',
        subTools: [
          {
            name: 'Higgins — Communication Coach',
            brief: 'AI helps you navigate conversations with anyone',
            detail:
              'Named after Professor Higgins — two modes for any crew member. "Say This" helps you craft what to say in a specific situation, drawing on what the AI knows about that person. "Navigate This" helps you think through a complex interpersonal situation before acting. The AI loads that person\'s profile for personalized guidance.',
          },
          {
            name: 'Sphere of Influence',
            brief: 'Visualize your relationship landscape',
            detail:
              'An alternate view within Crew that maps your relationships by influence and proximity. See who\'s in your inner circle, identify gaps in your support network, and set a current focus person. The AI references your Sphere when discussing relationships and boundaries.',
          },
        ],
      },
    ],
  },
  {
    number: 9,
    name: 'When Storms Come',
    tagline: 'Safe Harbor — A Port in Every Storm',
    narrative:
      'Every voyage meets rough weather. Safe Harbor is not a sign of weakness — it\'s the wisdom of a seasoned captain who knows when to seek shelter, regroup, and wait for the storm to pass. This space is different from the rest of the app. The AI shifts its approach here: validating first, offering perspective only when you\'re ready, and always pointing you toward the people and faith that anchor you.',
    features: [
      {
        name: 'Safe Harbor — When Seas Get Rough',
        icon: <Shield size={18} />,
        description:
          'A specialized space for processing stress, difficult emotions, or hard seasons. The AI uses a three-tier safety system: capacity building for everyday stress, professional support suggestions when things are heavier, and immediate crisis resources when needed. It draws on your Mast, Keel, and Manifest for grounding, and always redirects toward human connection and faith.',
        connections:
          'Uses: Mast, Keel, Manifest, First Mate, Crew, Wheel, Life Inventory. Routes to: Log (processing notes), Compass (action items), Keel (self-insights), Victory Recorder (overcoming).',
        route: '/safe-harbor',
        subTools: [
          {
            name: 'Three-Tier Safety',
            brief: 'Capacity building, professional support, crisis resources',
            detail:
              'Tier 1 helps build coping capacity for everyday stress and frustration. Tier 2 gently suggests professional support when the situation warrants it. Tier 3 activates immediately for crisis indicators — all coaching stops and concrete resources are provided. Tier 3 applies everywhere in the app, not just Safe Harbor.',
          },
        ],
      },
    ],
  },
  {
    number: 10,
    name: 'Your Ship\'s Operations',
    tagline: 'Keep Everything Running Smoothly',
    narrative:
      'A well-run ship has systems — scheduled meetings, reliable reminders, regular reports, and a way to clear the decks when things pile up. These operational tools keep the voyage sustainable over the long haul.',
    features: [
      {
        name: 'Meeting Frameworks — Structured Sessions',
        icon: <Calendar size={18} />,
        description:
          'Templates for recurring meetings: Couple Meetings with your spouse, Parent-Child check-ins, Weekly Reviews, Monthly Reviews, Business meetings, and custom templates you create. Each meeting type loads relevant context and guides the conversation with prompts and note-taking.',
        connections:
          'Uses: First Mate (couple meetings), Crew (parent-child meetings). Notes save to: Log, linked Crew members.',
        route: '/meetings',
      },
      {
        name: 'Reminders — Nudges and Prompts',
        icon: <Bell size={18} />,
        description:
          'A reminder engine that generates daily nudges from your tasks, meetings, important dates, Wheel progress, Rigging milestones, and streaks. Push notifications keep you informed without being overwhelming — with frequency capping and quiet hours built in. All reminders follow "merciful defaults": overdue nudges back off if ignored.',
        connections:
          'Reads from: Compass, Meetings, Crew dates, Wheel, Rigging, Charts streaks.',
        route: '/settings',
      },
      {
        name: 'Reports — Weekly Summaries',
        icon: <ClipboardList size={18} />,
        description:
          'Generate progress reports that pull from across the app — task completion, victories, journal highlights, reflection responses, routine performance, and more. A snapshot of your week in one view.',
        connections:
          'Reads from: Compass, Victories, Log, Reflections, Routines, Charts.',
        route: '/reports',
      },
      {
        name: 'Unload the Hold — Brain Dump',
        icon: <Brain size={18} />,
        description:
          'When your mind is overflowing, dump everything into the Helm and let the AI sort it out. Talk or type everything that\'s on your mind. The AI triages your thoughts into categories — tasks, ideas, concerns, things to discuss — and presents a structured review where you can route each item to the right place in batch.',
        connections:
          'Routes to: Compass (tasks), Log (notes), Crew (conversations), Reminders, First Mate (relationship items).',
        route: '/unload-the-hold',
      },
    ],
  },
];

/* ============================================
   COMPONENT
   ============================================ */

const CaptainsBriefing: React.FC = () => {
  const navigate = useNavigate();
  const [openStages, setOpenStages] = useState<Set<number>>(new Set());
  const [openSubTools, setOpenSubTools] = useState<Set<string>>(new Set());

  const toggleStage = (stageNumber: number) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageNumber)) {
        next.delete(stageNumber);
      } else {
        next.add(stageNumber);
      }
      return next;
    });
  };

  const toggleSubTool = (key: string) => {
    setOpenSubTools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="captains-briefing">
      {/* Header */}
      <div className="captains-briefing__header">
        <button
          className="captains-briefing__back-btn"
          onClick={() => navigate('/settings')}
        >
          <ChevronLeft size={16} />
          Settings
        </button>
        <h1 className="captains-briefing__title">The Captain's Briefing</h1>
        <p className="captains-briefing__subtitle">
          Your guide to every feature aboard StewardShip — in the order that
          makes the voyage meaningful.
        </p>
      </div>

      {/* Intro */}
      <div className="captains-briefing__intro">
        <p className="captains-briefing__intro-text">
          StewardShip is a personal growth system built around one idea: you are
          the captain of your own voyage. The tools here help you define where
          you're headed, manage the daily work of getting there, track your
          progress, invest in your relationships, and process the hard days when
          they come.
        </p>
        <p className="captains-briefing__intro-text">
          You don't need to use everything at once. Start with the first two
          stages — your principles and your AI companion — and let the rest fill
          in naturally as the voyage unfolds. Each section below explains what a
          feature does, how it connects to the others, and gives you a direct
          link to try it.
        </p>
      </div>

      {/* Voyage Stages */}
      <div className="captains-briefing__stages">
        {VOYAGE_STAGES.map((stage) => {
          const isOpen = openStages.has(stage.number);

          return (
            <div
              key={stage.number}
              className={`captains-briefing__stage${isOpen ? ' captains-briefing__stage--open' : ''}`}
            >
              {/* Stage header */}
              <button
                className="captains-briefing__stage-header"
                onClick={() => toggleStage(stage.number)}
                aria-expanded={isOpen}
              >
                <span className="captains-briefing__stage-number">
                  {stage.number}
                </span>
                <div className="captains-briefing__stage-title-group">
                  <h2 className="captains-briefing__stage-name">
                    {stage.name}
                  </h2>
                  <p className="captains-briefing__stage-tagline">
                    {stage.tagline}
                  </p>
                </div>
                <ChevronDown
                  size={20}
                  className="captains-briefing__stage-chevron"
                />
              </button>

              {/* Stage body */}
              <div className="captains-briefing__stage-body">
                <div className="captains-briefing__stage-content">
                  <p className="captains-briefing__narrative">
                    {stage.narrative}
                  </p>

                  <div className="captains-briefing__features">
                    {stage.features.map((feature, fIdx) => (
                      <div key={fIdx} className="captains-briefing__feature">
                        <h3 className="captains-briefing__feature-name">
                          <span className="captains-briefing__feature-icon">
                            {feature.icon}
                          </span>
                          {feature.name}
                        </h3>
                        <p className="captains-briefing__feature-desc">
                          {feature.description}
                        </p>
                        <p className="captains-briefing__feature-connections">
                          {feature.connections}
                        </p>

                        {/* Sub-tools */}
                        {feature.subTools && feature.subTools.length > 0 && (
                          <div className="captains-briefing__subtools">
                            {feature.subTools.map((sub, sIdx) => {
                              const subKey = `${stage.number}-${fIdx}-${sIdx}`;
                              const subOpen = openSubTools.has(subKey);

                              return (
                                <div
                                  key={sIdx}
                                  className={`captains-briefing__subtool${subOpen ? ' captains-briefing__subtool--open' : ''}`}
                                >
                                  <button
                                    className="captains-briefing__subtool-header"
                                    onClick={() => toggleSubTool(subKey)}
                                    aria-expanded={subOpen}
                                  >
                                    <span className="captains-briefing__subtool-name">
                                      {sub.name}
                                    </span>
                                    <span className="captains-briefing__subtool-brief">
                                      — {sub.brief}
                                    </span>
                                    <span className="captains-briefing__subtool-expand">
                                      {subOpen ? 'Less' : 'More'}
                                    </span>
                                  </button>
                                  <div className="captains-briefing__subtool-detail">
                                    <p className="captains-briefing__subtool-detail-text">
                                      {sub.detail}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Go there now */}
                        <button
                          className="captains-briefing__go-link"
                          onClick={() => navigate(feature.route)}
                        >
                          Go there now
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Closing */}
      <div className="captains-briefing__closing">
        <p className="captains-briefing__closing-text">
          The best time to set sail was yesterday. The second best time is now.
          Start wherever feels right — the ship will meet you where you are.
        </p>
        <button
          className="captains-briefing__closing-btn"
          onClick={() => navigate('/')}
        >
          Return to the Crow's Nest
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default CaptainsBriefing;
