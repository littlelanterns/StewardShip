import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGoals } from '../../hooks/useGoals';
import { useCompass } from '../../hooks/useCompass';
import type { Goal, CompassLifeArea } from '../../lib/types';
import { LIFE_AREA_LABELS } from '../../lib/types';
import AddTaskModal from '../compass/AddTaskModal';
import './ChartCards.css';

interface GoalDetailProps {
  goal: Goal;
  onClose: () => void;
  onUpdated?: () => void;
}

export function GoalDetail({ goal, onClose, onUpdated }: GoalDetailProps) {
  const { updateGoal, updateProgress, archiveGoal } = useGoals();
  const { createTask } = useCompass();
  const [editing, setEditing] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');
  const [progressValue, setProgressValue] = useState(String(goal.progress_current));
  const [saving, setSaving] = useState(false);

  const pct = goal.progress_target
    ? Math.min(Math.round((goal.progress_current / goal.progress_target) * 100), 100)
    : goal.progress_current;

  const handleUpdateProgress = async () => {
    const val = Number(progressValue);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    await updateProgress(goal.id, val);
    setSaving(false);
    onUpdated?.();
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    await updateGoal(goal.id, {
      title: title.trim(),
      description: description.trim() || null,
    });
    setSaving(false);
    setEditing(false);
    onUpdated?.();
  };

  const handleArchive = async () => {
    await archiveGoal(goal.id);
    onUpdated?.();
    onClose();
  };

  const handleComplete = async () => {
    await updateGoal(goal.id, { status: 'completed' });
    onUpdated?.();
    onClose();
  };

  // Simple progress line data (just current point — future: historical data)
  const progressData = [
    { label: 'Start', value: 0 },
    { label: 'Current', value: goal.progress_current },
    ...(goal.progress_target ? [{ label: 'Target', value: goal.progress_target }] : []),
  ];

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal chart-modal--detail" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__header">
          <h2>{editing ? 'Edit Goal' : 'Goal Detail'}</h2>
          <button type="button" className="chart-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="chart-modal__body">
          {editing ? (
            <>
              <label className="chart-field">
                <span className="chart-field__label">Title</span>
                <input
                  type="text"
                  className="chart-field__input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="chart-field">
                <span className="chart-field__label">Description</span>
                <textarea
                  className="chart-field__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </label>
              <div className="chart-modal__actions-row">
                <button type="button" className="chart-btn chart-btn--secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="button" className="chart-btn chart-btn--primary" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="goal-detail__title">{goal.title}</h3>
              {goal.description && <p className="goal-detail__desc">{goal.description}</p>}

              {goal.life_area_tag && (
                <span className="goal-detail__tag">{LIFE_AREA_LABELS[goal.life_area_tag] || goal.life_area_tag}</span>
              )}

              <div className="goal-detail__progress-section">
                <div className="goal-detail__progress-header">
                  <span>Progress</span>
                  <span className="goal-detail__pct">{pct}%</span>
                </div>
                <div className="goal-row__bar goal-row__bar--large">
                  <div className="goal-row__fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="goal-detail__progress-text">
                  {goal.progress_current} / {goal.progress_target ?? '?'}
                  {goal.target_date && (
                    <> — Target: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>
                  )}
                </p>
              </div>

              {progressData.length > 2 && (
                <div className="chart-card__chart">
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={progressData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="value" stroke="var(--color-mid-teal)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="goal-detail__update">
                <label className="chart-field">
                  <span className="chart-field__label">Update Progress</span>
                  <div className="goal-detail__update-row">
                    <input
                      type="number"
                      className="chart-field__input"
                      value={progressValue}
                      onChange={(e) => setProgressValue(e.target.value)}
                      min="0"
                      max={goal.progress_target ?? undefined}
                    />
                    <button
                      type="button"
                      className="chart-btn chart-btn--primary"
                      onClick={handleUpdateProgress}
                      disabled={saving}
                    >
                      Update
                    </button>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="chart-modal__footer">
            <button type="button" className="chart-btn chart-btn--secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            {goal.status === 'active' && (
              <button type="button" className="chart-btn chart-btn--primary" onClick={() => setShowCreateTask(true)}>
                <Plus size={14} /> Create Task
              </button>
            )}
            {goal.status === 'active' && (
              <button type="button" className="chart-btn chart-btn--primary" onClick={handleComplete}>
                Mark Complete
              </button>
            )}
            <button type="button" className="chart-btn chart-btn--danger" onClick={handleArchive}>
              <Trash2 size={14} /> Archive
            </button>
          </div>
        )}

        {showCreateTask && (
          <div className="goal-detail__task-overlay">
            <AddTaskModal
              prefill={{
                title: goal.title,
                description: goal.description || undefined,
                life_area_tag: (goal.life_area_tag as CompassLifeArea) || undefined,
                related_goal_id: goal.id,
              }}
              onSave={async (data) => {
                const task = await createTask({
                  title: data.title,
                  description: data.description,
                  due_date: data.due_date,
                  recurrence_rule: data.recurrence_rule,
                  life_area_tag: data.life_area_tag,
                  related_goal_id: data.related_goal_id,
                  source: 'manual',
                });
                return task ? { id: task.id, title: task.title } : null;
              }}
              onBack={() => setShowCreateTask(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
