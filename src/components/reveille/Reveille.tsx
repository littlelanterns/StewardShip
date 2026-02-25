import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { useRhythms } from '../../hooks/useRhythms';
import { useReminders } from '../../hooks/useReminders';
import { useRhythmCards } from '../../hooks/useRhythmCards';
import { useAuthContext } from '../../contexts/AuthContext';
import { TrackerPrompts } from './TrackerPrompts';
import { ReminderBatchSection } from '../reminders/ReminderBatchSection';
import { FridayOverview } from '../rhythms/FridayOverview';
import { MonthlyReviewCard } from '../rhythms/MonthlyReviewCard';
import { QuarterlyInventoryCard } from '../rhythms/QuarterlyInventoryCard';
import { MAST_TYPE_LABELS, MEETING_TYPE_LABELS } from '../../lib/types';
import type { MastEntryType, Reminder, SnoozePreset } from '../../lib/types';
import './Reveille.css';

function getGreeting(timezone: string): string {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(hour, 10);
    if (h >= 5 && h < 12) return 'Good morning';
    return 'Good morning';
  } catch {
    return 'Good morning';
  }
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function ReveilleScreen() {
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const {
    reveilleData,
    loading,
    fetchReveilleData,
    dismissReveille,
    completeTask,
    logTrackerEntry,
  } = useRhythms();
  const {
    fetchReveilleReminders,
    generateDailyReminders,
    dismissReminder,
    actOnReminder,
    snoozeReminder,
  } = useReminders();
  const { checkRhythmDue } = useRhythmCards();

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [reveilleReminders, setReveilleReminders] = useState<Reminder[]>([]);
  const [showFriday, setShowFriday] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [showQuarterly, setShowQuarterly] = useState(false);
  const [remindersGenerated, setRemindersGenerated] = useState(false);

  useEffect(() => {
    fetchReveilleData();
  }, [fetchReveilleData]);

  // Generate daily reminders once and fetch reveille batch
  useEffect(() => {
    if (!reveilleData || remindersGenerated) return;
    let mounted = true;

    const loadReminders = async () => {
      // Fetch user settings for generation
      const { data: settings } = await (await import('../../lib/supabase')).supabase
        .from('user_settings')
        .select('*')
        .maybeSingle();

      if (settings && mounted) {
        await generateDailyReminders(settings);
      }

      if (mounted) {
        const batch = await fetchReveilleReminders();
        setReveilleReminders(batch);
        setRemindersGenerated(true);
      }
    };

    loadReminders();
    return () => { mounted = false; };
  }, [reveilleData, remindersGenerated, generateDailyReminders, fetchReveilleReminders]);

  // Check rhythm cards due
  useEffect(() => {
    if (!reveilleData) return;
    let mounted = true;

    const checkRhythms = async () => {
      const { data: settings } = await (await import('../../lib/supabase')).supabase
        .from('user_settings')
        .select('*')
        .maybeSingle();

      if (!mounted) return;

      const [fridayDue, monthlyDue, quarterlyDue] = await Promise.all([
        checkRhythmDue('friday_overview', settings),
        checkRhythmDue('monthly_review', settings),
        checkRhythmDue('quarterly_inventory', settings),
      ]);

      if (mounted) {
        setShowFriday(fridayDue);
        setShowMonthly(monthlyDue);
        setShowQuarterly(quarterlyDue);
      }
    };

    checkRhythms();
    return () => { mounted = false; };
  }, [reveilleData, checkRhythmDue]);

  const timezone = profile?.timezone || 'America/Chicago';
  const greeting = getGreeting(timezone);
  const name = profile?.display_name || 'Steward';

  const handleDismiss = useCallback(async () => {
    await dismissReveille();
    navigate('/');
  }, [dismissReveille, navigate]);

  const handleComplete = useCallback(async (taskId: string) => {
    setCompletedIds((prev) => new Set([...prev, taskId]));
    await completeTask(taskId);
  }, [completeTask]);

  const handleHelmOpen = useCallback(() => {
    dismissReveille();
    navigate('/helm');
  }, [dismissReveille, navigate]);

  const handleReminderDismiss = useCallback(async (id: string) => {
    await dismissReminder(id);
    setReveilleReminders((prev) => prev.filter((r) => r.id !== id));
  }, [dismissReminder]);

  const handleReminderAct = useCallback(async (id: string) => {
    await actOnReminder(id);
    setReveilleReminders((prev) => prev.filter((r) => r.id !== id));
  }, [actOnReminder]);

  const handleReminderSnooze = useCallback(async (id: string, preset: SnoozePreset) => {
    await snoozeReminder(id, preset);
    setReveilleReminders((prev) => prev.filter((r) => r.id !== id));
  }, [snoozeReminder]);

  if (loading && !reveilleData) {
    return (
      <div className="rhythm-overlay">
        <div className="rhythm-container">
          <p className="rhythm-date">Loading...</p>
        </div>
      </div>
    );
  }

  if (!reveilleData) return null;

  const hasTasks = reveilleData.todayTasks.length > 0;
  const hasStreaks = reveilleData.streaks.length > 0;
  const hasTrackers = reveilleData.trackers.length > 0;
  const hasMast = !!reveilleData.mastThought;
  const hasMeetings = reveilleData.upcomingMeetings.length > 0;
  const hasReminders = reveilleReminders.length > 0;
  const hasRhythmCards = showFriday || showMonthly || showQuarterly;

  return (
    <div className="rhythm-overlay">
      <div className="rhythm-container">
        <button
          type="button"
          className="rhythm-close-btn"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X size={24} />
        </button>

        {/* Section 1: Morning Greeting */}
        <h1 className="rhythm-greeting">{greeting}, {name}.</h1>
        <p className="rhythm-date">{formatDate()}</p>

        {/* Section 2: Mast Thought */}
        {hasMast && reveilleData.mastThought && (
          <div
            className="mast-thought"
            onClick={() => { dismissReveille(); navigate('/mast'); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { dismissReveille(); navigate('/mast'); } }}
          >
            <div className="mast-thought__label">From Your Mast</div>
            <div className="mast-thought__text">{reveilleData.mastThought.text}</div>
            <div className="mast-thought__type">
              {MAST_TYPE_LABELS[reveilleData.mastThought.type as MastEntryType] || reveilleData.mastThought.type}
            </div>
          </div>
        )}

        {/* Section 3: Morning Reading from Manifest */}
        {reveilleData.manifestReading && (
          <div className="manifest-reading">
            <div className="manifest-reading__label">From Your Library</div>
            <div className="manifest-reading__text">{reveilleData.manifestReading.text}</div>
            <div className="manifest-reading__source">{reveilleData.manifestReading.source}</div>
          </div>
        )}

        {/* Section 4: Today's Priorities */}
        {hasTasks && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Today's Priorities</h3>
            <div className="rhythm-task-list">
              {reveilleData.todayTasks.map((task) => {
                const isChecked = completedIds.has(task.id);
                return (
                  <div key={task.id} className={`rhythm-task ${isChecked ? 'rhythm-task--completed' : ''}`}>
                    <button
                      type="button"
                      className={`rhythm-task__checkbox ${isChecked ? 'rhythm-task__checkbox--checked' : ''}`}
                      onClick={() => !isChecked && handleComplete(task.id)}
                      aria-label={`Complete ${task.title}`}
                    >
                      {isChecked && <Check size={14} />}
                    </button>
                    <span className={`rhythm-task__title ${isChecked ? 'rhythm-task__title--completed' : ''}`}>
                      {task.title}
                    </span>
                    {task.life_area_tag && (
                      <span className="rhythm-task__tag">{task.life_area_tag}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 5: Streaks to Maintain */}
        {hasStreaks && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Streaks to Maintain</h3>
            <div className="streak-list">
              {reveilleData.streaks.map((streak) => (
                <div key={streak.taskTitle} className="streak-item">
                  <button
                    type="button"
                    className={`rhythm-task__checkbox ${completedIds.has(streak.taskId) ? 'rhythm-task__checkbox--checked' : ''}`}
                    onClick={() => !completedIds.has(streak.taskId) && handleComplete(streak.taskId)}
                    aria-label={`Complete ${streak.taskTitle}`}
                  >
                    {completedIds.has(streak.taskId) && <Check size={14} />}
                  </button>
                  <span className="streak-item__title">{streak.taskTitle}</span>
                  <span className="streak-item__count">
                    {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Upcoming Today — Meetings */}
        {hasMeetings && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Meetings Today</h3>
            <div className="rhythm-task-list">
              {reveilleData.upcomingMeetings.map((m) => {
                const label = MEETING_TYPE_LABELS[m.meetingType] || m.meetingType.replace(/_/g, ' ');
                return (
                  <div
                    key={m.scheduleId}
                    className="rhythm-task"
                    onClick={() => { dismissReveille(); navigate('/meetings'); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { dismissReveille(); navigate('/meetings'); } }}
                  >
                    <span className="rhythm-task__title">
                      {m.personName ? `${label} with ${m.personName}` : label}
                    </span>
                    {m.isOverdue && (
                      <span className="rhythm-task__tag" style={{ color: 'var(--color-cognac)' }}>overdue</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 7: Custom Tracker Prompts (Morning) */}
        {hasTrackers && (
          <TrackerPrompts
            trackers={reveilleData.trackers}
            onLog={logTrackerEntry}
          />
        )}

        {/* Section 8: Reminders for Today */}
        {hasReminders && (
          <ReminderBatchSection
            reminders={reveilleReminders}
            onDismiss={handleReminderDismiss}
            onAct={handleReminderAct}
            onSnooze={handleReminderSnooze}
          />
        )}

        {/* Section 9: Rhythm Cards (Friday Overview, Monthly Review, Quarterly Inventory) */}
        {showFriday && (
          <FridayOverview onDismiss={() => setShowFriday(false)} />
        )}
        {showMonthly && (
          <MonthlyReviewCard onDismiss={() => setShowMonthly(false)} />
        )}
        {showQuarterly && (
          <QuarterlyInventoryCard onDismiss={() => setShowQuarterly(false)} />
        )}

        {/* Bottom Actions */}
        <div className="rhythm-actions">
          <button
            type="button"
            className="rhythm-actions__primary"
            onClick={handleDismiss}
          >
            Start My Day
          </button>
          <button
            type="button"
            className="rhythm-actions__secondary"
            onClick={handleHelmOpen}
          >
            Talk to The Helm
          </button>
        </div>
      </div>
    </div>
  );
}
