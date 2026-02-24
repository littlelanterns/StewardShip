import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { searchManifest } from '../lib/rag';
import type {
  DailyRhythmStatus,
  UserSettings,
  MastEntry,
  CompassTask,
  Victory,
  CustomTracker,
  TrackerEntry,
  StreakInfo,
} from '../lib/types';

const STREAK_MILESTONES = [7, 30, 90, 365];

function getNextMilestone(current: number): number {
  for (const m of STREAK_MILESTONES) {
    if (current < m) return m;
  }
  return current + 365;
}

export interface ManifestReading {
  text: string;
  source: string;
}

export interface ReveilleData {
  mastThought: MastEntry | null;
  manifestReading: ManifestReading | null;
  todayTasks: CompassTask[];
  streaks: StreakInfo[];
  trackers: (CustomTracker & { todayEntry?: TrackerEntry })[];
}

export interface ReckoningData {
  mastThought: MastEntry | null;
  manifestReading: ManifestReading | null;
  completedTasks: CompassTask[];
  victories: Victory[];
  incompleteTasks: CompassTask[];
  tomorrowTasks: CompassTask[];
  trackers: (CustomTracker & { todayEntry?: TrackerEntry })[];
  promptsDue: {
    gratitude: boolean;
    joy: boolean;
    anticipation: boolean;
  };
  aiSuggestion: string | null;
}

function getUserLocalDate(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    return parts; // returns YYYY-MM-DD format
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getUserLocalHour(timezone: string): number {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(hour, 10);
  } catch {
    return new Date().getHours();
  }
}

function parseTimeToHour(time: string): number {
  const [h] = time.split(':').map(Number);
  return h;
}

