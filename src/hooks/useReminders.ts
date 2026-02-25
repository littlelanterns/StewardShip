import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  Reminder,
  ReminderType,
  ReminderDeliveryMethod,
  ReminderStatus,
  ReminderEntityType,
  ReminderSourceFeature,
  SnoozePreset,
  UserSettings,
  ImportantDate,
} from '../lib/types';

function getUserLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getTomorrowDate(today: string): string {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function addDaysToDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function calculateSnoozeTime(
  preset: SnoozePreset,
  reveilleTime: string = '07:00',
): string {
  const now = new Date();
  switch (preset) {
    case '1_hour': {
      now.setHours(now.getHours() + 1);
      return now.toISOString();
    }
    case 'later_today': {
      now.setHours(now.getHours() + 6);
      return now.toISOString();
    }
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [h, m] = reveilleTime.split(':').map(Number);
      tomorrow.setHours(h, m, 0, 0);
      return tomorrow.toISOString();
    }
    case 'next_week': {
      const nextMonday = new Date(now);
      const day = nextMonday.getDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      const [h, m] = reveilleTime.split(':').map(Number);
      nextMonday.setHours(h, m, 0, 0);
      return nextMonday.toISOString();
    }
  }
}

export function useReminders() {
  const { user, profile } = useAuthContext();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = profile?.timezone || 'America/Chicago';

  // Fetch pending reminders with optional delivery method filter
  const fetchPendingReminders = useCallback(async (
    deliveryMethod?: ReminderDeliveryMethod,
  ): Promise<Reminder[]> => {
    if (!user) return [];
    const now = new Date().toISOString();

    let query = supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .in('status', ['pending', 'snoozed']);

    if (deliveryMethod) {
      query = query.eq('delivery_method', deliveryMethod);
    }

    const { data, error: err } = await query.order('scheduled_at', { ascending: true, nullsFirst: true });
    if (err) return [];

    // Filter: snoozed reminders only if snoozed_until <= now
    const filtered = (data as Reminder[]).filter((r) => {
      if (r.status === 'snoozed' && r.snoozed_until) {
        return r.snoozed_until <= now;
      }
      return true;
    });

    return filtered;
  }, [user]);

  // Fetch reveille batch reminders
  const fetchReveilleReminders = useCallback(async (): Promise<Reminder[]> => {
    if (!user) return [];
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('delivery_method', 'reveille_batch')
      .in('status', ['pending', 'snoozed'])
      .is('archived_at', null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('created_at', { ascending: true });

    if (!data) return [];

    return (data as Reminder[]).filter((r) => {
      if (r.status === 'snoozed' && r.snoozed_until) {
        return r.snoozed_until <= now;
      }
      return true;
    });
  }, [user]);

  // Fetch reckoning batch reminders
  const fetchReckoningReminders = useCallback(async (): Promise<Reminder[]> => {
    if (!user) return [];
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('delivery_method', 'reckoning_batch')
      .in('status', ['pending', 'snoozed'])
      .is('archived_at', null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('created_at', { ascending: true });

    if (!data) return [];

    return (data as Reminder[]).filter((r) => {
      if (r.status === 'snoozed' && r.snoozed_until) {
        return r.snoozed_until <= now;
      }
      return true;
    });
  }, [user]);

  // Check if a duplicate reminder exists
  const checkDuplicate = useCallback(async (
    reminderType: ReminderType,
    relatedEntityType: ReminderEntityType,
    relatedEntityId: string | null,
  ): Promise<boolean> => {
    if (!user || !relatedEntityId) return false;

    const { data } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', user.id)
      .eq('reminder_type', reminderType)
      .eq('related_entity_type', relatedEntityType as string)
      .eq('related_entity_id', relatedEntityId)
      .in('status', ['pending', 'delivered', 'snoozed'])
      .is('archived_at', null)
      .limit(1);

    return (data?.length || 0) > 0;
  }, [user]);

  // Create a reminder with deduplication
  const createReminder = useCallback(async (data: {
    reminder_type: ReminderType;
    title: string;
    body?: string | null;
    delivery_method?: ReminderDeliveryMethod;
    scheduled_at?: string | null;
    related_entity_type?: ReminderEntityType;
    related_entity_id?: string | null;
    source_feature: ReminderSourceFeature;
    metadata?: Record<string, unknown>;
  }): Promise<Reminder | null> => {
    if (!user) return null;

    // Dedup check
    if (data.related_entity_id && data.related_entity_type) {
      const exists = await checkDuplicate(
        data.reminder_type,
        data.related_entity_type,
        data.related_entity_id,
      );
      if (exists) return null;
    }

    const { data: created, error: err } = await supabase
      .from('reminders')
      .insert({
        user_id: user.id,
        reminder_type: data.reminder_type,
        title: data.title,
        body: data.body ?? null,
        delivery_method: data.delivery_method || 'reveille_batch',
        scheduled_at: data.scheduled_at ?? null,
        status: 'pending' as ReminderStatus,
        related_entity_type: data.related_entity_type ?? null,
        related_entity_id: data.related_entity_id ?? null,
        source_feature: data.source_feature,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (err) return null;
    return created as Reminder;
  }, [user, checkDuplicate]);

  // Dismiss a reminder
  const dismissReminder = useCallback(async (id: string) => {
    if (!user) return;
    await supabase
      .from('reminders')
      .update({ status: 'dismissed' as ReminderStatus })
      .eq('id', id)
      .eq('user_id', user.id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, [user]);

  // Act on a reminder
  const actOnReminder = useCallback(async (id: string) => {
    if (!user) return;
    await supabase
      .from('reminders')
      .update({ status: 'acted_on' as ReminderStatus })
      .eq('id', id)
      .eq('user_id', user.id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, [user]);

  // Snooze a reminder
  const snoozeReminder = useCallback(async (
    id: string,
    preset: SnoozePreset,
    reveilleTime?: string,
  ) => {
    if (!user) return;

    // Find the reminder to check snooze_count
    const { data: existing } = await supabase
      .from('reminders')
      .select('snooze_count')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    const currentCount = (existing?.snooze_count as number) || 0;

    // Auto-dismiss after 3 snoozes
    if (currentCount >= 2) {
      await dismissReminder(id);
      return;
    }

    const snoozedUntil = calculateSnoozeTime(preset, reveilleTime);

    await supabase
      .from('reminders')
      .update({
        status: 'snoozed' as ReminderStatus,
        snoozed_until: snoozedUntil,
        snooze_count: currentCount + 1,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, [user, dismissReminder]);

  // Archive a reminder
  const archiveReminder = useCallback(async (id: string) => {
    if (!user) return;
    await supabase
      .from('reminders')
      .update({
        archived_at: new Date().toISOString(),
        status: 'archived' as ReminderStatus,
      })
      .eq('id', id)
      .eq('user_id', user.id);
  }, [user]);

  // Create a custom reminder
  const createCustomReminder = useCallback(async (
    title: string,
    body?: string,
    scheduledAt?: string,
    relatedEntityType?: ReminderEntityType,
    relatedEntityId?: string,
  ): Promise<Reminder | null> => {
    return createReminder({
      reminder_type: 'custom',
      title,
      body: body || null,
      delivery_method: scheduledAt ? 'push' : 'reveille_batch',
      scheduled_at: scheduledAt || null,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      source_feature: 'user',
    });
  }, [createReminder]);

  // Generate daily reminders — called on app open
  const generateDailyReminders = useCallback(async (settings: UserSettings | null) => {
    if (!user || !settings) return;
    setLoading(true);

    const today = getUserLocalDate(timezone);
    const tomorrow = getTomorrowDate(today);

    try {
      // === Task reminders ===
      const { data: todayTasks } = await supabase
        .from('compass_tasks')
        .select('id, title, due_date, status')
        .eq('user_id', user.id)
        .eq('due_date', today)
        .eq('status', 'pending')
        .is('archived_at', null)
        .is('parent_task_id', null);

      if (todayTasks && settings.notification_tasks !== 'off') {
        for (const task of todayTasks) {
          await createReminder({
            reminder_type: 'task_due',
            title: task.title,
            delivery_method: settings.notification_tasks === 'push' ? 'push' : 'reveille_batch',
            related_entity_type: 'compass_task',
            related_entity_id: task.id,
            source_feature: 'compass',
          });
        }
      }

      // Overdue tasks — one reminder per task, not piling up
      const { data: overdueTasks } = await supabase
        .from('compass_tasks')
        .select('id, title, due_date, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .is('archived_at', null)
        .is('parent_task_id', null)
        .lt('due_date', today)
        .limit(10);

      if (overdueTasks && settings.notification_tasks !== 'off') {
        for (const task of overdueTasks) {
          await createReminder({
            reminder_type: 'task_overdue',
            title: `Overdue: ${task.title}`,
            delivery_method: 'reveille_batch',
            related_entity_type: 'compass_task',
            related_entity_id: task.id,
            source_feature: 'compass',
          });
        }
      }

      // === Meeting reminders ===
      if (settings.notification_meetings !== 'off') {
        const { data: todayMeetings } = await supabase
          .from('meeting_schedules')
          .select('id, meeting_type, related_person_id, next_due_date')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('next_due_date', today);

        if (todayMeetings) {
          // Resolve person names
          const personIds = todayMeetings.map((m) => m.related_person_id).filter(Boolean) as string[];
          let personMap: Record<string, string> = {};
          if (personIds.length > 0) {
            const { data: people } = await supabase.from('people').select('id, name').in('id', personIds);
            for (const p of (people || []) as { id: string; name: string }[]) {
              personMap[p.id] = p.name;
            }
          }

          for (const m of todayMeetings) {
            const personName = m.related_person_id ? personMap[m.related_person_id] : null;
            const label = m.meeting_type.replace(/_/g, ' ');
            const method = settings.notification_meetings === 'push' || settings.notification_meetings === 'both'
              ? 'push' : 'reveille_batch';

            await createReminder({
              reminder_type: 'meeting_due',
              title: personName ? `${label} with ${personName}` : label,
              delivery_method: method as ReminderDeliveryMethod,
              related_entity_type: 'meeting_schedule',
              related_entity_id: m.id,
              source_feature: 'meetings',
              metadata: { meeting_type: m.meeting_type, person_name: personName },
            });
          }
        }

        // Day-before meeting reminders
        const { data: tomorrowMeetings } = await supabase
          .from('meeting_schedules')
          .select('id, meeting_type, related_person_id, next_due_date')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('next_due_date', tomorrow);

        if (tomorrowMeetings) {
          const personIds = tomorrowMeetings.map((m) => m.related_person_id).filter(Boolean) as string[];
          let personMap: Record<string, string> = {};
          if (personIds.length > 0) {
            const { data: people } = await supabase.from('people').select('id, name').in('id', personIds);
            for (const p of (people || []) as { id: string; name: string }[]) {
              personMap[p.id] = p.name;
            }
          }

          for (const m of tomorrowMeetings) {
            const personName = m.related_person_id ? personMap[m.related_person_id] : null;
            const label = m.meeting_type.replace(/_/g, ' ');

            await createReminder({
              reminder_type: 'meeting_day_before',
              title: `Tomorrow: ${personName ? `${label} with ${personName}` : label}`,
              delivery_method: 'reveille_batch',
              related_entity_type: 'meeting_schedule',
              related_entity_id: m.id,
              source_feature: 'meetings',
              metadata: { meeting_type: m.meeting_type, person_name: personName },
            });
          }
        }
      }

      // === Important dates (First Mate + Crew) ===
      if (settings.notification_people !== 'off') {
        const { data: people } = await supabase
          .from('people')
          .select('id, name, important_dates, is_first_mate')
          .eq('user_id', user.id)
          .is('archived_at', null);

        if (people) {
          const advanceDays = settings.important_dates_advance_days || 1;

          for (const person of people) {
            const dates = (person.important_dates || []) as ImportantDate[];
            for (const d of dates) {
              if (!d.date) continue;

              // Check if date matches today or advance window
              const eventDate = d.recurring
                ? `${today.substring(0, 4)}-${d.date.substring(5)}` // Apply current year
                : d.date;

              const daysUntil = Math.floor(
                (new Date(eventDate + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
              );

              if (daysUntil >= 0 && daysUntil <= advanceDays) {
                const isToday = daysUntil === 0;
                await createReminder({
                  reminder_type: 'important_date',
                  title: isToday
                    ? `Today: ${d.label} — ${person.name}`
                    : `In ${daysUntil} day${daysUntil !== 1 ? 's' : ''}: ${d.label} — ${person.name}`,
                  delivery_method: isToday && settings.notification_people === 'push'
                    ? 'push' : 'reveille_batch',
                  related_entity_type: 'person',
                  related_entity_id: person.id,
                  source_feature: person.is_first_mate ? 'first_mate' : 'crew',
                  metadata: { person_name: person.name, date_label: d.label, event_date: eventDate },
                });
              }
            }
          }
        }
      }

      // === Wheel Rim reminders ===
      if (settings.notification_growth !== 'off') {
        const { data: activeWheels } = await supabase
          .from('wheel_instances')
          .select('id, hub_text, next_rim_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .lte('next_rim_date', today);

        if (activeWheels) {
          for (const wheel of activeWheels) {
            await createReminder({
              reminder_type: 'wheel_rim',
              title: `Wheel check-in due: ${wheel.hub_text}`,
              delivery_method: 'reveille_batch',
              related_entity_type: 'wheel_instance',
              related_entity_id: wheel.id,
              source_feature: 'wheel',
            });
          }
        }
      }

      // === Rigging milestone reminders ===
      if (settings.notification_growth !== 'off') {
        const threeDaysOut = addDaysToDate(today, 3);

        const { data: plans } = await supabase
          .from('rigging_plans')
          .select('id, title, nudge_approaching_milestones, nudge_overdue_milestones')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (plans) {
          const planIds = plans.map((p) => p.id);
          const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

          if (planIds.length > 0) {
            // Approaching milestones
            const { data: approachingMilestones } = await supabase
              .from('rigging_milestones')
              .select('id, title, target_date, plan_id')
              .eq('user_id', user.id)
              .in('plan_id', planIds)
              .in('status', ['not_started', 'in_progress'])
              .gte('target_date', today)
              .lte('target_date', threeDaysOut);

            if (approachingMilestones) {
              for (const ms of approachingMilestones) {
                const plan = planMap[ms.plan_id];
                if (!plan?.nudge_approaching_milestones) continue;

                await createReminder({
                  reminder_type: 'rigging_milestone',
                  title: `Milestone approaching: ${ms.title}`,
                  body: `Plan: ${plan.title}`,
                  delivery_method: 'reveille_batch',
                  related_entity_type: 'rigging_milestone',
                  related_entity_id: ms.id,
                  source_feature: 'rigging',
                  metadata: { plan_title: plan.title },
                });
              }
            }

            // Overdue milestones — max 2 nudges per milestone then stop
            const { data: overdueMilestones } = await supabase
              .from('rigging_milestones')
              .select('id, title, target_date, plan_id')
              .eq('user_id', user.id)
              .in('plan_id', planIds)
              .in('status', ['not_started', 'in_progress'])
              .lt('target_date', today);

            if (overdueMilestones) {
              for (const ms of overdueMilestones) {
                const plan = planMap[ms.plan_id];
                if (!plan?.nudge_overdue_milestones) continue;

                // Count existing nudges for this milestone
                const { data: existingNudges } = await supabase
                  .from('reminders')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('reminder_type', 'rigging_overdue')
                  .eq('related_entity_id', ms.id)
                  .limit(3);

                if ((existingNudges?.length || 0) >= 2) continue; // Max 2 then stop

                await createReminder({
                  reminder_type: 'rigging_overdue',
                  title: `Overdue milestone: ${ms.title}`,
                  body: `Plan: ${plan.title}`,
                  delivery_method: 'reveille_batch',
                  related_entity_type: 'rigging_milestone',
                  related_entity_id: ms.id,
                  source_feature: 'rigging',
                  metadata: { plan_title: plan.title },
                });
              }
            }
          }
        }
      }

      // === Streak at risk (for Reckoning) ===
      if (settings.notification_streaks !== 'off') {
        const { data: recurringTasks } = await supabase
          .from('compass_tasks')
          .select('id, title, recurrence_rule')
          .eq('user_id', user.id)
          .eq('due_date', today)
          .eq('status', 'pending')
          .is('archived_at', null)
          .not('recurrence_rule', 'is', null);

        if (recurringTasks) {
          for (const task of recurringTasks) {
            await createReminder({
              reminder_type: 'streak_at_risk',
              title: `Your ${task.title} streak — don't forget today`,
              delivery_method: 'reckoning_batch',
              related_entity_type: 'compass_task',
              related_entity_id: task.id,
              source_feature: 'charts',
            });
          }
        }
      }

      // === Journal export (monthly) ===
      if (settings.journal_export_reminder && today.endsWith('-01')) {
        await createReminder({
          reminder_type: 'journal_export',
          title: 'Monthly journal export available',
          body: 'Export last month\'s journal entries from Settings.',
          delivery_method: 'reveille_batch',
          source_feature: 'log',
        });
      }

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate reminders');
    } finally {
      setLoading(false);
    }
  }, [user, timezone, createReminder]);

  // Cleanup old reminders
  const cleanupOldReminders = useCallback(async () => {
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Archive delivered reminders older than 30 days
    await supabase
      .from('reminders')
      .update({ archived_at: new Date().toISOString(), status: 'archived' as ReminderStatus })
      .eq('user_id', user.id)
      .eq('status', 'delivered')
      .lt('updated_at', thirtyDaysAgo.toISOString());

    // Auto-dismiss reminders snoozed 3+ times
    await supabase
      .from('reminders')
      .update({ status: 'dismissed' as ReminderStatus })
      .eq('user_id', user.id)
      .eq('status', 'snoozed')
      .gte('snooze_count', 3);
  }, [user]);

  return {
    reminders,
    loading,
    error,
    fetchPendingReminders,
    fetchReveilleReminders,
    fetchReckoningReminders,
    createReminder,
    createCustomReminder,
    dismissReminder,
    actOnReminder,
    snoozeReminder,
    archiveReminder,
    generateDailyReminders,
    cleanupOldReminders,
    setReminders,
  };
}
