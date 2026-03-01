import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Star } from 'lucide-react';
import { useRhythms } from '../../hooks/useRhythms';
import { useReflections } from '../../hooks/useReflections';
import { useReminders } from '../../hooks/useReminders';
import { useAuthContext } from '../../contexts/AuthContext';
import { useCelebrationArchive } from '../../hooks/useCelebrationArchive';
import { celebrateCollection } from '../../lib/ai';
import { supabase } from '../../lib/supabase';
import { CelebrationModal } from '../victories/CelebrationModal';
import { TrackerPrompts } from '../reveille/TrackerPrompts';
import { ReminderBatchSection } from '../reminders/ReminderBatchSection';
import { MAST_TYPE_LABELS, LIFE_AREA_LABELS, MEETING_TYPE_LABELS } from '../../lib/types';
import type { MastEntryType, CompassTask, Reminder, SnoozePreset, ReflectionQuestion, ReflectionResponse } from '../../lib/types';
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

function getDailyReflectionQuestions(
  allQuestions: ReflectionQuestion[],
  todaysResponses: ReflectionResponse[],
  count: number,
): ReflectionQuestion[] {
  if (allQuestions.length === 0) return [];

  // Date-seeded pseudo-random for deterministic daily rotation
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  // Mulberry32 PRNG
  let t = seed;
  const rand = () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  const answeredIds = new Set(todaysResponses.map((r) => r.question_id));
  const unanswered = allQuestions.filter((q) => !answeredIds.has(q.id));
  const answered = allQuestions.filter((q) => answeredIds.has(q.id));

  // Shuffle each group deterministically, prioritize unanswered
  const shuffled = [
    ...[...unanswered].sort(() => rand() - 0.5),
    ...[...answered].sort(() => rand() - 0.5),
  ];
  return shuffled.slice(0, count);
}

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export function ReckoningScreen() {
  const navigate = useNavigate();
  const { profile, user } = useAuthContext();
  const {
    reckoningData,
    loading,
    fetchReckoningData,
    dismissReckoning,
    carryForwardTask,
    cancelTask,
    addTomorrowTask,
    logTrackerEntry,
    saveVictoryReviewNote,
    createTaskFromNote,
  } = useRhythms();
  const {
    fetchReckoningReminders,
    dismissReminder,
    actOnReminder,
    snoozeReminder,
  } = useReminders();

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

  // Celebration state
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationLoading, setCelebrationLoading] = useState(false);
  const [celebrationNarrative, setCelebrationNarrative] = useState<string | null>(null);
  const celebrationSavedRef = useRef(false);
  const { saveCelebration } = useCelebrationArchive();

  // Reflections inline section
  const {
    questions: allReflectionQuestions,
    todaysResponses: reflectionTodaysResponses,
    fetchQuestions: fetchReflectionQuestions,
    fetchTodaysResponses: fetchReflectionTodaysResponses,
    saveResponse: saveReflectionResponse,
  } = useReflections();

  const [reflectionTexts, setReflectionTexts] = useState<Record<string, string>>({});
  const [reflectionSaving, setReflectionSaving] = useState<Record<string, boolean>>({});
  const [reflectionSaved, setReflectionSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchReckoningData();
  }, [fetchReckoningData]);

  useEffect(() => {
    fetchReflectionQuestions();
    fetchReflectionTodaysResponses();
  }, [fetchReflectionQuestions, fetchReflectionTodaysResponses]);

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

  const dailyReflections = useMemo(
    () => getDailyReflectionQuestions(allReflectionQuestions, reflectionTodaysResponses, 3),
    [allReflectionQuestions, reflectionTodaysResponses],
  );

  // Deduplication: tasks that already have a compass_task victory show only as victory
  const victoryTaskIds = useMemo(() => {
    if (!reckoningData) return new Set<string>();
    return new Set(
      reckoningData.victories
        .filter((v) => v.source === 'compass_task' && v.source_reference_id)
        .map((v) => v.source_reference_id!)
    );
  }, [reckoningData]);

  const dedupedTasks = useMemo(() => {
    if (!reckoningData) return [];
    return reckoningData.completedTasks.filter((t) => !victoryTaskIds.has(t.id));
  }, [reckoningData, victoryTaskIds]);

  const hasAccomplishments = dedupedTasks.length > 0 || (reckoningData?.victories.length ?? 0) > 0;

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

  const handleReflectionSave = useCallback(async (questionId: string) => {
    const text = reflectionTexts[questionId];
    if (!text?.trim()) return;
    setReflectionSaving((p) => ({ ...p, [questionId]: true }));
    await saveReflectionResponse(questionId, text.trim());
    setReflectionSaved((p) => ({ ...p, [questionId]: true }));
    setReflectionSaving((p) => ({ ...p, [questionId]: false }));
  }, [reflectionTexts, saveReflectionResponse]);

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

  // Celebration handlers
  const handleCelebrate = useCallback(async () => {
    if (!user || !reckoningData) return;

    setShowCelebrationModal(true);
    setCelebrationLoading(true);
    celebrationSavedRef.current = false;

    try {
      const taskLines = dedupedTasks
        .map((t) => `Completed task: ${t.title}${t.completion_note ? ` (${t.completion_note})` : ''}`)
        .join('\n');
      const victoryLines = reckoningData.victories
        .map((v) => `Victory: ${v.celebration_text || v.description}`)
        .join('\n');
      const text = [taskLines, victoryLines].filter(Boolean).join('\n');

      const narrative = await celebrateCollection(text, 'Today', user.id);

      if (narrative && narrative.trim()) {
        setCelebrationNarrative(narrative);
      } else {
        setCelebrationNarrative('Your accomplishments speak for themselves. Well done.');
      }
    } catch (err) {
      console.error('Celebration generation failed:', err);
      setCelebrationNarrative('Your accomplishments speak for themselves. Well done.');
    } finally {
      setCelebrationLoading(false);
    }
  }, [user, reckoningData, dedupedTasks]);

  const saveToArchive = useCallback(async () => {
    if (celebrationSavedRef.current || !celebrationNarrative || !user || !reckoningData) return;
    celebrationSavedRef.current = true;
    const summary = [
      ...dedupedTasks.map((t) => `- ${t.title}`),
      ...reckoningData.victories.map((v) => `- ${v.description}`),
    ].join('\n');
    await saveCelebration(
      celebrationNarrative,
      'Today',
      dedupedTasks.length + reckoningData.victories.length,
      summary,
    );
  }, [celebrationNarrative, user, reckoningData, dedupedTasks, saveCelebration]);

  const handleSaveNarrativeToLog = useCallback(async () => {
    if (!user || !celebrationNarrative) return;
    try {
      await supabase.from('journal_entries').insert({
        user_id: user.id,
        text: celebrationNarrative,
        entry_type: 'reflection',
        source: 'manual_text',
        life_area_tags: [],
        routed_to: [],
        routed_reference_ids: {},
      });
    } catch { /* ignore */ }
    await saveToArchive();
  }, [user, celebrationNarrative, saveToArchive]);

  const handleCopyNarrative = useCallback(async () => {
    if (celebrationNarrative) {
      await navigator.clipboard.writeText(celebrationNarrative);
    }
  }, [celebrationNarrative]);

  const handleCelebrationDismiss = useCallback(async () => {
    await saveToArchive();
    setShowCelebrationModal(false);
    setCelebrationNarrative(null);
  }, [saveToArchive]);

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

  const hasIncomplete = reckoningData.incompleteTasks.length > 0;
  const hasTomorrow = localTomorrowTasks.length > 0;
  const hasMast = !!reckoningData.mastThought;
  const hasTrackers = reckoningData.trackers.length > 0;
  const hasMeetings = reckoningData.completedMeetings.length > 0;
  const hasMilestones = reckoningData.milestones && reckoningData.milestones.length > 0;

  // All incomplete tasks actioned?
  const allActioned = reckoningData.incompleteTasks.every((t) => actionedTasks.has(t.id));

  return (
    <div className="rhythm-overlay">
      <div className="rhythm-container">

        {/* Section 1: Evening Greeting */}
        <h1 className="rhythm-greeting">{greeting}, {name}.</h1>
        <p className="rhythm-date">{formatDate()}</p>

        {/* Section 2: Accomplishments and Victories (merged, deduplicated) */}
        {hasAccomplishments && (
          <div className="rhythm-section">
            <h3 className="rhythm-section__title">Accomplishments and Victories</h3>
            <div className="victory-review">
              <div className="victory-review__narrative">
                {dedupedTasks.map((t) => (
                  <div key={t.id} className="reckoning-victory-item">
                    <span className="reckoning-victory-item__icon reckoning-victory-item__icon--task">
                      <Check size={14} />
                    </span>
                    <span className="reckoning-victory-item__text">
                      {t.title}{t.completion_note ? ` \u2014 ${t.completion_note}` : ''}
                    </span>
                  </div>
                ))}
                {reckoningData.victories.map((v) => (
                  <div key={v.id} className="reckoning-victory-item">
                    <span className="reckoning-victory-item__icon reckoning-victory-item__icon--victory">
                      <Star size={14} />
                    </span>
                    <span className="reckoning-victory-item__text">
                      {v.celebration_text || v.description}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="reckoning-celebrate-btn"
                onClick={handleCelebrate}
              >
                Celebrate This!
              </button>
            </div>
          </div>
        )}

        {/* Completed Meetings */}
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

        {/* Milestone Celebrations */}
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

        {/* Carry Forward */}
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

        {/* Clean-slate message when everything is done */}
        {!hasIncomplete && (reckoningData.completedTasks.length > 0) && (
          <div className="rhythm-section">
            <p className="carry-all-done">Everything done. Clean slate.</p>
          </div>
        )}

        {/* Tomorrow's Priorities */}
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

        {/* How Was Today? — standalone triage section, always visible */}
        <div className="rhythm-section">
          <h3 className="rhythm-section__title">How Was Today?</h3>
          {!triageSaved ? (
            <>
              <div className="victory-review__options">
                <button
                  type="button"
                  className={`victory-review__option ${triageSelection === 'course_correcting' ? 'victory-review__option--active' : ''}`}
                  onClick={() => setTriageSelection('course_correcting')}
                  title="Identify an area you'd like to focus more on"
                >
                  Course Correcting
                </button>
                <button
                  type="button"
                  className={`victory-review__option ${triageSelection === 'smooth_sailing' ? 'victory-review__option--active' : ''}`}
                  onClick={() => setTriageSelection('smooth_sailing')}
                  title="Everything's tracking well — steady as she goes"
                >
                  Smooth Sailing
                </button>
                <button
                  type="button"
                  className={`victory-review__option ${triageSelection === 'rough_waters' ? 'victory-review__option--active' : ''}`}
                  onClick={() => setTriageSelection('rough_waters')}
                  title="Working through an obstacle — get support"
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
          ) : (
            <span className="prompted-entry__saved-msg">Reflection saved</span>
          )}
        </div>

        {/* Closing Thought (Mast) */}
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

        {/* Before You Close the Day — Reckoning reminders */}
        {reckoningReminders.length > 0 && (
          <ReminderBatchSection
            title="Before You Close the Day"
            reminders={reckoningReminders}
            onDismiss={handleReminderDismiss}
            onAct={handleReminderAct}
            onSnooze={handleReminderSnooze}
          />
        )}

        {/* Reflections */}
        {dailyReflections.length > 0 && (
          <div className="rhythm-section">
            <h3
              className="rhythm-section__title rhythm-section__title--tappable"
              onClick={() => navigate('/reflections')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/reflections'); }}
            >
              Reflections
            </h3>
            <button
              type="button"
              className="rhythm-section__subtitle--link"
              onClick={() => navigate('/reflections')}
            >
              See all questions
            </button>
            <div className="reckoning-reflections">
              {dailyReflections.map((q) => {
                const isAnswered = reflectionTodaysResponses.some((r) => r.question_id === q.id);
                const isSaved = reflectionSaved[q.id] || isAnswered;
                const isSaving = reflectionSaving[q.id] || false;

                return (
                  <div key={q.id} className={`reckoning-reflection ${isSaved ? 'reckoning-reflection--saved' : ''}`}>
                    <p className="reckoning-reflection__question">{q.question_text}</p>
                    {isSaved ? (
                      <span className="reckoning-reflection__saved-msg">Reflected</span>
                    ) : (
                      <>
                        <textarea
                          className="reckoning-reflection__textarea"
                          value={reflectionTexts[q.id] || ''}
                          onChange={(e) => setReflectionTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="Write a thought..."
                        />
                        <div className="reckoning-reflection__actions">
                          <button
                            type="button"
                            className="rhythm-actions__secondary"
                            onClick={() => handleReflectionSave(q.id)}
                            disabled={!reflectionTexts[q.id]?.trim() || isSaving}
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Tracker Prompts (Evening) */}
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
            onClick={() => { dismissReckoning(); navigate('/journal'); }}
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

      <CelebrationModal
        open={showCelebrationModal}
        loading={celebrationLoading}
        narrative={celebrationNarrative}
        period="Today"
        accomplishmentCount={dedupedTasks.length + reckoningData.victories.length}
        onSaveToLog={handleSaveNarrativeToLog}
        onCopy={handleCopyNarrative}
        onDismiss={handleCelebrationDismiss}
      />
    </div>
  );
}
