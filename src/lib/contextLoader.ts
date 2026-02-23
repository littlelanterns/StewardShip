import { supabase } from './supabase';
import type { MastEntry, KeelEntry, LogEntry, Victory, CompassTask, GuidedMode, HelmMessage } from './types';
import {
  shouldLoadKeel,
  shouldLoadLog,
  shouldLoadCompass,
  shouldLoadVictories,
  shouldLoadCharts,
  shouldLoadDashboard,
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
  const needLog = shouldLoadLog(message, pageContext);
  const needCompass = shouldLoadCompass(message, pageContext);
  const needVictories = shouldLoadVictories(message, pageContext);
  const needCharts = shouldLoadCharts(message, pageContext);
  const needDashboard = shouldLoadDashboard(message, pageContext);

  let keelEntries: KeelEntry[] | undefined;
  let recentLogEntries: LogEntry[] | undefined;
  let compassContext: string | undefined;
  let recentVictories: Victory[] | undefined;
  let chartsContext: string | undefined;
  let dashboardContext: string | undefined;

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

  const [keelResult, logResult, compassResult, victoriesResult] = await Promise.all([
    keelPromise,
    logPromise,
    compassPromise,
    victoriesPromise,
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

  // Charts context — aggregated summary
  if (needCharts || needDashboard) {
    chartsContext = await buildChartsContext(userId, today);
  }

  // Dashboard context
  if (needDashboard) {
    dashboardContext = await buildDashboardContext(userId, today, compassResult?.data as CompassTask[] | undefined, recentVictories);
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
