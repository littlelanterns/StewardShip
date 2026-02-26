import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { searchManifest } from '../lib/rag';
import type {
  RhythmType,
  RhythmCardStatus,
  UserSettings,
  MastEntry,
} from '../lib/types';

// === Period Key Helpers ===

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getPeriodKey(rhythmType: RhythmType): string {
  const now = new Date();
  const year = now.getFullYear();
  switch (rhythmType) {
    case 'friday_overview':
    case 'sunday_reflection': {
      const week = getISOWeek(now);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'monthly_review':
      return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'quarterly_inventory': {
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      return `${year}-Q${quarter}`;
    }
  }
}

function getDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function getUserLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getStartOfWeek(today: string): string {
  const d = new Date(today + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// === Reflection Prompt Rotation ===

const FRIDAY_REFLECTION_PROMPTS = [
  "What's one thing from this week you want to carry into next week?",
  "What surprised you this week?",
  "What are you most proud of from this week?",
  "What did you learn about yourself this week?",
  "Who made a difference in your week?",
  "What would you do differently if you could replay this week?",
  "What's one small win you almost overlooked?",
];

const SUNDAY_RENEWAL_PROMPTS: Record<string, { faith: string; secular: string }> = {
  physical: {
    faith: "How did you care for your body this week? What does your body need in the week ahead?",
    secular: "How did you care for your body this week? What does your body need in the week ahead?",
  },
  spiritual: {
    faith: "Where did you feel closest to God this week? Where do you want to draw nearer?",
    secular: "What moments of peace or meaning did you experience this week? Where do you want more of that?",
  },
  mental: {
    faith: "What did you learn this week? What are you curious about?",
    secular: "What did you learn this week? What are you curious about?",
  },
  social: {
    faith: "Who did you connect with this week? Who needs your attention next week?",
    secular: "Who did you connect with this week? Who needs your attention next week?",
  },
};

const RENEWAL_DIMENSIONS = ['physical', 'spiritual', 'mental', 'social'];

// === Data Interfaces ===

export interface FridayOverviewData {
  name: string;
  tasksCompleted: number;
  tasksCarried: number;
  tasksCancelled: number;
  victoryCount: number;
  victories: { description: string }[];
  streakNames: string[];
  weekThemes: { tag: string; count: number }[];
  nextWeekTasks: { title: string }[];
  nextWeekMeetings: { type: string; personName: string | null }[];
  nextWeekDates: { label: string; personName: string; date: string }[];
  approachingMilestones: { title: string; planTitle: string }[];
  reflectionPrompt: string;
}

export interface SundayReflectionData {
  name: string;
  mastReading: { text: string; type: string } | null;
  manifestReading: { text: string; source: string } | null;
  renewalDimension: string;
  renewalPrompt: string;
  hasFaith: boolean;
}

export interface MonthlyReviewData {
  name: string;
  tasksCompleted: number;
  victoriesCount: number;
  logEntriesCount: number;
}

export interface QuarterlyInventoryData {
  name: string;
  monthsSinceLastUpdate: number;
}

// === Hook ===

export function useRhythmCards() {
  const { user, profile } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const timezone = profile?.timezone || 'America/Chicago';
  const name = profile?.display_name || 'Steward';

  // Check if a rhythm card should show
  const checkRhythmDue = useCallback(async (
    rhythmType: RhythmType,
    settings: UserSettings | null,
  ): Promise<boolean> => {
    if (!user || !settings) return false;

    const todayName = getDayName();

    switch (rhythmType) {
      case 'friday_overview':
        if (!settings.friday_overview_enabled) return false;
        if (todayName !== settings.friday_overview_day) return false;
        break;
      case 'sunday_reflection':
        if (!settings.sunday_reflection_enabled) return false;
        if (todayName !== settings.sunday_reflection_day) return false;
        break;
      case 'monthly_review':
        if (!settings.monthly_review_enabled) return false;
        if (new Date().getDate() !== settings.monthly_review_day) return false;
        break;
      case 'quarterly_inventory':
        if (!settings.quarterly_inventory_enabled) return false;
        // Check months since last Life Inventory update
        break;
    }

    // Check if already dismissed for this period
    const periodKey = getPeriodKey(rhythmType);
    const { data: existing } = await supabase
      .from('rhythm_status')
      .select('status')
      .eq('user_id', user.id)
      .eq('rhythm_type', rhythmType)
      .eq('period_key', periodKey)
      .maybeSingle();

    if (existing && (existing.status === 'dismissed' || existing.status === 'completed')) {
      return false;
    }

    // For quarterly inventory, check if it's been ~90 days since last Life Inventory update
    if (rhythmType === 'quarterly_inventory') {
      const { data: areas } = await supabase
        .from('life_inventory_areas')
        .select('updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (areas && areas.length > 0) {
        const lastUpdate = new Date(areas[0].updated_at as string);
        const daysSince = Math.floor(
          (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince < 75) return false; // Not yet ~90 days
      }
    }

    return true;
  }, [user]);

  // Show a rhythm (mark as shown)
  const showRhythm = useCallback(async (
    rhythmType: RhythmType,
    periodKey: string,
  ) => {
    if (!user) return;
    await supabase
      .from('rhythm_status')
      .upsert({
        user_id: user.id,
        rhythm_type: rhythmType,
        period_key: periodKey,
        status: 'shown' as RhythmCardStatus,
        shown_at: new Date().toISOString(),
      }, { onConflict: 'user_id,rhythm_type,period_key' });
  }, [user]);

  // Dismiss a rhythm
  const dismissRhythm = useCallback(async (
    rhythmType: RhythmType,
    periodKey: string,
  ) => {
    if (!user) return;
    await supabase
      .from('rhythm_status')
      .upsert({
        user_id: user.id,
        rhythm_type: rhythmType,
        period_key: periodKey,
        status: 'dismissed' as RhythmCardStatus,
        dismissed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,rhythm_type,period_key' });
  }, [user]);

  // Complete a rhythm
  const completeRhythm = useCallback(async (
    rhythmType: RhythmType,
    periodKey: string,
  ) => {
    if (!user) return;
    await supabase
      .from('rhythm_status')
      .upsert({
        user_id: user.id,
        rhythm_type: rhythmType,
        period_key: periodKey,
        status: 'completed' as RhythmCardStatus,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,rhythm_type,period_key' });
  }, [user]);

  // Fetch Friday Overview data
  const fetchFridayOverviewData = useCallback(async (): Promise<FridayOverviewData | null> => {
    if (!user) return null;
    setLoading(true);

    try {
      const today = getUserLocalDate(timezone);
      const weekStart = getStartOfWeek(today);
      const nextWeekEnd = (() => {
        const d = new Date(today + 'T12:00:00');
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
      })();

      const [
        completedResult,
        carriedResult,
        cancelledResult,
        victoriesResult,
        recurringResult,
        logResult,
        nextTasksResult,
        nextMeetingsResult,
        peopleResult,
        milestonesResult,
      ] = await Promise.all([
        // Tasks completed this week
        supabase.from('compass_tasks').select('id')
          .eq('user_id', user.id).eq('status', 'completed')
          .is('parent_task_id', null)
          .gte('completed_at', weekStart + 'T00:00:00'),
        // Tasks carried forward
        supabase.from('compass_tasks').select('id')
          .eq('user_id', user.id).eq('status', 'carried_forward')
          .is('parent_task_id', null)
          .gte('updated_at', weekStart + 'T00:00:00'),
        // Tasks cancelled
        supabase.from('compass_tasks').select('id')
          .eq('user_id', user.id).eq('status', 'cancelled')
          .is('parent_task_id', null)
          .gte('updated_at', weekStart + 'T00:00:00'),
        // Victories this week
        supabase.from('victories').select('description')
          .eq('user_id', user.id).is('archived_at', null)
          .gte('created_at', weekStart + 'T00:00:00').limit(3),
        // Recurring tasks (for streak names)
        supabase.from('compass_tasks')
          .select('title, recurrence_rule')
          .eq('user_id', user.id).is('archived_at', null)
          .not('recurrence_rule', 'is', null)
          .eq('status', 'completed')
          .gte('completed_at', weekStart + 'T00:00:00'),
        // Log entries this week — get life area tags
        supabase.from('log_entries').select('life_area_tags')
          .eq('user_id', user.id).is('archived_at', null)
          .gte('created_at', weekStart + 'T00:00:00'),
        // Next week tasks
        supabase.from('compass_tasks').select('title')
          .eq('user_id', user.id).eq('status', 'pending')
          .is('parent_task_id', null).is('archived_at', null)
          .gt('due_date', today).lte('due_date', nextWeekEnd)
          .order('due_date').limit(5),
        // Next week meetings
        supabase.from('meeting_schedules')
          .select('meeting_type, related_person_id, next_due_date')
          .eq('user_id', user.id).eq('is_active', true)
          .gt('next_due_date', today).lte('next_due_date', nextWeekEnd),
        // People with important dates in next 7 days
        supabase.from('people').select('name, important_dates')
          .eq('user_id', user.id).is('archived_at', null),
        // Approaching Rigging milestones
        supabase.from('rigging_milestones')
          .select('title, plan_id, target_date')
          .eq('user_id', user.id)
          .in('status', ['not_started', 'in_progress'])
          .gt('target_date', today).lte('target_date', nextWeekEnd),
      ]);

      // Build streaks (unique recurring task titles)
      const streakNames = [...new Set(
        (recurringResult.data || []).map((t: { title: string }) => t.title)
      )];

      // Build week themes from life area tags
      const tagCounts: Record<string, number> = {};
      for (const entry of (logResult.data || []) as { life_area_tags: string[] }[]) {
        for (const tag of (entry.life_area_tags || [])) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
      const weekThemes = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag, count }));

      // Resolve meeting person names
      const meetingData = (nextMeetingsResult.data || []) as {
        meeting_type: string; related_person_id: string | null; next_due_date: string;
      }[];
      const meetingPersonIds = meetingData.map((m) => m.related_person_id).filter(Boolean) as string[];
      let meetingPersonMap: Record<string, string> = {};
      if (meetingPersonIds.length > 0) {
        const { data: ppl } = await supabase.from('people').select('id, name').in('id', meetingPersonIds);
        for (const p of (ppl || []) as { id: string; name: string }[]) {
          meetingPersonMap[p.id] = p.name;
        }
      }

      // Build important dates in next 7 days
      const nextWeekDates: { label: string; personName: string; date: string }[] = [];
      for (const person of (peopleResult.data || []) as { name: string; important_dates: ImportantDate[] | null }[]) {
        for (const d of (person.important_dates || [])) {
          if (!d.date) continue;
          const eventDate = d.recurring
            ? `${today.substring(0, 4)}-${d.date.substring(5)}`
            : d.date;
          if (eventDate > today && eventDate <= nextWeekEnd) {
            nextWeekDates.push({ label: d.label, personName: person.name, date: eventDate });
          }
        }
      }

      // Resolve milestone plan titles
      const milestoneData = (milestonesResult.data || []) as {
        title: string; plan_id: string; target_date: string;
      }[];
      let planTitleMap: Record<string, string> = {};
      if (milestoneData.length > 0) {
        const planIds = [...new Set(milestoneData.map((m) => m.plan_id))];
        const { data: plans } = await supabase.from('rigging_plans').select('id, title').in('id', planIds);
        for (const p of (plans || []) as { id: string; title: string }[]) {
          planTitleMap[p.id] = p.title;
        }
      }

      // Pick reflection prompt by week number
      const weekNum = getISOWeek(new Date());
      const reflectionPrompt = FRIDAY_REFLECTION_PROMPTS[weekNum % FRIDAY_REFLECTION_PROMPTS.length];

      return {
        name,
        tasksCompleted: completedResult.data?.length || 0,
        tasksCarried: carriedResult.data?.length || 0,
        tasksCancelled: cancelledResult.data?.length || 0,
        victoryCount: victoriesResult.data?.length || 0,
        victories: (victoriesResult.data || []).map((v: { description: string }) => ({ description: v.description })),
        streakNames,
        weekThemes,
        nextWeekTasks: (nextTasksResult.data || []).map((t: { title: string }) => ({ title: t.title })),
        nextWeekMeetings: meetingData.map((m) => ({
          type: m.meeting_type.replace(/_/g, ' '),
          personName: m.related_person_id ? meetingPersonMap[m.related_person_id] || null : null,
        })),
        nextWeekDates,
        approachingMilestones: milestoneData.map((m) => ({
          title: m.title,
          planTitle: planTitleMap[m.plan_id] || 'Plan',
        })),
        reflectionPrompt,
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, timezone, name]);

  // Fetch Sunday Reflection data
  const fetchSundayReflectionData = useCallback(async (): Promise<SundayReflectionData | null> => {
    if (!user) return null;
    setLoading(true);

    try {
      // Get Mast entries — faith or vision types for reading
      const { data: mastEntries } = await supabase
        .from('mast_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .in('type', ['faith_foundation', 'scripture_quote', 'value', 'vision']);

      const mast = (mastEntries || []) as MastEntry[];
      const faithEntries = mast.filter((e) => e.type === 'faith_foundation' || e.type === 'scripture_quote');
      const hasFaith = faithEntries.length > 0;

      // Pick a mast reading — rotated weekly
      const weekNum = getISOWeek(new Date());
      let mastReading: { text: string; type: string } | null = null;
      const candidates = faithEntries.length > 0 ? faithEntries : mast;
      if (candidates.length > 0) {
        const idx = weekNum % candidates.length;
        mastReading = { text: candidates[idx].text, type: candidates[idx].type };
      }

      // Try manifest devotional
      let manifestReading: { text: string; source: string } | null = null;
      try {
        const results = await searchManifest(
          'spiritual faith reflection renewal rest sabbath peace',
          user.id,
          { matchCount: 1, matchThreshold: 0.6 },
        );
        if (results.length > 0) {
          const chunk = results[0];
          const text = chunk.chunk_text.length > 300
            ? chunk.chunk_text.substring(0, 300).replace(/\s+\S*$/, '') + '...'
            : chunk.chunk_text;
          manifestReading = { text, source: chunk.source_title || '' };
        }
      } catch {
        // Silently skip
      }

      // Renewal dimension — rotate by week number
      const dimIdx = weekNum % RENEWAL_DIMENSIONS.length;
      const renewalDimension = RENEWAL_DIMENSIONS[dimIdx];
      const prompts = SUNDAY_RENEWAL_PROMPTS[renewalDimension];
      const renewalPrompt = hasFaith ? prompts.faith : prompts.secular;

      return {
        name,
        mastReading,
        manifestReading,
        renewalDimension,
        renewalPrompt,
        hasFaith,
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, name]);

  // Fetch Monthly Review data
  const fetchMonthlyReviewData = useCallback(async (): Promise<MonthlyReviewData | null> => {
    if (!user) return null;

    const today = getUserLocalDate(timezone);
    const lastMonthStart = (() => {
      const d = new Date(today + 'T12:00:00');
      d.setMonth(d.getMonth() - 1);
      d.setDate(1);
      return d.toISOString().split('T')[0];
    })();
    const lastMonthEnd = (() => {
      const d = new Date(today + 'T12:00:00');
      d.setDate(0); // Last day of previous month
      return d.toISOString().split('T')[0];
    })();

    const [tasksResult, victoriesResult, logResult] = await Promise.all([
      supabase.from('compass_tasks').select('id')
        .eq('user_id', user.id).eq('status', 'completed')
        .gte('completed_at', lastMonthStart + 'T00:00:00')
        .lte('completed_at', lastMonthEnd + 'T23:59:59'),
      supabase.from('victories').select('id')
        .eq('user_id', user.id).is('archived_at', null)
        .gte('created_at', lastMonthStart + 'T00:00:00')
        .lte('created_at', lastMonthEnd + 'T23:59:59'),
      supabase.from('log_entries').select('id')
        .eq('user_id', user.id).is('archived_at', null)
        .gte('created_at', lastMonthStart + 'T00:00:00')
        .lte('created_at', lastMonthEnd + 'T23:59:59'),
    ]);

    return {
      name,
      tasksCompleted: tasksResult.data?.length || 0,
      victoriesCount: victoriesResult.data?.length || 0,
      logEntriesCount: logResult.data?.length || 0,
    };
  }, [user, timezone, name]);

  // Fetch Quarterly Inventory data
  const fetchQuarterlyInventoryData = useCallback(async (): Promise<QuarterlyInventoryData | null> => {
    if (!user) return null;

    const { data: areas } = await supabase
      .from('life_inventory_areas')
      .select('updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    let monthsSince = 3; // Default
    if (areas && areas.length > 0) {
      const lastUpdate = new Date(areas[0].updated_at as string);
      monthsSince = Math.floor(
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
    }

    return { name, monthsSinceLastUpdate: monthsSince };
  }, [user, name]);

  // Save reflection response to Log
  const saveReflectionToLog = useCallback(async (text: string): Promise<string | null> => {
    if (!user || !text.trim()) return null;

    const { data, error: err } = await supabase
      .from('log_entries')
      .insert({
        user_id: user.id,
        text: text.trim(),
        entry_type: 'reflection',
        source: 'manual_text',
      })
      .select('id')
      .single();

    if (err) return null;
    return data.id as string;
  }, [user]);

  // Create task from intention
  const createTaskFromIntention = useCallback(async (title: string): Promise<string | null> => {
    if (!user || !title.trim()) return null;

    const tomorrow = getTomorrowFromTimezone(timezone);

    const { data, error: err } = await supabase
      .from('compass_tasks')
      .insert({
        user_id: user.id,
        title: title.trim(),
        due_date: tomorrow,
        status: 'pending',
        source: 'manual',
      })
      .select('id')
      .single();

    if (err) return null;
    return data.id as string;
  }, [user, timezone]);

  return {
    loading,
    checkRhythmDue,
    showRhythm,
    dismissRhythm,
    completeRhythm,
    fetchFridayOverviewData,
    fetchSundayReflectionData,
    fetchMonthlyReviewData,
    fetchQuarterlyInventoryData,
    saveReflectionToLog,
    createTaskFromIntention,
  };
}

// Helper types used in data fetching
interface ImportantDate {
  label: string;
  date: string;
  recurring: boolean;
}

function getTomorrowFromTimezone(timezone: string): string {
  const today = getUserLocalDate(timezone);
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
