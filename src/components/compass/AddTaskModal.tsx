import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { CompassLifeArea, RecurrenceRule } from '../../lib/types';
import { COMPASS_LIFE_AREA_LABELS } from '../../lib/types';
import { autoTagTask } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../shared/Button';
import './AddTaskModal.css';

interface AddTaskPrefill {
  title?: string;
  description?: string;
  life_area_tag?: CompassLifeArea;
  related_goal_id?: string;
}

interface AddTaskModalProps {
  onSave: (data: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    recurrence_rule?: RecurrenceRule;
    life_area_tag?: CompassLifeArea | null;
    related_goal_id?: string | null;
  }) => Promise<{ id: string; title: string } | null>;
  onBack: () => void;
  prefill?: AddTaskPrefill;
}

const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

const LIFE_AREA_OPTIONS = Object.entries(COMPASS_LIFE_AREA_LABELS) as [CompassLifeArea, string][];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AddTaskModal({ onSave, onBack, prefill }: AddTaskModalProps) {
  const { user } = useAuthContext();
  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [dueDate, setDueDate] = useState(getTodayDate());
  const [noDueDate, setNoDueDate] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(null);
  const [lifeAreaTag, setLifeAreaTag] = useState<CompassLifeArea | null>(prefill?.life_area_tag || null);
  const [showFullForm, setShowFullForm] = useState(!!prefill);
  const [saving, setSaving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const tagDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Debounced auto-tag as user types title
  useEffect(() => {
    if (!user || !title.trim() || title.trim().length < 3) return;

    if (tagDebounceRef.current) {
      clearTimeout(tagDebounceRef.current);
    }

    tagDebounceRef.current = setTimeout(async () => {
      setTagging(true);
      const tag = await autoTagTask(title, description || null, user.id);
      if (tag) {
        setLifeAreaTag(tag as CompassLifeArea);
      }
      setTagging(false);
    }, 500);

    return () => {
      if (tagDebounceRef.current) {
        clearTimeout(tagDebounceRef.current);
      }
    };
  }, [title, description, user]);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);

    const task = await onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_date: noDueDate ? null : dueDate,
      recurrence_rule: recurrenceRule,
      life_area_tag: lifeAreaTag,
      related_goal_id: prefill?.related_goal_id || null,
    });

    if (task) {
      // Trigger auto-tag in background after save
      if (user && !lifeAreaTag) {
        autoTagTask(title.trim(), description.trim() || null, user.id).then((tag) => {
          if (tag) {
            supabase
              .from('compass_tasks')
              .update({ life_area_tag: tag })
              .eq('id', task.id)
              .eq('user_id', user.id)
              .then(() => {});
          }
        });
      }
      onBack();
    }

    setSaving(false);
  };

  return (
    <div className="add-task">
      <div className="add-task__top-bar">
        <button type="button" className="add-task__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="add-task__top-title">New Task</span>
      </div>

      <div className="add-task__form">
        <input
          ref={titleRef}
          type="text"
          className="add-task__title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !showFullForm) {
              handleSave();
            }
          }}
        />

        {lifeAreaTag && (
          <div className="add-task__tag-preview">
            <span className="add-task__tag-chip">
              {COMPASS_LIFE_AREA_LABELS[lifeAreaTag]}
              <button
                type="button"
                className="add-task__tag-remove"
                onClick={() => setLifeAreaTag(null)}
                aria-label="Remove tag"
              >
                x
              </button>
            </span>
            {tagging && <span className="add-task__tagging">analyzing...</span>}
          </div>
        )}

        {!lifeAreaTag && tagging && (
          <div className="add-task__tag-preview">
            <span className="add-task__tagging">analyzing...</span>
          </div>
        )}

        <button
          type="button"
          className="add-task__expand-toggle"
          onClick={() => setShowFullForm(!showFullForm)}
        >
          {showFullForm ? (
            <>Less options <ChevronUp size={16} /></>
          ) : (
            <>More options <ChevronDown size={16} /></>
          )}
        </button>

        {showFullForm && (
          <div className="add-task__full-form">
            <div className="add-task__field">
              <label className="add-task__label">Description</label>
              <textarea
                className="add-task__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
                rows={3}
              />
            </div>

            <div className="add-task__field">
              <label className="add-task__label">Due Date</label>
              <div className="add-task__date-row">
                <input
                  type="date"
                  className="add-task__date-input"
                  value={noDueDate ? '' : dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setNoDueDate(false);
                  }}
                  disabled={noDueDate}
                />
                <label className="add-task__no-date">
                  <input
                    type="checkbox"
                    checked={noDueDate}
                    onChange={(e) => setNoDueDate(e.target.checked)}
                  />
                  No date
                </label>
              </div>
            </div>

            <div className="add-task__field">
              <label className="add-task__label">Recurring</label>
              <div className="add-task__recurrence-options">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`add-task__recurrence-btn ${recurrenceRule === opt.value ? 'add-task__recurrence-btn--active' : ''}`}
                    onClick={() => setRecurrenceRule(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="add-task__field">
              <label className="add-task__label">
                Life Area {tagging ? '(analyzing...)' : ''}
              </label>
              <div className="add-task__life-area-options">
                {LIFE_AREA_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`add-task__life-area-btn ${lifeAreaTag === value ? 'add-task__life-area-btn--active' : ''}`}
                    onClick={() => setLifeAreaTag(lifeAreaTag === value ? null : value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="add-task__actions">
        <Button onClick={handleSave} disabled={!title.trim() || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
