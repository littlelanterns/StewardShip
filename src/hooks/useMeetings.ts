import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  Meeting,
  MeetingSchedule,
  MeetingTemplate,
  MeetingType,
  MeetingFrequency,
  MeetingEntryMode,
  MeetingNotificationType,
  MeetingAgendaSection,
  MeetingTemplateSource,
  DayOfWeek,
  Person,
} from '../lib/types';

// Day index map for calculating next due dates
const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function calculateNextDueDate(
  frequency: MeetingFrequency,
  preferredDay: DayOfWeek | null,
  lastCompletedDate: string | null,
  customIntervalDays: number | null,
): string {
  const base = lastCompletedDate ? new Date(lastCompletedDate + 'T12:00:00') : new Date();
  let next: Date;

  switch (frequency) {
    case 'weekly': {
      next = new Date(base);
      next.setDate(next.getDate() + 7);
      if (preferredDay) {
        const targetDay = DAY_INDEX[preferredDay];
        const diff = (targetDay - next.getDay() + 7) % 7;
        // If diff is 0 and we haven't actually arrived at next week, add 7
        if (diff === 0 && lastCompletedDate) {
          // Already on the right day, keep it
        } else {
          next.setDate(next.getDate() + diff - 7); // Go to next occurrence from base
          if (next <= base) next.setDate(next.getDate() + 7);
        }
      }
      break;
    }
    case 'biweekly': {
      next = new Date(base);
      next.setDate(next.getDate() + 14);
      if (preferredDay) {
        const targetDay = DAY_INDEX[preferredDay];
        const diff = (targetDay - next.getDay() + 7) % 7;
        next.setDate(next.getDate() + diff);
        if (next.getTime() - base.getTime() < 10 * 24 * 60 * 60 * 1000) {
          next.setDate(next.getDate() + 7);
        }
      }
      break;
    }
    case 'monthly': {
      next = new Date(base);
      next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'quarterly': {
      next = new Date(base);
      next.setMonth(next.getMonth() + 3);
      break;
    }
    case 'custom': {
      next = new Date(base);
      next.setDate(next.getDate() + (customIntervalDays || 7));
      break;
    }
    default:
      next = new Date(base);
      next.setDate(next.getDate() + 7);
  }

  return next.toISOString().split('T')[0];
}

export interface MeetingWithPerson extends Meeting {
  person_name?: string;
}

export interface ScheduleWithPerson extends MeetingSchedule {
  person_name?: string;
}

export function useMeetings() {
  const { user } = useAuthContext();
  const [meetings, setMeetings] = useState<MeetingWithPerson[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithPerson | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithPerson[]>([]);
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Meeting CRUD ---

  const fetchMeetings = useCallback(async (type?: MeetingType, personId?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('meeting_date', { ascending: false })
        .limit(50);

      if (type) query = query.eq('meeting_type', type);
      if (personId) query = query.eq('related_person_id', personId);

      const { data, error: err } = await query;
      if (err) throw err;

      // Resolve person names
      const meetingList = (data || []) as Meeting[];
      const personIds = [...new Set(meetingList.filter(m => m.related_person_id).map(m => m.related_person_id!))];
      let personMap: Record<string, string> = {};

      if (personIds.length > 0) {
        const { data: people } = await supabase
          .from('people')
          .select('id, name')
          .in('id', personIds);
        for (const p of (people || []) as Pick<Person, 'id' | 'name'>[]) {
          personMap[p.id] = p.name;
        }
      }

      setMeetings(meetingList.map(m => ({
        ...m,
        person_name: m.related_person_id ? personMap[m.related_person_id] : undefined,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMeeting = useCallback(async (id: string) => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (err || !data) return;
    const meeting = data as Meeting;

    let personName: string | undefined;
    if (meeting.related_person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('name')
        .eq('id', meeting.related_person_id)
        .single();
      personName = (person as { name: string } | null)?.name;
    }

    const result = { ...meeting, person_name: personName };
    setSelectedMeeting(result);
    return result;
  }, [user]);

  const createMeeting = useCallback(async (data: {
    meeting_type: MeetingType;
    related_person_id?: string;
    template_id?: string;
    entry_mode: MeetingEntryMode;
    meeting_date?: string;
  }): Promise<Meeting | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: created, error: err } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          meeting_type: data.meeting_type,
          related_person_id: data.related_person_id || null,
          template_id: data.template_id || null,
          entry_mode: data.entry_mode,
          meeting_date: data.meeting_date || new Date().toISOString().split('T')[0],
          status: 'in_progress',
        })
        .select()
        .single();

      if (err) throw err;
      const meeting = created as Meeting;
      setMeetings(prev => [meeting, ...prev]);
      return meeting;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create meeting');
      return null;
    }
  }, [user]);

  const updateMeeting = useCallback(async (id: string, updates: Partial<Meeting>) => {
    if (!user) return;
    // Optimistic update
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    if (selectedMeeting?.id === id) {
      setSelectedMeeting(prev => prev ? { ...prev, ...updates } : null);
    }

    const { error: err } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) {
      fetchMeetings();
    }
  }, [user, selectedMeeting, fetchMeetings]);

  const completeMeeting = useCallback(async (
    id: string,
    summary: string,
    impressions?: string,
    helmConversationId?: string,
    logEntryId?: string,
  ) => {
    if (!user) return;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    await updateMeeting(id, {
      status: 'completed',
      completed_at: now,
      summary,
      impressions: impressions || null,
      helm_conversation_id: helmConversationId || null,
      log_entry_id: logEntryId || null,
    });

    // Find and update the related schedule
    const meeting = meetings.find(m => m.id === id);
    if (meeting) {
      const matchingSchedules = schedules.filter(s =>
        s.meeting_type === meeting.meeting_type &&
        s.is_active &&
        (meeting.related_person_id ? s.related_person_id === meeting.related_person_id : true)
      );

      for (const schedule of matchingSchedules) {
        const nextDue = calculateNextDueDate(
          schedule.frequency,
          schedule.preferred_day,
          today,
          schedule.custom_interval_days,
        );

        await supabase
          .from('meeting_schedules')
          .update({
            last_completed_date: today,
            next_due_date: nextDue,
          })
          .eq('id', schedule.id)
          .eq('user_id', user.id);

        setSchedules(prev => prev.map(s =>
          s.id === schedule.id
            ? { ...s, last_completed_date: today, next_due_date: nextDue }
            : s
        ));
      }
    }

    // Generate pattern note if 5+ meetings exist for this type
    if (meeting) {
      const { count } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('meeting_type', meeting.meeting_type)
        .eq('status', 'completed');

      if (count && count >= 5) {
        // Pattern note generation could happen here via an AI call
        // For now, we store null and let the AI detect patterns in conversation context
      }
    }
  }, [user, meetings, schedules, updateMeeting]);

  const skipMeeting = useCallback(async (scheduleId: string) => {
    if (!user) return;
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const today = new Date().toISOString().split('T')[0];

    // Create a skipped meeting record
    await supabase
      .from('meetings')
      .insert({
        user_id: user.id,
        meeting_type: schedule.meeting_type,
        related_person_id: schedule.related_person_id,
        template_id: schedule.template_id,
        entry_mode: 'live',
        meeting_date: today,
        status: 'skipped',
      });

    // Advance the schedule
    const nextDue = calculateNextDueDate(
      schedule.frequency,
      schedule.preferred_day,
      today,
      schedule.custom_interval_days,
    );

    await supabase
      .from('meeting_schedules')
      .update({ next_due_date: nextDue })
      .eq('id', scheduleId)
      .eq('user_id', user.id);

    setSchedules(prev => prev.map(s =>
      s.id === scheduleId ? { ...s, next_due_date: nextDue } : s
    ));
  }, [user, schedules]);

  // --- Schedule CRUD ---

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('meeting_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('meeting_type')
        .order('next_due_date');

      if (err) throw err;
      const scheduleList = (data || []) as MeetingSchedule[];

      // Resolve person names
      const personIds = [...new Set(scheduleList.filter(s => s.related_person_id).map(s => s.related_person_id!))];
      let personMap: Record<string, string> = {};

      if (personIds.length > 0) {
        const { data: people } = await supabase
          .from('people')
          .select('id, name')
          .in('id', personIds);
        for (const p of (people || []) as Pick<Person, 'id' | 'name'>[]) {
          personMap[p.id] = p.name;
        }
      }

      setSchedules(scheduleList.map(s => ({
        ...s,
        person_name: s.related_person_id ? personMap[s.related_person_id] : undefined,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules');
    }
  }, [user]);

  const createSchedule = useCallback(async (data: {
    meeting_type: MeetingType;
    related_person_id?: string;
    template_id?: string;
    frequency: MeetingFrequency;
    custom_interval_days?: number;
    preferred_day?: DayOfWeek;
    preferred_time?: string;
    notification_type?: MeetingNotificationType;
  }): Promise<MeetingSchedule | null> => {
    if (!user) return null;
    setError(null);
    try {
      const nextDue = calculateNextDueDate(
        data.frequency,
        data.preferred_day || null,
        null,
        data.custom_interval_days || null,
      );

      const { data: created, error: err } = await supabase
        .from('meeting_schedules')
        .insert({
          user_id: user.id,
          meeting_type: data.meeting_type,
          related_person_id: data.related_person_id || null,
          template_id: data.template_id || null,
          frequency: data.frequency,
          custom_interval_days: data.custom_interval_days || null,
          preferred_day: data.preferred_day || null,
          preferred_time: data.preferred_time || null,
          notification_type: data.notification_type || 'reveille',
          next_due_date: nextDue,
          is_active: true,
        })
        .select()
        .single();

      if (err) throw err;
      const schedule = created as MeetingSchedule;
      setSchedules(prev => [...prev, schedule]);
      return schedule;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create schedule');
      return null;
    }
  }, [user]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<MeetingSchedule>) => {
    if (!user) return;
    // Recalculate next_due_date if frequency or preferred_day changes
    const schedule = schedules.find(s => s.id === id);
    if (schedule && (updates.frequency || updates.preferred_day !== undefined)) {
      const freq = updates.frequency || schedule.frequency;
      const day = updates.preferred_day !== undefined ? updates.preferred_day : schedule.preferred_day;
      const customDays = updates.custom_interval_days !== undefined ? updates.custom_interval_days : schedule.custom_interval_days;
      updates.next_due_date = calculateNextDueDate(freq, day, schedule.last_completed_date, customDays);
    }

    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    const { error: err } = await supabase
      .from('meeting_schedules')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) fetchSchedules();
  }, [user, schedules, fetchSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    if (!user) return;
    setSchedules(prev => prev.filter(s => s.id !== id));

    await supabase
      .from('meeting_schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user]);

  const fetchUpcomingMeetings = useCallback(async (): Promise<ScheduleWithPerson[]> => {
    if (!user) return [];
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const { data } = await supabase
      .from('meeting_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_due_date', nextWeekStr)
      .order('next_due_date', { ascending: true });

    const scheduleList = (data || []) as MeetingSchedule[];

    // Resolve person names
    const personIds = [...new Set(scheduleList.filter(s => s.related_person_id).map(s => s.related_person_id!))];
    let personMap: Record<string, string> = {};

    if (personIds.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, name')
        .in('id', personIds);
      for (const p of (people || []) as Pick<Person, 'id' | 'name'>[]) {
        personMap[p.id] = p.name;
      }
    }

    return scheduleList.map(s => ({
      ...s,
      person_name: s.related_person_id ? personMap[s.related_person_id] : undefined,
    }));
  }, [user]);

  // --- Template CRUD ---

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('meeting_templates')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setTemplates((data || []) as MeetingTemplate[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    }
  }, [user]);

  const createTemplate = useCallback(async (data: {
    name: string;
    description?: string;
    default_frequency?: MeetingFrequency;
    default_related_person_id?: string;
    agenda_sections: MeetingAgendaSection[];
    source: MeetingTemplateSource;
    file_storage_path?: string;
  }): Promise<MeetingTemplate | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data: created, error: err } = await supabase
        .from('meeting_templates')
        .insert({
          user_id: user.id,
          name: data.name,
          description: data.description || null,
          default_frequency: data.default_frequency || 'weekly',
          default_related_person_id: data.default_related_person_id || null,
          agenda_sections: data.agenda_sections,
          source: data.source,
          file_storage_path: data.file_storage_path || null,
        })
        .select()
        .single();

      if (err) throw err;
      const template = created as MeetingTemplate;
      setTemplates(prev => [template, ...prev]);
      return template;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create template');
      return null;
    }
  }, [user]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<MeetingTemplate>) => {
    if (!user) return;
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    const { error: err } = await supabase
      .from('meeting_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (err) fetchTemplates();
  }, [user, fetchTemplates]);

  const archiveTemplate = useCallback(async (id: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    setTemplates(prev => prev.filter(t => t.id !== id));

    await supabase
      .from('meeting_templates')
      .update({ archived_at: now })
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user]);

  // --- Meeting history for a type/person ---

  const fetchMeetingHistory = useCallback(async (
    type: MeetingType,
    personId?: string,
  ): Promise<MeetingWithPerson[]> => {
    if (!user) return [];

    let query = supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.id)
      .eq('meeting_type', type)
      .eq('status', 'completed')
      .order('meeting_date', { ascending: false })
      .limit(20);

    if (personId) query = query.eq('related_person_id', personId);

    const { data } = await query;
    return (data || []) as MeetingWithPerson[];
  }, [user]);

  // Fetch most recent pattern note for a type/person
  const fetchPatternNote = useCallback(async (
    type: MeetingType,
    personId?: string,
  ): Promise<string | null> => {
    if (!user) return null;

    let query = supabase
      .from('meetings')
      .select('pattern_note')
      .eq('user_id', user.id)
      .eq('meeting_type', type)
      .not('pattern_note', 'is', null)
      .order('meeting_date', { ascending: false })
      .limit(1);

    if (personId) query = query.eq('related_person_id', personId);

    const { data } = await query;
    return (data?.[0] as { pattern_note: string } | undefined)?.pattern_note || null;
  }, [user]);

  return {
    meetings,
    selectedMeeting,
    schedules,
    templates,
    loading,
    error,
    setSelectedMeeting,
    fetchMeetings,
    fetchMeeting,
    createMeeting,
    updateMeeting,
    completeMeeting,
    skipMeeting,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    fetchUpcomingMeetings,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    archiveTemplate,
    fetchMeetingHistory,
    fetchPatternNote,
  };
}
