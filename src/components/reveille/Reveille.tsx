import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { useRhythms } from '../../hooks/useRhythms';
import { useAuthContext } from '../../contexts/AuthContext';
import { TrackerPrompts } from './TrackerPrompts';
import { MAST_TYPE_LABELS } from '../../lib/types';
import type { MastEntryType } from '../../lib/types';
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

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReveilleData();
  }, [fetchReveilleData]);

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

        {/* Section 3: Morning Reading — stub until Manifest (PRD-15) is built */}

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

        {/* Section 6: Upcoming Today — stub until Meetings (PRD-17) and Reminders (PRD-18) */}

        {/* Section 7: Custom Tracker Prompts (Morning) */}
        {hasTrackers && (
          <TrackerPrompts
            trackers={reveilleData.trackers}
            onLog={logTrackerEntry}
          />
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
