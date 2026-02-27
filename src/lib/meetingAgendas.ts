// Built-in agenda section definitions for all meeting types.
// These are seeded to meeting_template_sections on first use per user+type.

export interface BuiltInAgendaSection {
  default_key: string;
  title: string;
  ai_prompt_text: string;
}

export const BUILT_IN_AGENDAS: Record<string, BuiltInAgendaSection[]> = {
  couple: [
    {
      default_key: 'couple_prayer_open',
      title: 'Opening Prayer / Centering',
      ai_prompt_text: 'Open with a brief prayer or centering moment. Set the tone for connection and intentionality.',
    },
    {
      default_key: 'couple_appreciation',
      title: 'Appreciation and Connection',
      ai_prompt_text: 'Ask what they appreciated about their spouse this week. Draw out specific moments and feelings.',
    },
    {
      default_key: 'couple_review_previous',
      title: 'Review Previous Commitments',
      ai_prompt_text: 'Reference action items from the last couple meeting. Celebrate follow-through, note what fell off.',
    },
    {
      default_key: 'couple_state_of_union',
      title: 'State of the Union',
      ai_prompt_text: 'Emotional, mental, and spiritual check-in. Empathetic listening first — validate before problem-solving.',
    },
    {
      default_key: 'couple_goals',
      title: 'Goals and Planning',
      ai_prompt_text: 'Quadrant II focus. Reference Mast shared principles. What matters most for the next week?',
    },
    {
      default_key: 'couple_calendar',
      title: 'Calendar and Logistics',
      ai_prompt_text: 'Light logistics section. Upcoming events, schedule coordination, practical planning.',
    },
    {
      default_key: 'couple_impressions',
      title: 'Recording Impressions',
      ai_prompt_text: 'Ask for any insights, promptings, or impressions they want to hold onto from this meeting.',
    },
    {
      default_key: 'couple_prayer_close',
      title: 'Closing Prayer / Reflection',
      ai_prompt_text: 'Close with prayer or a moment of reflection. Affirm the connection.',
    },
  ],

  parent_child: [
    {
      default_key: 'pc_prayer_open',
      title: 'Opening Prayer',
      ai_prompt_text: 'Begin with a brief prayer. Set a warm, safe tone for the child.',
    },
    {
      default_key: 'pc_connection',
      title: 'Connection and Exciting News',
      ai_prompt_text: 'Ask what happened this week that was fun or interesting. Build connection before goals.',
    },
    {
      default_key: 'pc_review_goals',
      title: 'Review Previous Goals',
      ai_prompt_text: 'Celebrate effort, not just completion. If goals were missed, be curious not disappointed.',
    },
    {
      default_key: 'pc_goal_setting',
      title: 'Goal Setting',
      ai_prompt_text: 'Age-adapted goals. Always include at least one fun goal. Keep it collaborative.',
    },
    {
      default_key: 'pc_skill_building',
      title: 'Skill Building Discussion',
      ai_prompt_text: 'Reference crew notes for context. Discuss a skill or topic suited to the child\'s age and interests.',
    },
    {
      default_key: 'pc_impressions',
      title: 'Recording Impressions',
      ai_prompt_text: 'Capture impressions and insights from the meeting.',
    },
    {
      default_key: 'pc_prayer_close',
      title: 'Closing Prayer',
      ai_prompt_text: 'Close with a prayer. Let the child participate if willing.',
    },
  ],

  mentor: [
    {
      default_key: 'mentor_checkin',
      title: 'Check-in',
      ai_prompt_text: 'How are things going? What has been on your mind since the last meeting?',
    },
    {
      default_key: 'mentor_agenda',
      title: 'My Agenda Items',
      ai_prompt_text: 'Review any pre-added discussion items. Discuss each one and capture the mentor\'s responses.',
    },
    {
      default_key: 'mentor_learning',
      title: 'What I\'m Learning',
      ai_prompt_text: 'Share progress on assignments, practice, reading, or goals. What went well? Where was effort put in?',
    },
    {
      default_key: 'mentor_challenges',
      title: 'Challenges & Self-Government',
      ai_prompt_text: 'Discuss obstacles and frustrations. How were they handled? Practice self-government reflection.',
    },
    {
      default_key: 'mentor_questions',
      title: 'Questions & Curiosities',
      ai_prompt_text: 'What questions or curiosities does the user have? Encourage great questions.',
    },
    {
      default_key: 'mentor_goals_next',
      title: 'Goals for Next Time',
      ai_prompt_text: 'Set specific, realistic goals to focus on before the next meeting.',
    },
    {
      default_key: 'mentor_notes',
      title: 'Notes & Action Items',
      ai_prompt_text: 'Capture key takeaways, suggestions, and commitments.',
    },
  ],

  weekly_review: [
    {
      default_key: 'wr_prayer_open',
      title: 'Opening Prayer / Centering',
      ai_prompt_text: 'Open with prayer or centering. Set a reflective tone.',
    },
    {
      default_key: 'wr_review_week',
      title: 'Review the Past Week',
      ai_prompt_text: 'Present task completion stats, victories, streaks, Log themes. Ask what went well and what was hard.',
    },
    {
      default_key: 'wr_roles_goals',
      title: 'Roles and Goals',
      ai_prompt_text: 'Walk through life roles. For each: one important-but-not-urgent focus. Reference Mast, Wheels, Rigging.',
    },
    {
      default_key: 'wr_organize',
      title: 'Organize the Week',
      ai_prompt_text: 'Convert goals to Compass tasks. Suggest 1-3 Big Rocks.',
    },
    {
      default_key: 'wr_impressions',
      title: 'Recording Impressions',
      ai_prompt_text: 'Ask for insights or impressions to record.',
    },
    {
      default_key: 'wr_prayer_close',
      title: 'Closing Prayer',
      ai_prompt_text: 'Close with prayer or reflection.',
    },
  ],

  monthly_review: [
    {
      default_key: 'mr_prayer_open',
      title: 'Opening Prayer / Centering',
      ai_prompt_text: 'Open with prayer or centering for a deeper review.',
    },
    {
      default_key: 'mr_review_month',
      title: 'Review the Past Month',
      ai_prompt_text: 'Trends, themes, and patterns from Charts, Log, Victories, Compass. Monthly-level perspective.',
    },
    {
      default_key: 'mr_life_inventory',
      title: 'Life Inventory Mini-Check',
      ai_prompt_text: 'Quick pulse check on each life area. Not a full rebuild, just a check-in.',
    },
    {
      default_key: 'mr_mast_review',
      title: 'Mast Review',
      ai_prompt_text: 'Are guiding principles still aligned? Anything to adjust or add?',
    },
    {
      default_key: 'mr_monthly_goals',
      title: 'Set Monthly Goals',
      ai_prompt_text: 'Connected to Life Inventory and active plans. Bigger-picture than weekly.',
    },
    {
      default_key: 'mr_impressions',
      title: 'Recording Impressions',
      ai_prompt_text: 'Ask for insights or impressions to record.',
    },
    {
      default_key: 'mr_prayer_close',
      title: 'Closing Prayer',
      ai_prompt_text: 'Close with prayer or reflection.',
    },
  ],

  business: [
    {
      default_key: 'biz_prayer_open',
      title: 'Opening Prayer / Vision Review',
      ai_prompt_text: 'Reconnect with purpose. Reference Mast work/stewardship principles.',
    },
    {
      default_key: 'biz_review_week',
      title: 'Review the Past Week',
      ai_prompt_text: 'Business-tagged tasks, trackers, Log entries. What moved the needle?',
    },
    {
      default_key: 'biz_strategic_focus',
      title: 'Strategic Focus',
      ai_prompt_text: 'Quadrant II. Distinguish urgent-reactive from important-strategic. Reference Rigging plans.',
    },
    {
      default_key: 'biz_organize',
      title: 'Organize the Week',
      ai_prompt_text: 'Big Rock business goals to Compass. Keep strategic, not just tactical.',
    },
    {
      default_key: 'biz_impressions',
      title: 'Recording Impressions',
      ai_prompt_text: 'Ask for insights or impressions to record.',
    },
    {
      default_key: 'biz_prayer_close',
      title: 'Closing Prayer',
      ai_prompt_text: 'Close with prayer or reflection on the week ahead.',
    },
  ],
};

/** Get the built-in agenda sections for a meeting type. Returns empty array for 'custom' or unknown types. */
export function getBuiltInSections(meetingType: string): BuiltInAgendaSection[] {
  return BUILT_IN_AGENDAS[meetingType] || [];
}
