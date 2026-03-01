/**
 * Straight Line Leadership (SLL) distinction definitions.
 * Used by the Helm AI for teach-on-first-use behavior and
 * by MessageBubble for tappable term refresher UI.
 */

export interface SLLDistinction {
  key: string;
  term: string;
  contrast: string;
  oneLiner: string;
  description: string;
}

export const SLL_DISTINCTIONS: Record<string, SLLDistinction> = {
  should_vs_must: {
    key: 'should_vs_must',
    term: 'must',
    contrast: 'Should vs. Must',
    oneLiner: 'Shoulds drain energy and carry guilt. Musts create action.',
    description: 'When something is a "should," it stays on your conscience but rarely drives behavior. When it becomes a "must," you\'ve made a decision — it\'s happening. The shift from should to must is the shift from guilt to commitment.',
  },
  core_vs_surface: {
    key: 'core_vs_surface',
    term: 'core action',
    contrast: 'Core vs. Surface Actions',
    oneLiner: 'Core actions produce results. Surface actions produce busyness.',
    description: 'Core actions directly advance your commitments. Surface actions feel productive but don\'t move the needle — organizing, researching endlessly, preparing to prepare. Ask: "Does this action directly produce the result I\'m committed to?"',
  },
  owner_vs_victim: {
    key: 'owner_vs_victim',
    term: 'Owner stance',
    contrast: 'Owner vs. Victim',
    oneLiner: 'Owners create circumstances. Victims are created by them.',
    description: 'The Owner stance focuses on what you can control and takes responsibility for your responses. The Victim stance externalizes — blame, helplessness, waiting for circumstances to change. Both are inner stances, not character judgments.',
  },
  wanting_vs_creating: {
    key: 'wanting_vs_creating',
    term: 'creating',
    contrast: 'Wanting vs. Creating',
    oneLiner: 'Wanting depletes energy. Creating generates it.',
    description: 'Wanting keeps you in a state of lack — focused on what you don\'t have. Creating shifts your energy toward what you\'re building. The moment you start producing instead of wishing, your energy changes.',
  },
  commitment_vs_trying: {
    key: 'commitment_vs_trying',
    term: 'commitment',
    contrast: 'Commitment vs. Trying',
    oneLiner: '"Trying" is code for "don\'t count on it."',
    description: 'When you say "I\'ll try," you\'ve already built in your escape route. Commitment means the outcome is not optional. You may not know HOW yet, but the THAT is decided.',
  },
  commitment_vs_involvement: {
    key: 'commitment_vs_involvement',
    term: 'commitment',
    contrast: 'Commitment vs. Involvement',
    oneLiner: 'You can carry 5-7 real commitments. Everything else is involvement.',
    description: 'Involvement is participation without full ownership. Commitment is giving your best energy and creativity. Most people have dozens of involvements but only 5-7 real commitments at any time.',
  },
  dream_vs_project: {
    key: 'dream_vs_project',
    term: 'project',
    contrast: 'Dream vs. Project',
    oneLiner: 'Dreams stay in your head. Projects get your hands on them.',
    description: 'A dream is an aspiration without a plan. A project has structure, milestones, and a timeline. The transition from dream to project is when you put your hands on it and start building.',
  },
  stop_stopping: {
    key: 'stop_stopping',
    term: 'stop stopping',
    contrast: 'Stop Stopping',
    oneLiner: 'Slow is fine. Stopping is the problem.',
    description: 'Progress doesn\'t require speed — it requires continuity. Going slow is still going. Stopping breaks momentum, and restarting costs far more energy than continuing slowly. The goal is to stop stopping.',
  },
  worry_vs_concern: {
    key: 'worry_vs_concern',
    term: 'concern',
    contrast: 'Worry vs. Concern',
    oneLiner: 'Worry is passive cycling. Concern leads to action.',
    description: 'Worry loops the problem without resolution — it drains energy without producing movement. Concern acknowledges the problem and asks "what can I do about it right now?" Convert worry to concern by identifying your next action.',
  },
  corrective_vs_protective: {
    key: 'corrective_vs_protective',
    term: 'course correction',
    contrast: 'Corrective vs. Protective',
    oneLiner: 'Course corrections get you there. Protecting ego keeps you off course.',
    description: 'Corrective actions adjust your heading toward the destination. Protective actions defend your ego — avoiding feedback, rationalizing mistakes, blaming others. Growth requires choosing correction over protection.',
  },
  purpose_management: {
    key: 'purpose_management',
    term: 'purpose management',
    contrast: 'Purpose Management vs. Time Management',
    oneLiner: 'Know your purpose and time management solves itself.',
    description: 'Time management without clarity of purpose is just rearranging deck chairs. When you\'re clear on your commitments, decisions about time become obvious. Purpose creates priority; priority creates schedule.',
  },
  now_vs_later: {
    key: 'now_vs_later',
    term: 'now',
    contrast: 'Now vs. Later',
    oneLiner: '"Later" is often code for "never."',
    description: 'Postponing important actions feels like planning, but "later" often means "when it\'s convenient" — and it never is. The question isn\'t whether now is perfect. It\'s whether waiting makes it more likely.',
  },
  focus_vs_spray: {
    key: 'focus_vs_spray',
    term: 'focus',
    contrast: 'Focus vs. Spray',
    oneLiner: 'Winners focus. Losers spray.',
    description: 'Spraying your energy across dozens of initiatives produces mediocre results everywhere. Focus — concentrated effort on your real commitments — produces breakthrough. Less but better.',
  },
  playing_to_win: {
    key: 'playing_to_win',
    term: 'playing to win',
    contrast: 'Playing to Win vs. Playing Not to Lose',
    oneLiner: 'Playing to win takes growth risks. Playing not to lose avoids them.',
    description: 'Playing not to lose is about safety — avoiding mistakes, staying comfortable, protecting what you have. Playing to win accepts discomfort as the cost of growth. You can\'t create something new from a defensive stance.',
  },
  positive_no: {
    key: 'positive_no',
    term: 'positive no',
    contrast: 'Positive No',
    oneLiner: 'A positive no protects your commitments by saying yes to what matters.',
    description: 'Saying no isn\'t negative — it\'s a yes to your actual commitments. Every yes to something unimportant is a no to something important. A positive no is clear, kind, and grounded in your priorities.',
  },
  discomfort_vs_chaos: {
    key: 'discomfort_vs_chaos',
    term: 'discomfort',
    contrast: 'Discomfort vs. Chaos',
    oneLiner: 'Keep discomfort at discomfort. Never escalate to chaos.',
    description: 'Growth requires discomfort — that\'s normal and healthy. But catastrophizing a setback escalates discomfort into chaos, which paralyzes you. Stay with the discomfort. Name it. Act from it. Don\'t inflate it.',
  },
  productivity_vs_busyness: {
    key: 'productivity_vs_busyness',
    term: 'productive',
    contrast: 'Productivity vs. Busyness',
    oneLiner: 'Productivity does what matters. Busyness puts on a show.',
    description: 'Busyness fills time with activity. Productivity fills time with results. They feel similar from the inside but look very different from the outside. Ask: "What did I actually produce today?"',
  },
  kind_vs_nice: {
    key: 'kind_vs_nice',
    term: 'kind',
    contrast: 'Kind vs. Nice',
    oneLiner: 'Kind is truthful. Nice is protecting your own comfort.',
    description: 'Being nice avoids hard conversations to protect your own feelings. Being kind tells the truth in a caring way, even when it\'s uncomfortable. Kind serves the other person. Nice serves yourself.',
  },
  agreements_vs_expectations: {
    key: 'agreements_vs_expectations',
    term: 'agreement',
    contrast: 'Agreements vs. Expectations',
    oneLiner: 'Agreements are explicit. Expectations are silent resentments.',
    description: 'Expectations are assumptions you hold without communicating them. When they\'re unmet, resentment builds. Agreements are explicit — both parties know what they\'re committing to. Convert expectations into agreements.',
  },
  radical_self_honesty: {
    key: 'radical_self_honesty',
    term: 'self-honesty',
    contrast: 'Radical Self-Honesty',
    oneLiner: 'The easier you are on yourself, the harder life is on you.',
    description: 'Radical self-honesty means seeing things as they are, not as you wish they were. It\'s not self-criticism — it\'s clarity. When you stop rationalizing, you can start changing.',
  },
};

export const SLL_KEYS = Object.keys(SLL_DISTINCTIONS);
