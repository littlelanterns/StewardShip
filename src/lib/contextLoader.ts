import { supabase } from './supabase';
import type { MastEntry, KeelEntry, LogEntry, Victory, CompassTask, GuidedMode, HelmMessage, WheelInstance, LifeInventoryArea, RiggingPlan } from './types';
import { SPOKE_LABELS, PLANNING_FRAMEWORK_LABELS } from './types';
import {
  shouldLoadKeel,
  shouldLoadLog,
  shouldLoadCompass,
  shouldLoadVictories,
  shouldLoadCharts,
  shouldLoadDashboard,
  shouldLoadReveille,
  shouldLoadReckoning,
  shouldLoadWheel,
  shouldLoadLifeInventory,
  shouldLoadRigging,
  type SystemPromptContext,
} from './systemPrompt';

interface LoadContextOptions {
  message: string;
  pageContext: string;
  userId: string;
  guidedMode?: GuidedMode;
  conversationHistory: HelmMessage[];
  contextBudget?: 'short' | 'medium' | 'long';
}

export async function loadContext(options: LoadContextOptions): Promise<SystemPromptContext> {
  const {
    message,
    pageContext,
    userId,
    guidedMode,
    conversationHistory,
    contextBudget = 'medium',
  } = options;

  // Always fetch: user profile and Mast entries
  const [profileResult, mastResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('mast_entries')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
  ]);

  const displayName = profileResult.data?.display_name || '';
  const mastEntries = (mastResult.data as MastEntry[]) || [];

  // Conditionally fetch based on keyword detection
  const needKeel = shouldLoadKeel(message, pageContext);
  const needLog = shouldLoadLog(message, pageContext) || pageContext === 'reveille' || pageContext === 'reckoning';
  const needCompass = shouldLoadCompass(message, pageContext) || pageContext === 'reveille' || pageContext === 'reckoning';
  const needVictories = shouldLoadVictories(message, pageContext);
  const needCharts = shouldLoadCharts(message, pageContext);
  const needDashboard = shouldLoadDashboard(message, pageContext);
  const needReveille = shouldLoadReveille(pageContext);
  const needReckoning = shouldLoadReckoning(pageContext);
  const needWheel = shouldLoadWheel(message, pageContext);
  const needLifeInventory = shouldLoadLifeInventory(message, pageContext);
  const needRigging = shouldLoadRigging(message, pageContext);

  let keelEntries: KeelEntry[] | undefined;
  let recentLogEntries: LogEntry[] | undefined;
  let compassContext: string | undefined;
  let recentVictories: Victory[] | undefined;
  let chartsContext: string | undefined;
  let dashboardContext: string | undefined;
  let reveilleContext: string | undefined;
  let reckoningContext: string | undefined;
  let wheelContext: string | undefined;
  let lifeInventoryContext: string | undefined;
  let riggingContext: string | undefined;

  // Fetch conditional data in parallel
  const keelPromise = needKeel
    ? supabase
        .from('keel_entries')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
    : null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logPromise = needLog
    ? supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
    : null;

  const today = new Date().toISOString().split('T')[0];
  const compassPromise = needCompass
    ? supabase
        .from('compass_tasks')
        .select('title, status, life_area_tag, due_date, recurrence_rule')
        .eq('user_id', userId)
        .eq('due_date', today)
        .is('archived_at', null)
        .order('sort_order')
    : null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const victoriesPromise = needVictories
    ? supabase
        .from('victories')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
    : null;

  const wheelPromise = needWheel
    ? supabase
        .from('wheel_instances')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .in('status', ['in_progress', 'active'])
        .order('updated_at', { ascending: false })
        .limit(5)
    : null;

  const lifeInvPromise = needLifeInventory
    ? supabase
        .from('life_inventory_areas')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })
    : null;

  const riggingPromise = needRigging
    ? supabase
        .from('rigging_plans')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .in('status', ['active', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(5)
    : null;

  const [keelResult, logResult, compassResult, victoriesResult, wheelResult, lifeInvResult, riggingResult] = await Promise.all([
    keelPromise,
    logPromise,
    compassPromise,
    victoriesPromise,
    wheelPromise,
    lifeInvPromise,
    riggingPromise,
  ]);

  if (keelResult?.data) {
    keelEntries = keelResult.data as KeelEntry[];
  }
  if (logResult?.data) {
    recentLogEntries = logResult.data as LogEntry[];
  }
  if (compassResult?.data && compassResult.data.length > 0) {
    compassContext = formatCompassContext(compassResult.data as CompassTask[]);
  }
  if (victoriesResult?.data) {
    recentVictories = victoriesResult.data as Victory[];
  }
  if (wheelResult?.data && wheelResult.data.length > 0) {
    wheelContext = buildWheelContext(wheelResult.data as WheelInstance[]);
  }
  if (lifeInvResult?.data && lifeInvResult.data.length > 0) {
    lifeInventoryContext = buildLifeInventoryContext(lifeInvResult.data as LifeInventoryArea[]);
  }
  if (riggingResult?.data && riggingResult.data.length > 0) {
    riggingContext = buildRiggingContext(riggingResult.data as RiggingPlan[]);
  }

  // Charts context — aggregated summary
  if (needCharts || needDashboard) {
    chartsContext = await buildChartsContext(userId, today);
  }

  // Dashboard context
  if (needDashboard) {
    dashboardContext = await buildDashboardContext(userId, today, compassResult?.data as CompassTask[] | undefined, recentVictories);
  }

  // Reveille context — morning briefing opening for Helm
  if (needReveille) {
    reveilleContext = buildReveilleContext(
      compassResult?.data as CompassTask[] | undefined,
      mastEntries,
    );
  }

  // Reckoning context — evening review opening for Helm
  if (needReckoning) {
    reckoningContext = await buildReckoningContext(userId, today, compassResult?.data as CompassTask[] | undefined, recentVictories);
  }

  return {
    displayName,
    mastEntries,
    keelEntries,
    recentLogEntries,
    recentVictories,
    compassContext,
    chartsContext,
    dashboardContext,
    reveilleContext,
    reckoningContext,
    wheelContext,
    lifeInventoryContext,
    riggingContext,
    pageContext,
    guidedMode: guidedMode || null,
    conversationHistory,
    contextBudget,
  };
}

function formatCompassContext(tasks: Pick<CompassTask, 'title' | 'status' | 'life_area_tag' | 'due_date' | 'recurrence_rule'>[]): string {
  const pending = tasks.filter((t) => t.status === 'pending');
  const completed = tasks.filter((t) => t.status === 'completed');

  let result = '\n\nTODAY\'S COMPASS (Tasks):\n';
  if (pending.length > 0) {
    result += `Pending (${pending.length}):\n`;
    for (const t of pending) {
      const tag = t.life_area_tag ? ` [${t.life_area_tag}]` : '';
      const recurring = t.recurrence_rule ? ` (${t.recurrence_rule})` : '';
      result += `- ${t.title}${tag}${recurring}\n`;
    }
  }
  if (completed.length > 0) {
    result += `Completed (${completed.length}):\n`;
    for (const t of completed) {
      result += `- ${t.title}\n`;
    }
  }
  return result;
}

async function buildChartsContext(userId: string, today: string): Promise<string | undefined> {
  try {
    // Get this week's task completion
    const weekStart = new Date();
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data: weekTasks } = await supabase
      .from('compass_tasks')
      .select('status')
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('due_date', weekStartStr)
      .lte('due_date', today);

    const totalTasks = weekTasks?.length || 0;
    const completedTasks = weekTasks?.filter((t: { status: string }) => t.status === 'completed').length || 0;

    // Get active goals
    const { data: goals } = await supabase
      .from('goals')
      .select('title, progress_current, progress_target')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('archived_at', null)
      .limit(5);

    // Get this month's victory count
    const monthStart = new Date();
    monthStart.setDate(1);
    const { count: victoryCount } = await supabase
      .from('victories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', monthStart.toISOString());

    // Get this week's journal count
    const { count: journalCount } = await supabase
      .from('log_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', weekStart.toISOString());

    let result = '\n\nProgress summary (Charts):\n';
    if (totalTasks > 0) {
      const pct = Math.round((completedTasks / totalTasks) * 100);
      result += `- Task completion: ${pct}% this week (${completedTasks} of ${totalTasks} tasks)\n`;
    }
    if (goals && goals.length > 0) {
      result += '- Goals: ';
      result += goals.map((g: { title: string; progress_current: number; progress_target: number | null }) =>
        `${g.title} at ${g.progress_target ? Math.round((g.progress_current / g.progress_target) * 100) : g.progress_current}%`
      ).join(', ');
      result += '\n';
    }
    if (victoryCount) {
      result += `- Victories this month: ${victoryCount}\n`;
    }
    if (journalCount) {
      result += `- Journal entries this week: ${journalCount}\n`;
    }

    return result;
  } catch {
    return undefined;
  }
}

