import { supabase } from './supabase';
import type { MastEntry, KeelEntry, LogEntry, CompassTask, GuidedMode, HelmMessage } from './types';
import { shouldLoadKeel, shouldLoadLog, shouldLoadCompass, type SystemPromptContext } from './systemPrompt';

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

  let keelEntries: KeelEntry[] | undefined;
  let recentLogEntries: LogEntry[] | undefined;
  let compassContext: string | undefined;

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

  const [keelResult, logResult, compassResult] = await Promise.all([
    keelPromise,
    logPromise,
    compassPromise,
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

  return {
    displayName,
    mastEntries,
    keelEntries,
    recentLogEntries,
    compassContext,
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
