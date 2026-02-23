import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { CompassTask, CompassLifeArea, RecurrenceRule } from '../../lib/types';
import { COMPASS_LIFE_AREA_LABELS } from '../../lib/types';
import { Button } from '../shared/Button';
import './TaskDetail.css';

interface TaskDetailProps {
  task: CompassTask;
  onUpdate: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
  onArchive: (id: string) => void;
  onBack: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Created manually',
  helm_conversation: 'Created from Helm',
  log_routed: 'Created from Log',
  meeting_action: 'From Meeting',
  rigging_output: 'From Rigging',
  wheel_commitment: 'From Wheel',
  recurring_generated: 'Recurring instance',
};

const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

const LIFE_AREA_OPTIONS = Object.entries(COMPASS_LIFE_AREA_LABELS) as [CompassLifeArea, string][];

export default function TaskDetail({ task, onUpdate, onArchive, onBack }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(task.recurrence_rule);
  const [lifeAreaTag, setLifeAreaTag] = useState<CompassLifeArea | null>(task.life_area_tag);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => { if (!dirty) setDirty(true); };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onUpdate(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      recurrence_rule: recurrenceRule,
      life_area_tag: lifeAreaTag,
    });
    setSaving(false);
    setDirty(false);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onArchive(task.id);
      onBack();
    } else {
      setConfirmDelete(true);
    }
  };

  const handleVictoryStub = () => {
    // Stub — Victory Recorder coming in Phase 5
    alert('Victory Recorder coming soon');
  };

  const handleBreakDownStub = () => {
    // Stub — Task Breaker coming in Phase 4B
    alert('Task Breaker coming in Phase 4B');
  };

  return (
    <div className="task-detail">
      <div className="task-detail__top-bar">
        <button type="button" className="task-detail__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="task-detail__top-title">Task Detail</span>
      </div>

      {task.status === 'completed' && task.completed_at && (
        <div className="task-detail__status-banner">
          Completed {new Date(task.completed_at).toLocaleDateString()}
        </div>
      )}

      {task.status === 'cancelled' && (
        <div className="task-detail__status-banner task-detail__status-banner--cancelled">
          Cancelled
        </div>
      )}

      <div className="task-detail__form">
        <div className="task-detail__field">
          <label className="task-detail__label">Title</label>
          <input
            type="text"
            className="task-detail__input"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
          />
        </div>

        <div className="task-detail__field">
          <label className="task-detail__label">Description</label>
          <textarea
            className="task-detail__textarea"
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="Optional details..."
            rows={4}
          />
        </div>

        <div className="task-detail__field">
          <label className="task-detail__label">Due Date</label>
          <input
            type="date"
            className="task-detail__date-input"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
          />
        </div>

        <div className="task-detail__field">
          <label className="task-detail__label">Recurring</label>
          <div className="task-detail__option-row">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`task-detail__option-btn ${recurrenceRule === opt.value ? 'task-detail__option-btn--active' : ''}`}
                onClick={() => { setRecurrenceRule(opt.value); markDirty(); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="task-detail__field">
          <label className="task-detail__label">Life Area</label>
          <div className="task-detail__option-row task-detail__option-row--wrap">
            {LIFE_AREA_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`task-detail__option-btn task-detail__option-btn--sm ${lifeAreaTag === value ? 'task-detail__option-btn--active' : ''}`}
                onClick={() => { setLifeAreaTag(lifeAreaTag === value ? null : value); markDirty(); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {task.source !== 'manual' && (
          <div className="task-detail__info">
            <span className="task-detail__info-label">Source:</span>
            <span className="task-detail__info-value">
              {SOURCE_LABELS[task.source] || task.source}
            </span>
          </div>
        )}

        {task.related_goal_id && (
          <div className="task-detail__info">
            <span className="task-detail__info-label">Linked Goal:</span>
            <span className="task-detail__info-value">(Goal link)</span>
          </div>
        )}

        {task.related_wheel_id && (
          <div className="task-detail__info">
            <span className="task-detail__info-label">Linked Wheel:</span>
            <span className="task-detail__info-value">(Wheel link)</span>
          </div>
        )}

        {task.related_rigging_plan_id && (
          <div className="task-detail__info">
            <span className="task-detail__info-label">Linked Rigging Plan:</span>
            <span className="task-detail__info-value">(Rigging link)</span>
          </div>
        )}
      </div>

      <div className="task-detail__actions">
        {dirty && (
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}

        <Button variant="secondary" onClick={handleBreakDownStub}>
          Break Down
        </Button>

        <Button variant="secondary" onClick={handleVictoryStub}>
          Mark as Victory
        </Button>

        <button
          type="button"
          className="task-detail__delete-btn"
          onClick={handleDelete}
        >
          {confirmDelete ? 'Confirm delete?' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
