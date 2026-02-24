import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { RiggingPlan, PlanningFramework } from '../../lib/types';
import { PLANNING_FRAMEWORK_LABELS } from '../../lib/types';
import { Button, Input } from '../shared';
import './ManualPlanForm.css';

interface ManualPlanFormProps {
  onSave: (data: Partial<RiggingPlan>) => Promise<RiggingPlan | null>;
  onCancel: () => void;
}

const FRAMEWORKS: PlanningFramework[] = ['milestone', 'moscow', 'backward', 'premortem', 'ten_ten_ten', 'mixed'];

export function ManualPlanForm({ onSave, onCancel }: ManualPlanFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState<PlanningFramework>('milestone');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        planning_framework: framework,
        frameworks_used: [framework],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manual-plan-form">
      <div className="manual-plan-form__top-bar">
        <button type="button" className="manual-plan-form__back" onClick={onCancel} aria-label="Cancel">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="manual-plan-form__top-title">Create Plan</span>
      </div>

      <div className="manual-plan-form__fields">
        <div className="manual-plan-form__field">
          <label className="manual-plan-form__label">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you planning?"
            autoFocus
          />
        </div>

        <div className="manual-plan-form__field">
          <label className="manual-plan-form__label">Description</label>
          <textarea
            className="manual-plan-form__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="More detail about this plan..."
            rows={3}
          />
        </div>

        <div className="manual-plan-form__field">
          <label className="manual-plan-form__label">Planning Framework</label>
          <div className="manual-plan-form__framework-options">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw}
                type="button"
                className={`manual-plan-form__framework-btn${framework === fw ? ' manual-plan-form__framework-btn--active' : ''}`}
                onClick={() => setFramework(fw)}
              >
                {PLANNING_FRAMEWORK_LABELS[fw]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="manual-plan-form__actions">
        <Button onClick={handleSave} disabled={!title.trim() || saving}>
          {saving ? 'Creating...' : 'Create Plan'}
        </Button>
        <Button variant="text" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