async function buildDashboardContext(
  userId: string,
  today: string,
  todayTasks?: CompassTask[],
  victories?: Victory[],
): Promise<string | undefined> {
  try {
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];
    const completed = todayTasks?.filter((t) => t.status === 'completed') || [];
    const totalToday = (todayTasks || []).length;

    let result = '\n\nDashboard summary (Crow\'s Nest):\n';
    result += `- Today: ${totalToday} tasks, ${completed.length} completed, ${pending.length} remaining.`;
    if (pending.length > 0) {
      result += ` Top pending: ${pending.slice(0, 3).map((t) => t.title).join(', ')}`;
    }
    result += '\n';

    if (victories && victories.length > 0) {
      result += `- Recent victories: ${victories.length} in last 30 days\n`;
    }

    return result;
  } catch {
    return undefined;
  }
}

function buildReveilleContext(
  todayTasks?: CompassTask[],
  mastEntries?: MastEntry[],
): string | undefined {
  try {
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];

    let result = `\n\nMORNING CONTEXT (Reveille):
The user just saw their Reveille morning briefing and tapped "Talk to The Helm."
Today is ${dayOfWeek}, ${dateStr}.\n`;

    if (pending.length > 0) {
      result += `Today's tasks (${pending.length}):\n`;
      for (const t of pending.slice(0, 5)) {
        result += `- ${t.title}${t.life_area_tag ? ` [${t.life_area_tag}]` : ''}\n`;
      }
      if (pending.length > 5) {
        result += `- ...and ${pending.length - 5} more\n`;
      }
    } else {
      result += 'No tasks scheduled for today.\n';
    }

    result += `\nAI style: Be grounded and practical, not over-enthusiastic. Example openings:
- "Good morning. You've got ${pending.length} things on your plate today. Anything weighing on you before you start?"
- "Morning. Want to think through how to approach today?"`;

    return result;
  } catch {
    return undefined;
  }
}

