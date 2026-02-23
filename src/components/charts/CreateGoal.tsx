import { useState } from 'react';
import { X } from 'lucide-react';
import { useGoals } from '../../hooks/useGoals';
import { LIFE_AREA_LABELS } from '../../lib/types';
import type { GoalProgressType } from '../../lib/types';
import './ChartCards.css';

interface CreateGoalProps {
  onClose: () => void;
  onCreated?: () => void;
}

const PROGRESS_TYPES: { value: GoalProgressType; label: string }[] = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'count', label: 'Count' },
  { value: 'streak', label: 'Streak (days)' },
  { value: 'boolean', label: 'Yes / No' },
];

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export function CreateGoal({ onClose, onCreated }: CreateGoalProps) {
  const { createGoal } = useGoals();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lifeArea, setLifeArea] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [progressType, setProgressType] = useState<GoalProgressType>('percentage');
  const [progressTarget, setProgressTarget] = useState('100');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const goal = await createGoal({
      title: title.trim(),
      description: description.trim() || null,
      life_area_tag: lifeArea || null,
      target_date: targetDate || null,
      progress_type: progressType,
      progress_target: progressType === 'boolean' ? 1 : (Number(progressTarget) || 100),
    });
    setSaving(false);
    if (goal) {
      onCreated?.();
      onClose();
    }
  };

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__header">
          <h2>Create Goal</h2>
          <button type="button" className="chart-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="chart-modal__body">
          <label className="chart-field">
            <span className="chart-field__label">Title</span>
            <input
              type="text"
              className="chart-field__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to achieve?"
              autoFocus
            />
          </label>

          <label className="chart-field">
            <span className="chart-field__label">Description (optional)</span>
            <textarea
              className="chart-field__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={3}
            />
          </label>

          <label className="chart-field">
            <span className="chart-field__label">Life Area</span>
            <select
              className="chart-field__select"
              value={lifeArea}
              onChange={(e) => setLifeArea(e.target.value)}
            >
              <option value="">None</option>
              {LIFE_AREAS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          <label className="chart-field">
            <span className="chart-field__label">Target Date (optional)</span>
            <input
              type="date"
              className="chart-field__input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>

          <label className="chart-field">
            <span className="chart-field__label">Progress Type</span>
            <select
              className="chart-field__select"
              value={progressType}
              onChange={(e) => setProgressType(e.target.value as GoalProgressType)}
            >
              {PROGRESS_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </label>

          {progressType !== 'boolean' && (
            <label className="chart-field">
              <span className="chart-field__label">Target Value</span>
              <input
                type="number"
                className="chart-field__input"
                value={progressTarget}
                onChange={(e) => setProgressTarget(e.target.value)}
                min="1"
              />
            </label>
          )}
        </div>

        <div className="chart-modal__footer">
          <button type="button" className="chart-btn chart-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="chart-btn chart-btn--primary"
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Creating...' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
