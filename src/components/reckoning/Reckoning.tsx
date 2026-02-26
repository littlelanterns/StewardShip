import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useRhythms } from '../../hooks/useRhythms';
import { useReminders } from '../../hooks/useReminders';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TrackerPrompts } from '../reveille/TrackerPrompts';
import { ReminderBatchSection } from '../reminders/ReminderBatchSection';
import { MAST_TYPE_LABELS, LIFE_AREA_LABELS, MEETING_TYPE_LABELS } from '../../lib/types';
import type { MastEntryType, CompassTask, Reminder, SnoozePreset } from '../../lib/types';
import '../reveille/Reveille.css';

function getGreeting(timezone: string): string {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(hour, 10);
    if (h >= 17 && h < 21) return 'Good evening';
    if (h >= 21) return 'Winding down';
    return 'Good evening';
  } catch {
    return 'Good evening';
  }
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export function ReckoningScreen() {
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const {
    reckoningData,
    loading,
    fetchReckoningData,
    dismissReckoning,
    carryForwardTask,
    cancelTask,
    addTomorrowTask,
    logTrackerEntry,
    savePromptedEntry,
    saveVictoryReviewNote,
    createTaskFromNote,
  } = useRhythms();
  const {
    fetchReckoningReminders,
    dismissReminder,
    actOnReminder,
    snoozeReminder,
  } = useReminders();

  const [showAllAccomplishments, setShowAllAccomplishments] = useState(false);
  const [reckoningReminders, setReckoningReminders] = useState<Reminder[]>([]);
  const [actionedTasks, setActionedTasks] = useState<Set<string>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [localTomorrowTasks, setLocalTomorrowTasks] = useState<CompassTask[]>([]);
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Victory Review Triage state
  const [triageSelection, setTriageSelection] = useState<'course_correcting' | 'smooth_sailing' | 'rough_waters' | null>(null);
  const [triageText, setTriageText] = useState('');
  const [triageLifeArea, setTriageLifeArea] = useState('');
  const [triageSaving, setTriageSaving] = useState(false);
  const [triageSaved, setTriageSaved] = useState(false);
  const [triageTaskCreated, setTriageTaskCreated] = useState(false);

  // Prompted entries state
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({});
  const [promptSaved, setPromptSaved] = useState<Record<string, boolean>>({});
  const [promptSaving, setPromptSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchReckoningData();
  }, [fetchReckoningData]);

  useEffect(() => {
    if (reckoningData) {
      setLocalTomorrowTasks(reckoningData.tomorrowTasks);
    }
  }, [reckoningData]);

  // Fetch reckoning-batch reminders (streak at risk, etc.)
  useEffect(() => {
    if (!reckoningData) return;
    let mounted = true;

    fetchReckoningReminders().then((batch) => {
      if (mounted) setReckoningReminders(batch);
    });

    return () => { mounted = false; };
  }, [reckoningData, fetchReckoningReminders]);

  // Reflections nudge
  const [reflectionsTodayCount, setReflectionsTodayCount] = useState(0);
  const [reflectionsRandomQ, setReflectionsRandomQ] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      supabase
        .from('reflection_responses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.user_id || '')
        .eq('response_date', today),
      supabase
        .from('reflection_questions')
        .select('question_text')
        .eq('user_id', profile.user_id || '')
        .is('archived_at', null)
        .limit(20),
    ]).then(([countRes, questionsRes]) => {
      setReflectionsTodayCount(countRes.count || 0);
      const qs = questionsRes.data || [];
      if (qs.length > 0) {
        setReflectionsRandomQ(qs[Math.floor(Math.random() * qs.length)].question_text);
      }
    });
  }, [profile]);

  const timezone = profile?.timezone || 'America/Chicago';
  const greeting = getGreeting(timezone);
  const name = profile?.display_name || 'Steward';

  const handleDismiss = useCallback(async () => {
    await dismissReckoning();
    navigate('/');
  }, [dismissReckoning, navigate]);

  const handleCarryForward = useCallback(async (taskId: string, action: 'tomorrow' | 'cancel' | 'keep') => {
    if (action === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      await carryForwardTask(taskId, tomorrowStr);
    } else if (action === 'cancel') {
      await cancelTask(taskId);
    }
    // 'keep' does nothing — task stays as-is
    setActionedTasks((prev) => new Set([...prev, taskId]));
  }, [carryForwardTask, cancelTask]);

  const handleReschedule = useCallback(async (taskId: string) => {
    if (!rescheduleDate) return;
    await carryForwardTask(taskId, rescheduleDate);
    setActionedTasks((prev) => new Set([...prev, taskId]));
    setRescheduleTaskId(null);
    setRescheduleDate('');
  }, [carryForwardTask, rescheduleDate]);

  const handleAddTomorrowTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    const task = await addTomorrowTask(newTaskTitle.trim());
    if (task) {
      setLocalTomorrowTasks((prev) => [...prev, task]);
    }
    setNewTaskTitle('');
    setAddingTask(false);
  }, [newTaskTitle, addTomorrowTask]);

  const handleTriageSave = useCallback(async () => {
    if (!triageText.trim() || !triageSelection || triageSelection === 'smooth_sailing') return;
    setTriageSaving(true);
    await saveVictoryReviewNote(triageText.trim(), triageSelection, triageLifeArea || undefined);
    setTriageSaved(true);
    setTriageSaving(false);
  }, [triageText, triageSelection, triageLifeArea, saveVictoryReviewNote]);

  const handleTriageCreateTask = useCallback(async () => {
    if (!triageText.trim()) return;
    await createTaskFromNote(triageText.trim());
    setTriageTaskCreated(true);
  }, [triageText, createTaskFromNote]);

  const handlePromptSave = useCallback(async (type: 'gratitude' | 'joy' | 'anticipation') => {
    const text = promptTexts[type];
    if (!text?.trim()) return;
    setPromptSaving((p) => ({ ...p, [type]: true }));
    await savePromptedEntry(type, text.trim());
    setPromptSaved((p) => ({ ...p, [type]: true }));
    setPromptSaving((p) => ({ ...p, [type]: false }));
  }, [promptTexts, savePromptedEntry]);

  const handleHelmOpen = useCallback(() => {
    dismissReckoning();
    navigate('/helm');
  }, [dismissReckoning, navigate]);

  const handleReminderDismiss = useCallback(async (id: string) => {
    await dismissReminder(id);
    setReckoningReminders((prev) => prev.filter((r) => r.id !== id));
  }, [dismissReminder]);

  const handleReminderAct = useCallback(async (id: string) => {
    await actOnReminder(id);
    setReckoningReminders((prev) => prev.filter((r) => r.id !== id));
  }, [actOnReminder]);

  const handleReminderSnooze = useCallback(async (id: string, preset: SnoozePreset) => {
    await snoozeReminder(id, preset);
    setReckoningReminders((prev) => prev.filter((r) => r.id !== id));
  }, [snoozeReminder]);

  if (loading && !reckoningData) {
    return (
      <div className="rhythm-overlay">
        <div className="rhythm-container">
          <p className="rhythm-date">Loading...</p>
        </div>
      </div>
    );
  }

  if (!reckoningData) return null;

  const hasCompleted = reckoningData.completedTasks.length > 0;
  const hasVictories = reckoningData.victories.length > 0;
  const hasIncomplete = reckoningData.incompleteTasks.length > 0;
  const hasTomorrow = localTomorrowTasks.length > 0;
  const hasMast = !!reckoningData.mastThought;
  const hasTrackers = reckoningData.trackers.length > 0;
  const hasPrompts = reckoningData.promptsDue.gratitude || reckoningData.promptsDue.joy || reckoningData.promptsDue.anticipation;
  const hasMeetings = reckoningData.completedMeetings.length > 0;
  const hasMilestones = reckoningData.milestones && reckoningData.milestones.length > 0;

  // Accomplishment display
  const visibleAccomplishments = showAllAccomplishments
    ? reckoningData.completedTasks
    : reckoningData.completedTasks.slice(0, 5);
  const hiddenCount = reckoningData.completedTasks.length - 5;

  // All incomplete tasks actioned?
  const allActioned = reckoningData.incompleteTasks.every((t) => actionedTasks.has(t.id));

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

        {/* Section 1: Evening Greeting */}
        <h1 className="rhythm-greeting">{greeting}, {name}.</h1>
        <p className="rhythm-date">{formatDate()}</p>

        {/* Section 2: Today's Accomplishments */}
        {hasCompleted ? (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Today's Accomplishments</h3>
            <p className="accomplishment-count">
              {reckoningData.completedTasks.length} task{reckoningData.completedTasks.length !== 1 ? 's' : ''} completed
            </p>
            <div className="rhythm-task-list">
              {visibleAccomplishments.map((task) => (
                <div key={task.id} className="rhythm-task rhythm-task--completed">
                  <span className="rhythm-task__checkbox rhythm-task__checkbox--checked">
                    <Check size={14} />
                  </span>
                  <span className="rhythm-task__title rhythm-task__title--completed">
                    {task.title}
                  </span>
                  {task.life_area_tag && (
                    <span className="rhythm-task__tag">{task.life_area_tag}</span>
                  )}
                </div>
              ))}
            </div>
            {hiddenCount > 0 && (
              <button
                type="button"
                className="accomplishment-more"
                onClick={() => setShowAllAccomplishments(!showAllAccomplishments)}
              >
                {showAllAccomplishments ? (
                  <>Show less <ChevronUp size={14} /></>
                ) : (
                  <>{hiddenCount} more completed <ChevronDown size={14} /></>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Today's Accomplishments</h3>
            <p className="accomplishment-empty">
              No tasks were checked off today. Some days are like that.
            </p>
          </div>
        )}

        {/* Section 2b: Completed Meetings */}
        {hasMeetings && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Meetings Completed</h3>
            <div className="rhythm-task-list">
              {reckoningData.completedMeetings.map((m, idx) => {
                const label = MEETING_TYPE_LABELS[m.meetingType] || m.meetingType.replace(/_/g, ' ');
                return (
                  <div key={idx} className="rhythm-task rhythm-task--completed">
                    <span className="rhythm-task__checkbox rhythm-task__checkbox--checked">
                      <Check size={14} />
                    </span>
                    <span className="rhythm-task__title rhythm-task__title--completed">
                      {m.personName ? `${label} with ${m.personName}` : label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2c: Milestone Celebrations */}
        {hasMilestones && (
          <div className="milestone-celebration-card">
            <h3 className="milestone-celebration-card__title">Milestones Reached</h3>
            <ul className="milestone-celebration-card__list">
              {reckoningData.milestones.map((m, idx) => (
                <li key={idx} className="milestone-celebration-card__item">
                  {m.title} — {m.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 3: Victory Review Triage — only if victories exist */}
        {hasVictories && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Victory Review</h3>
            <div className="victory-review">
              <div className="victory-review__narrative">
                {reckoningData.victories.map((v) => (
                  <div key={v.id} style={{ marginBottom: 'var(--spacing-sm)' }}>
                    {v.celebration_text || v.description}
                  </div>
                ))}
              </div>

              {!triageSaved && (
                <>
                  <p className="victory-review__triage-label">How does this feel?</p>
                  <div className="victory-review__options">
                    <button
                      type="button"
                      className={`victory-review__option ${triageSelection === 'course_correcting' ? 'victory-review__option--active' : ''}`}
                      onClick={() => setTriageSelection('course_correcting')}
                    >
                      Course Correcting
                    </button>
                    <button
                      type="button"
                      className={`victory-review__option ${triageSelection === 'smooth_sailing' ? 'victory-review__option--active' : ''}`}
                      onClick={() => setTriageSelection('smooth_sailing')}
                    >
                      Smooth Sailing
                    </button>
                    <button
                      type="button"
                      className={`victory-review__option ${triageSelection === 'rough_waters' ? 'victory-review__option--active' : ''}`}
                      onClick={() => setTriageSelection('rough_waters')}
                    >
                      Rough Waters
                    </button>
                  </div>

                  {triageSelection === 'smooth_sailing' && (
                    <p className="victory-review__smooth">Steady as she goes.</p>
                  )}

                  {triageSelection === 'course_correcting' && (
                    <div className="victory-review__expand">
                      <textarea
                        className="victory-review__textarea"
                        placeholder="What area would you like to focus more on?"
                        value={triageText}
                        onChange={(e) => setTriageText(e.target.value)}
                      />
                      <select
                        className="life-area-select"
                        value={triageLifeArea}
                        onChange={(e) => setTriageLifeArea(e.target.value)}
                      >
                        <option value="">Life area (optional)</option>
                        {LIFE_AREAS.map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <div className="victory-review__actions">
                        <button
                          type="button"
                          className="rhythm-actions__secondary"
                          onClick={handleTriageSave}
                          disabled={!triageText.trim() || triageSaving}
                        >
                          {triageSaving ? 'Saving...' : 'Save Reflection'}
                        </button>
                        {!triageTaskCreated && triageText.trim() && (
                          <button
                            type="button"
                            className="rhythm-actions__secondary"
                            onClick={handleTriageCreateTask}
                          >
                            Create a task from this
                          </button>
                        )}
                        {triageTaskCreated && (
                          <span className="prompted-entry__saved-msg">Task created</span>
                        )}
                      </div>
                    </div>
                  )}

                  {triageSelection === 'rough_waters' && (
                    <div className="victory-review__expand">
                      <textarea
                        className="victory-review__textarea"
                        placeholder="What's the obstacle?"
                        value={triageText}
                        onChange={(e) => setTriageText(e.target.value)}
                      />
                      <div className="victory-review__actions">
                        <button
                          type="button"
                          className="rhythm-actions__secondary"
                          onClick={handleTriageSave}
                          disabled={!triageText.trim() || triageSaving}
                        >
                          {triageSaving ? 'Saving...' : 'Save Reflection'}
                        </button>
                        <button
                          type="button"
                          className="rhythm-actions__secondary"
                          onClick={() => { dismissReckoning(); navigate('/helm'); }}
                        >
                          Go deeper at the Helm
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {triageSaved && (
                <span className="prompted-entry__saved-msg">Reflection saved</span>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Carry Forward */}
        {hasIncomplete && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Carry Forward</h3>
            {allActioned ? (
              <p className="carry-all-done">Everything sorted. Clean slate for tomorrow.</p>
            ) : (
              <div className="rhythm-task-list">
                {reckoningData.incompleteTasks.map((task) => {
                  const isActioned = actionedTasks.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`carry-task ${isActioned ? 'carry-task--actioned' : ''}`}
                    >
                      <span className="carry-task__title">{task.title}</span>
                      {!isActioned && (
                        <div className="carry-task__actions">
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => handleCarryForward(task.id, 'tomorrow')}
                          >
                            Tomorrow
                          </button>
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => {
                              setRescheduleTaskId(task.id);
                              setRescheduleDate('');
                            }}
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => handleCarryForward(task.id, 'cancel')}
                          >
                            Done with it
                          </button>
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => handleCarryForward(task.id, 'keep')}
                          >
                            Still today
                          </button>
                        </div>
                      )}
                      {rescheduleTaskId === task.id && !isActioned && (
                        <div className="carry-task__actions">
                          <input
                            type="date"
                            className="date-picker-inline"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => handleReschedule(task.id)}
                            disabled={!rescheduleDate}
                          >
                            Set
                          </button>
                          <button
                            type="button"
                            className="carry-task__action"
                            onClick={() => setRescheduleTaskId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* If no incomplete tasks, show clean-slate message instead of carry forward */}
        {!hasIncomplete && hasCompleted && (
          <div className="rhythm-section">
            <p className="carry-all-done">Everything done. Clean slate.</p>
          </div>
        )}

        {/* Section 5: Tomorrow's Priorities */}
        <div className="rhythm-section">
          <h3 className="rhythm-section__title">Tomorrow's Priorities</h3>

          {reckoningData.aiSuggestion && showAiSuggestion && (
            <div className="ai-suggestion">
              <p className="ai-suggestion__text">{reckoningData.aiSuggestion}</p>
              <button
                type="button"
                className="ai-suggestion__dismiss"
                onClick={() => setShowAiSuggestion(false)}
                aria-label="Dismiss suggestion"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {hasTomorrow && (
            <div className="rhythm-task-list">
              {localTomorrowTasks.map((task) => (
                <div key={task.id} className="rhythm-task">
                  <span className="rhythm-task__title">{task.title}</span>
                  {task.life_area_tag && (
                    <span className="rhythm-task__tag">{task.life_area_tag}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="tomorrow-add">
            <input
              type="text"
              className="tomorrow-add__input"
              placeholder="Add a task for tomorrow..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTomorrowTask();
              }}
            />
            <button
              type="button"
              className="tomorrow-add__btn"
              onClick={handleAddTomorrowTask}
              disabled={!newTaskTitle.trim() || addingTask}
            >
              {addingTask ? '...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Section 6: Closing Thought (Mast) */}
        {hasMast && reckoningData.mastThought && (
          <div
            className="mast-thought"
            onClick={() => { dismissReckoning(); navigate('/mast'); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') { dismissReckoning(); navigate('/mast'); } }}
          >
            <div className="mast-thought__label">Closing Thought</div>
            <div className="mast-thought__text">{reckoningData.mastThought.text}</div>
            <div className="mast-thought__type">
              {MAST_TYPE_LABELS[reckoningData.mastThought.type as MastEntryType] || reckoningData.mastThought.type}
            </div>
          </div>
        )}

        {/* Manifest reading — evening devotional */}
        {reckoningData.manifestReading && (
          <div className="manifest-reading">
            <div className="manifest-reading__label">From Your Library</div>
            <div className="manifest-reading__text">{reckoningData.manifestReading.text}</div>
            <div className="manifest-reading__source">{reckoningData.manifestReading.source}</div>
          </div>
        )}

        {/* Section 6b: Before You Close the Day — Reckoning reminders */}
        {reckoningReminders.length > 0 && (
          <ReminderBatchSection
            title="Before You Close the Day"
            reminders={reckoningReminders}
            onDismiss={handleReminderDismiss}
            onAct={handleReminderAct}
            onSnooze={handleReminderSnooze}
          />
        )}

        {/* Section 7: Prompted Entries */}
        {hasPrompts && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Evening Reflection</h3>
            <div className="prompted-entries">
              {reckoningData.promptsDue.gratitude && (
                <PromptedEntry
                  type="gratitude"
                  question="What are you grateful for today?"
                  text={promptTexts.gratitude || ''}
                  onTextChange={(t) => setPromptTexts((p) => ({ ...p, gratitude: t }))}
                  onSave={() => handlePromptSave('gratitude')}
                  saved={promptSaved.gratitude || false}
                  saving={promptSaving.gratitude || false}
                />
              )}
              {reckoningData.promptsDue.joy && (
                <PromptedEntry
                  type="joy"
                  question="What brought you joy recently?"
                  text={promptTexts.joy || ''}
                  onTextChange={(t) => setPromptTexts((p) => ({ ...p, joy: t }))}
                  onSave={() => handlePromptSave('joy')}
                  saved={promptSaved.joy || false}
                  saving={promptSaving.joy || false}
                />
              )}
              {reckoningData.promptsDue.anticipation && (
                <PromptedEntry
                  type="anticipation"
                  question="What are you looking forward to?"
                  text={promptTexts.anticipation || ''}
                  onTextChange={(t) => setPromptTexts((p) => ({ ...p, anticipation: t }))}
                  onSave={() => handlePromptSave('anticipation')}
                  saved={promptSaved.anticipation || false}
                  saving={promptSaving.anticipation || false}
                />
              )}
            </div>
          </div>
        )}

        {/* Section 7b: Daily Reflections Nudge */}
        <div className="rhythm-section">
          {reflectionsTodayCount > 0 ? (
            <>
              <h3 className="rhythm-section__title">Daily Reflections</h3>
              <p className="rhythm-section__text">
                You reflected on {reflectionsTodayCount} question{reflectionsTodayCount !== 1 ? 's' : ''} today.
              </p>
            </>
          ) : reflectionsRandomQ ? (
            <>
              <h3 className="rhythm-section__title">Daily Reflections</h3>
              <p className="rhythm-section__text rhythm-section__text--italic">
                "{reflectionsRandomQ}"
              </p>
              <button
                type="button"
                className="rhythm-section__link"
                onClick={() => navigate('/reflections')}
              >
                Reflect
              </button>
            </>
          ) : null}
        </div>

        {/* Section 8: Custom Tracker Prompts (Evening) */}
        {hasTrackers && (
          <TrackerPrompts
            trackers={reckoningData.trackers}
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
            Close My Day
          </button>
          <button
            type="button"
            className="rhythm-actions__secondary"
            onClick={() => { dismissReckoning(); navigate('/log'); }}
          >
            Journal
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

// Inline sub-component for prompted entries
function PromptedEntry({
  type: _type,
  question,
  text,
  onTextChange,
  onSave,
  saved,
  saving,
}: {
  type: string;
  question: string;
  text: string;
  onTextChange: (t: string) => void;
  onSave: () => void;
  saved: boolean;
  saving: boolean;
}) {
  if (saved) {
    return (
      <div className="prompted-entry prompted-entry--saved">
        <p className="prompted-entry__question">{question}</p>
        <span className="prompted-entry__saved-msg">Saved to your Log</span>
      </div>
    );
  }

  return (
    <div className="prompted-entry">
      <p className="prompted-entry__question">{question}</p>
      <textarea
        className="prompted-entry__textarea"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Write a thought..."
      />
      <div className="prompted-entry__actions">
        <button
          type="button"
          className="rhythm-actions__secondary"
          onClick={onSave}
          disabled={!text.trim() || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