async function buildReckoningContext(
  userId: string,
  today: string,
  todayTasks?: CompassTask[],
  victories?: Victory[],
): Promise<string | undefined> {
  try {
    const completed = todayTasks?.filter((t) => t.status === 'completed') || [];
    const pending = todayTasks?.filter((t) => t.status === 'pending') || [];
    const totalToday = (todayTasks || []).length;

    // Get tomorrow's tasks
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: tomorrowTasks } = await supabase
      .from('compass_tasks')
      .select('title, life_area_tag')
      .eq('user_id', userId)
      .eq('due_date', tomorrowStr)
      .in('status', ['pending', 'carried_forward'])
      .is('archived_at', null)
      .order('sort_order')
      .limit(5);

    // Get today's log entries
    const { data: todayLogs } = await supabase
      .from('log_entries')
      .select('text, entry_type')
      .eq('user_id', userId)
      .is('archived_at', null)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .limit(5);

    let result = `\n\nEVENING CONTEXT (Reckoning):
The user just saw their Reckoning evening review and tapped "Talk to The Helm."\n`;

    result += `Today: ${completed.length} of ${totalToday} tasks completed.`;
    if (pending.length > 0) {
      result += ` ${pending.length} incomplete: ${pending.slice(0, 3).map((t) => t.title).join(', ')}`;
      if (pending.length > 3) result += ` and ${pending.length - 3} more`;
    }
    result += '\n';

    if (victories && victories.length > 0) {
      result += `Victories today: ${victories.map((v) => v.description).join('; ')}\n`;
    }

    if (tomorrowTasks && tomorrowTasks.length > 0) {
      result += `Tomorrow's priorities: ${(tomorrowTasks as { title: string }[]).map((t) => t.title).join(', ')}\n`;
    }

    if (todayLogs && todayLogs.length > 0) {
      result += `Today's journal entries: ${todayLogs.length}\n`;
    }

    result += `\nAI style: Be reflective, not evaluative. Example openings:
- "How are you feeling about today?"
- "Looks like you got through ${completed.length} of your ${totalToday} tasks. How do you feel about what's left?"`;

    if (pending.length > 3) {
      result += `\n- If heavy day detected: "It looks like today was a lot. Want to talk about it, or just close things out and rest?"`;
    }

    return result;
  } catch {
    return undefined;
  }
}