function getTomorrowDate(today: string): string {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function useRhythms() {
  const { user, profile } = useAuthContext();
  const [rhythmStatus, setRhythmStatus] = useState<DailyRhythmStatus | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [reveilleData, setReveilleData] = useState<ReveilleData | null>(null);
  const [reckoningData, setReckoningData] = useState<ReckoningData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = profile?.timezone || 'America/Chicago';

  // Fetch user settings
  const fetchSettings = useCallback(async (): Promise<UserSettings | null> => {
    if (!user) return null;
    if (userSettings) return userSettings;
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setUserSettings(data as UserSettings);
      return data as UserSettings;
    }
    return null;
  }, [user, userSettings]);

  // Determine if Reveille should show
  const shouldShowReveille = useCallback((): boolean => {
    if (!userSettings?.reveille_enabled) return false;
    if (rhythmStatus?.reveille_dismissed) return false;
    const hour = getUserLocalHour(timezone);
    const reveilleHour = parseTimeToHour(userSettings?.reveille_time || '07:00');
    return hour >= reveilleHour && hour < 12;
  }, [userSettings, rhythmStatus, timezone]);

  // Determine if Reckoning should show
  const shouldShowReckoning = useCallback((): boolean => {
    if (!userSettings?.reckoning_enabled) return false;
    if (rhythmStatus?.reckoning_dismissed) return false;
    const hour = getUserLocalHour(timezone);
    const reckoningHour = parseTimeToHour(userSettings?.reckoning_time || '21:00');
    return hour >= reckoningHour && hour < 24;
  }, [userSettings, rhythmStatus, timezone]);

  // Get or create today's rhythm status
  const getOrCreateRhythmStatus = useCallback(async (): Promise<DailyRhythmStatus | null> => {
    if (!user) return null;
    const today = getUserLocalDate(timezone);

    // Try to get existing
    const { data: existing } = await supabase
      .from('daily_rhythm_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('rhythm_date', today)
      .maybeSingle();

    if (existing) {
      setRhythmStatus(existing as DailyRhythmStatus);
      return existing as DailyRhythmStatus;
    }

    // Create new
    const { data: created, error: err } = await supabase
      .from('daily_rhythm_status')
      .insert({ user_id: user.id, rhythm_date: today })
      .select()
      .single();

    if (err) {
      // Race condition — another tab may have created it
      const { data: retry } = await supabase
        .from('daily_rhythm_status')
        .select('*')
        .eq('user_id', user.id)
        .eq('rhythm_date', today)
        .maybeSingle();
      if (retry) {
        setRhythmStatus(retry as DailyRhythmStatus);
        return retry as DailyRhythmStatus;
      }
      return null;
    }

    setRhythmStatus(created as DailyRhythmStatus);
    return created as DailyRhythmStatus;
  }, [user, timezone]);

  // Select Mast thought based on rotation setting
  const selectMastThought = useCallback(async (
    entries: MastEntry[],
    period: 'morning' | 'evening',
    status: DailyRhythmStatus,
    settings: UserSettings | null,
  ): Promise<MastEntry | null> => {
    if (entries.length === 0) return null;
    if (!user) return null;

    const rotation = settings?.mast_thought_rotation || 'daily';
    const existingId = period === 'morning'
      ? status.mast_thought_morning_id
      : status.mast_thought_evening_id;

    // If already selected today (for daily/weekly), use it
    if (existingId && rotation !== 'every_open') {
      const found = entries.find((e) => e.id === existingId);
      if (found) return found;
    }

    // Manual — use pinned
    if (rotation === 'manual' && settings?.mast_thought_pinned_id) {
      const pinned = entries.find((e) => e.id === settings.mast_thought_pinned_id);
      return pinned || entries[0];
    }

    // For evening, exclude the morning thought
    const morningId = status.mast_thought_morning_id;
    const candidates = period === 'evening' && morningId
      ? entries.filter((e) => e.id !== morningId)
      : entries;

    if (candidates.length === 0) return entries[0]; // Fallback if only 1 entry

    let selected: MastEntry;

    if (rotation === 'every_open') {
      // Random each time
      selected = candidates[Math.floor(Math.random() * candidates.length)];
    } else if (rotation === 'weekly') {
      // Rotate on Mondays
      const weekNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
      const idx = period === 'morning'
        ? weekNum % candidates.length
        : (weekNum + 1) % candidates.length;
      selected = candidates[idx];
    } else {
      // Daily — deterministic based on date
      const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      const idx = period === 'morning'
        ? dayNum % candidates.length
        : (dayNum + 1) % candidates.length;
      selected = candidates[idx];
    }

    // Save selection to rhythm status
    const updateField = period === 'morning'
      ? { mast_thought_morning_id: selected.id, morning_reading_source: 'mast' }
      : { mast_thought_evening_id: selected.id, evening_reading_source: 'mast' };

    await supabase
      .from('daily_rhythm_status')
      .update(updateField)
      .eq('id', status.id);

    return selected;
  }, [user]);

  // Fetch Reveille data
  const fetchReveilleData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const [status, settings] = await Promise.all([
        getOrCreateRhythmStatus(),
        fetchSettings(),
      ]);
      if (!status) return;

      const today = getUserLocalDate(timezone);

      const [mastResult, tasksResult, recurringResult, trackersResult] = await Promise.all([
        supabase
          .from('mast_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null),
        supabase
          .from('compass_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('due_date', today)
          .eq('status', 'pending')
          .is('archived_at', null)
          .is('parent_task_id', null)
          .order('sort_order')
          .limit(5),
        // Recurring tasks for streaks
        supabase
          .from('compass_tasks')
          .select('id, title, due_date, status, recurrence_rule')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .is('parent_task_id', null)
          .not('recurrence_rule', 'is', null)
          .order('due_date', { ascending: false }),
        // Trackers with morning prompt
        supabase
          .from('custom_trackers')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .in('prompt_period', ['morning', 'both']),
      ]);

      const mastEntries = (mastResult.data || []) as MastEntry[];
      const mastThought = await selectMastThought(mastEntries, 'morning', status, settings);

      // Calculate streaks for recurring tasks due today
      const allRecurring = (recurringResult.data || []) as {
        id: string; title: string; due_date: string; status: string; recurrence_rule: string;
      }[];
      const habitMap: Record<string, { title: string; dates: { date: string; completed: boolean }[] }> = {};
      for (const t of allRecurring) {
        const key = `${t.title}::${t.recurrence_rule}`;
        if (!habitMap[key]) habitMap[key] = { title: t.title, dates: [] };
        habitMap[key].dates.push({ date: t.due_date, completed: t.status === 'completed' });
      }

      const streaks: StreakInfo[] = [];
      for (const [, habit] of Object.entries(habitMap)) {
        const sorted = habit.dates.sort((a, b) => b.date.localeCompare(a.date));
        // Only include if due today and not completed
        const todayEntry = sorted.find((d) => d.date === today);
        if (!todayEntry || todayEntry.completed) continue;

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastCompleted: string | null = null;

        for (const entry of sorted) {
          if (entry.date === today) continue; // Skip today for streak calc
          if (entry.completed) {
            tempStreak++;
            if (!lastCompleted) lastCompleted = entry.date;
          } else {
            if (currentStreak === 0) currentStreak = tempStreak;
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 0;
          }
        }
        if (currentStreak === 0) currentStreak = tempStreak;
        longestStreak = Math.max(longestStreak, tempStreak);

        streaks.push({
          taskId: todayEntry.date,
          taskTitle: habit.title,
          currentStreak,
          longestStreak,
          lastCompleted,
          isAtMilestone: STREAK_MILESTONES.includes(currentStreak),
          nextMilestone: getNextMilestone(currentStreak),
        });
      }

      // Get today's tracker entries for morning trackers
      const trackersList = (trackersResult.data || []) as CustomTracker[];
      let trackerEntriesMap: Record<string, TrackerEntry> = {};
      if (trackersList.length > 0) {
        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('entry_date', today)
          .in('tracker_id', trackersList.map((t) => t.id));
        for (const e of (entries || []) as TrackerEntry[]) {
          trackerEntriesMap[e.tracker_id] = e;
        }
      }

      // Fetch a Manifest devotional reading (non-blocking — don't fail Reveille if RAG fails)
      let manifestReading: ManifestReading | null = null;
      try {
        const manifestResults = await searchManifest(
          'devotional spiritual faith morning reflection scripture wisdom',
          user.id,
          { matchCount: 1, matchThreshold: 0.6 },
        );
        if (manifestResults.length > 0) {
          const chunk = manifestResults[0];
          // Trim to a readable passage (~300 chars)
          const text = chunk.content.length > 300
            ? chunk.content.substring(0, 300).replace(/\s+\S*$/, '') + '...'
            : chunk.content;
          manifestReading = { text, source: chunk.source_title };
        }
      } catch {
        // Silently skip — Manifest reading is optional
      }

      setReveilleData({
        mastThought,
        manifestReading,
        todayTasks: (tasksResult.data || []) as CompassTask[],
        streaks: streaks.sort((a, b) => b.currentStreak - a.currentStreak),
        trackers: trackersList.map((t) => ({ ...t, todayEntry: trackerEntriesMap[t.id] })),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Reveille data');
    } finally {
      setLoading(false);
    }
  }, [user, timezone, getOrCreateRhythmStatus, selectMastThought, fetchSettings]);

  // Check if a prompted entry is due based on frequency
  const isPromptDue = useCallback(async (
    type: 'gratitude' | 'joy' | 'anticipation',
    status: DailyRhythmStatus,
    settings: UserSettings | null,
  ): Promise<boolean> => {
    if (!user || !settings) return false;

    // If already completed today
    if (type === 'gratitude' && status.gratitude_prompt_completed) return false;
    if (type === 'joy' && status.joy_prompt_completed) return false;
    if (type === 'anticipation' && status.anticipation_prompt_completed) return false;

    const frequency = type === 'gratitude'
      ? settings.gratitude_prompt_frequency
      : type === 'joy'
        ? settings.joy_prompt_frequency
        : settings.anticipation_prompt_frequency;

    if (frequency === 'off') return false;
    if (frequency === 'daily') return true;

    // Look at history to determine if prompt is due
    const field = `${type}_prompt_completed`;
    const { data: history } = await supabase
      .from('daily_rhythm_status')
      .select('rhythm_date')
      .eq('user_id', user.id)
      .eq(field, true)
      .order('rhythm_date', { ascending: false })
      .limit(1);

    const lastCompleted = history?.[0]?.rhythm_date as string | undefined;
    if (!lastCompleted) return true; // Never completed, show it

    const daysSince = Math.floor(
      (new Date().getTime() - new Date(lastCompleted + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (frequency) {
      case 'every_other_day':
        return daysSince >= 2;
      case 'every_few_days':
        return daysSince >= 3;
      case 'weekly':
        return daysSince >= 7;
      case 'biweekly':
        return daysSince >= 14;
      default:
        return false;
    }
  }, [user]);

  // Build AI suggestion for tomorrow's priorities
  const buildAiSuggestion = useCallback((
    incompleteTasks: CompassTask[],
    tomorrowTasks: CompassTask[],
  ): string | null => {
    const suggestions: string[] = [];

    // Carried-forward tasks get top priority
    const carriedForward = incompleteTasks.slice(0, 3);
    if (carriedForward.length > 0) {
      suggestions.push(...carriedForward.map((t) => t.title));
    }

    // Frog-ranked tasks
    const frogTasks = tomorrowTasks
      .filter((t) => t.frog_rank && t.frog_rank > 0)
      .sort((a, b) => (a.frog_rank || 99) - (b.frog_rank || 99));
    if (frogTasks.length > 0 && suggestions.length < 3) {
      for (const t of frogTasks) {
        if (suggestions.length >= 3) break;
        if (!suggestions.includes(t.title)) suggestions.push(t.title);
      }
    }

    // Eisenhower do_now quadrant
    const doNow = tomorrowTasks
      .filter((t) => t.eisenhower_quadrant === 'do_now')
      .filter((t) => !suggestions.includes(t.title));
    for (const t of doNow) {
      if (suggestions.length >= 3) break;
      suggestions.push(t.title);
    }

    if (suggestions.length === 0) return null;

    return `Based on what carried forward and your priorities, consider focusing on: ${suggestions.join(', ')}.`;
  }, []);

  // Fetch Reckoning data
  const fetchReckoningData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const [status, settings] = await Promise.all([
        getOrCreateRhythmStatus(),
        fetchSettings(),
      ]);
      if (!status) return;

      const today = getUserLocalDate(timezone);
      const tomorrow = getTomorrowDate(today);
      const todayStart = `${today}T00:00:00`;
      const todayEnd = `${today}T23:59:59`;

      const [
        mastResult,
        completedResult,
        victoriesResult,
        incompleteResult,
        tomorrowResult,
        trackersResult,
      ] = await Promise.all([
        supabase
          .from('mast_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null),
        supabase
          .from('compass_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('archived_at', null)
          .is('parent_task_id', null)
          .gte('completed_at', todayStart)
          .lte('completed_at', todayEnd),
        supabase
          .from('victories')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('compass_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .is('archived_at', null)
          .is('parent_task_id', null)
          .lte('due_date', today)
          .order('due_date', { ascending: true }),
        supabase
          .from('compass_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('due_date', tomorrow)
          .in('status', ['pending', 'carried_forward'])
          .is('archived_at', null)
          .is('parent_task_id', null)
          .order('sort_order'),
        supabase
          .from('custom_trackers')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .in('prompt_period', ['evening', 'both']),
      ]);

      const mastEntries = (mastResult.data || []) as MastEntry[];
      const mastThought = await selectMastThought(mastEntries, 'evening', status, settings);

      const completedTasks = (completedResult.data || []) as CompassTask[];
      const incompleteTasks = (incompleteResult.data || []) as CompassTask[];
      const tomorrowTasks = (tomorrowResult.data || []) as CompassTask[];
      const victories = (victoriesResult.data || []) as Victory[];

      // Get today's tracker entries for evening trackers
      const trackersList = (trackersResult.data || []) as CustomTracker[];
      let trackerEntriesMap: Record<string, TrackerEntry> = {};
      if (trackersList.length > 0) {
        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('entry_date', today)
          .in('tracker_id', trackersList.map((t) => t.id));
        for (const e of (entries || []) as TrackerEntry[]) {
          trackerEntriesMap[e.tracker_id] = e;
        }
      }

      // Check prompt frequencies
      const [gratitudeDue, joyDue, anticipationDue] = await Promise.all([
        isPromptDue('gratitude', status, settings),
        isPromptDue('joy', status, settings),
        isPromptDue('anticipation', status, settings),
      ]);

      const aiSuggestion = buildAiSuggestion(incompleteTasks, tomorrowTasks);

      // Fetch a Manifest reading for closing thought (non-blocking)
      let manifestReading: ManifestReading | null = null;
      try {
        const manifestResults = await searchManifest(
          'evening reflection wisdom gratitude peace rest renewal perspective',
          user.id,
          { matchCount: 1, matchThreshold: 0.6 },
        );
        if (manifestResults.length > 0) {
          const chunk = manifestResults[0];
          const text = chunk.content.length > 300
            ? chunk.content.substring(0, 300).replace(/\s+\S*$/, '') + '...'
            : chunk.content;
          manifestReading = { text, source: chunk.source_title };
        }
      } catch {
        // Silently skip
      }

      setReckoningData({
        mastThought,
        manifestReading,
        completedTasks,
        victories,
        incompleteTasks,
        tomorrowTasks,
        trackers: trackersList.map((t) => ({ ...t, todayEntry: trackerEntriesMap[t.id] })),
        promptsDue: {
          gratitude: gratitudeDue,
          joy: joyDue,
          anticipation: anticipationDue,
        },
        aiSuggestion,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Reckoning data');
    } finally {
      setLoading(false);
    }
  }, [user, timezone, getOrCreateRhythmStatus, selectMastThought, isPromptDue, buildAiSuggestion, fetchSettings]);

  // Actions
  const dismissReveille = useCallback(async () => {
    if (!rhythmStatus || !user) return;
    await supabase
      .from('daily_rhythm_status')
      .update({ reveille_dismissed: true })
      .eq('id', rhythmStatus.id);
    setRhythmStatus((prev) => prev ? { ...prev, reveille_dismissed: true } : null);
  }, [rhythmStatus, user]);

  const dismissReckoning = useCallback(async () => {
    if (!rhythmStatus || !user) return;
    await supabase
      .from('daily_rhythm_status')
      .update({ reckoning_dismissed: true })
      .eq('id', rhythmStatus.id);
    setRhythmStatus((prev) => prev ? { ...prev, reckoning_dismissed: true } : null);
  }, [rhythmStatus, user]);

  const completeTask = useCallback(async (taskId: string) => {
    if (!user) return;
    await supabase
      .from('compass_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', user.id);
  }, [user]);

  const carryForwardTask = useCallback(async (taskId: string, newDate: string) => {
    if (!user) return;
    await supabase
      .from('compass_tasks')
      .update({ due_date: newDate, status: 'pending' })
      .eq('id', taskId)
      .eq('user_id', user.id);
  }, [user]);

  const cancelTask = useCallback(async (taskId: string) => {
    if (!user) return;
    await supabase
      .from('compass_tasks')
      .update({ status: 'cancelled' })
      .eq('id', taskId)
      .eq('user_id', user.id);
  }, [user]);

  const addTomorrowTask = useCallback(async (title: string) => {
    if (!user) return;
    const today = getUserLocalDate(timezone);
    const tomorrow = getTomorrowDate(today);
    const { data } = await supabase
      .from('compass_tasks')
      .insert({
        user_id: user.id,
        title,
        due_date: tomorrow,
        status: 'pending',
        source: 'manual',
      })
      .select()
      .single();
    return data as CompassTask | null;
  }, [user, timezone]);

  const logTrackerEntry = useCallback(async (
    trackerId: string,
    value: { numeric?: number; boolean?: boolean },
  ) => {
    if (!user) return;
    const today = getUserLocalDate(timezone);
    await supabase
      .from('tracker_entries')
      .upsert({
        tracker_id: trackerId,
        user_id: user.id,
        entry_date: today,
        value_numeric: value.numeric ?? null,
        value_boolean: value.boolean ?? null,
      }, { onConflict: 'tracker_id,entry_date' });
  }, [user, timezone]);

  const savePromptedEntry = useCallback(async (
    type: 'gratitude' | 'joy' | 'anticipation',
    text: string,
  ) => {
    if (!user || !rhythmStatus) return;

    // Determine entry type
    const entryType = type === 'gratitude' ? 'gratitude' : 'reflection';

    await supabase
      .from('log_entries')
      .insert({
        user_id: user.id,
        text,
        entry_type: entryType,
        source: 'manual_text',
      });

    // Mark prompt completed
    const field = `${type}_prompt_completed`;
    await supabase
      .from('daily_rhythm_status')
      .update({ [field]: true })
      .eq('id', rhythmStatus.id);

    setRhythmStatus((prev) => prev ? { ...prev, [field]: true } : null);
  }, [user, rhythmStatus]);

  const saveVictoryReviewNote = useCallback(async (
    text: string,
    triageType: 'course_correcting' | 'rough_waters',
    lifeAreaTag?: string,
  ): Promise<{ logEntryId?: string; taskId?: string }> => {
    if (!user) return {};

    const { data: logEntry } = await supabase
      .from('log_entries')
      .insert({
        user_id: user.id,
        text,
        entry_type: 'reflection',
        source: 'manual_text',
        life_area_tags: lifeAreaTag ? [lifeAreaTag] : [],
      })
      .select('id')
      .single();

    return { logEntryId: logEntry?.id as string | undefined };
  }, [user]);

  const createTaskFromNote = useCallback(async (title: string): Promise<string | null> => {
    if (!user) return null;
    const today = getUserLocalDate(timezone);
    const tomorrow = getTomorrowDate(today);

    const { data } = await supabase
      .from('compass_tasks')
      .insert({
        user_id: user.id,
        title,
        due_date: tomorrow,
        status: 'pending',
        source: 'manual',
      })
      .select('id')
      .single();

    return data?.id as string | null;
  }, [user, timezone]);

  // Initialize — check rhythm status on mount
  const initializeRhythms = useCallback(async () => {
    if (!user) return;
    await Promise.all([getOrCreateRhythmStatus(), fetchSettings()]);
  }, [user, getOrCreateRhythmStatus, fetchSettings]);

  return {
    rhythmStatus,
    reveilleData,
    reckoningData,
    loading,
    error,
    shouldShowReveille,
    shouldShowReckoning,
    initializeRhythms,
    fetchReveilleData,
    fetchReckoningData,
    dismissReveille,
    dismissReckoning,
    completeTask,
    carryForwardTask,
    cancelTask,
    addTomorrowTask,
    logTrackerEntry,
    savePromptedEntry,
    saveVictoryReviewNote,
    createTaskFromNote,
  };
}