function buildWheelContext(wheels: WheelInstance[]): string {
  if (wheels.length === 0) return '';

  let result = '\n\nACTIVE CHANGE WHEELS:\n';
  for (const w of wheels) {
    const spokeLabel = SPOKE_LABELS[w.current_spoke] || `Spoke ${w.current_spoke}`;
    result += `- "${w.hub_text}" (${w.status}, current: ${spokeLabel})`;
    if (w.life_area_tag) {
      result += ` [${w.life_area_tag}]`;
    }
    if (w.next_rim_date) {
      result += ` — next Rim: ${w.next_rim_date}`;
    }
    if (w.rim_count > 0) {
      result += `, ${w.rim_count} Rim${w.rim_count > 1 ? 's' : ''} completed`;
    }
    result += '\n';

    // Include key spoke data if available (truncated)
    if (w.spoke_1_why) {
      const truncated = w.spoke_1_why.length > 100 ? w.spoke_1_why.slice(0, 97) + '...' : w.spoke_1_why;
      result += `  Why: ${truncated}\n`;
    }
    if (w.spoke_6_becoming_text) {
      const truncated = w.spoke_6_becoming_text.length > 100 ? w.spoke_6_becoming_text.slice(0, 97) + '...' : w.spoke_6_becoming_text;
      result += `  Becoming: ${truncated}\n`;
    }
  }
  return result;
}

function buildLifeInventoryContext(areas: LifeInventoryArea[]): string {
  if (areas.length === 0) return '';

  const assessed = areas.filter((a) => a.current_summary || a.baseline_summary || a.vision_summary);
  if (assessed.length === 0) {
    return `\n\nLIFE INVENTORY: ${areas.length} areas defined, none assessed yet.\n`;
  }

  let result = `\n\nLIFE INVENTORY (${assessed.length} of ${areas.length} areas assessed):\n`;
  for (const a of assessed) {
    result += `- ${a.area_name}:`;
    if (a.current_summary) {
      const truncated = a.current_summary.length > 150 ? a.current_summary.slice(0, 147) + '...' : a.current_summary;
      result += ` Current: ${truncated}`;
    }
    if (a.vision_summary) {
      const truncated = a.vision_summary.length > 100 ? a.vision_summary.slice(0, 97) + '...' : a.vision_summary;
      result += ` | Vision: ${truncated}`;
    }
    result += '\n';
  }
  return result;
}

function buildRiggingContext(plans: RiggingPlan[]): string {
  if (plans.length === 0) return '';

  let result = '\n\nACTIVE PLANS (Rigging):\n';
  for (const p of plans) {
    const framework = PLANNING_FRAMEWORK_LABELS[p.planning_framework] || p.planning_framework;
    result += `- "${p.title}" (${p.status}, ${framework})`;
    if (p.target_date) {
      result += ` — target: ${p.target_date}`;
    }
    result += '\n';
    if (p.description) {
      const truncated = p.description.length > 120 ? p.description.slice(0, 117) + '...' : p.description;
      result += `  ${truncated}\n`;
    }
  }
  return result;
}
