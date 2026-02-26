import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../shared/Button';
import type { ListType, ListAiAction, ResetSchedule } from '../../../lib/types';
import { LIST_TYPE_LABELS, LIST_AI_ACTION_LABELS, RESET_SCHEDULE_LABELS } from '../../../lib/types';
import './CreateListModal.css';

interface CreateListModalProps {
  onSave: (data: {
    title: string;
    list_type: ListType;
    ai_action: ListAiAction;
    reset_schedule?: ResetSchedule | null;
    reset_custom_days?: number[] | null;
  }) => Promise<unknown>;
  onBack: () => void;
}

const LIST_TYPES: ListType[] = ['shopping', 'wishlist', 'expenses', 'todo', 'routine', 'custom'];
const AI_ACTIONS: ListAiAction[] = ['store_only', 'remind', 'schedule', 'prioritize'];
const RESET_SCHEDULES: ResetSchedule[] = ['daily', 'weekdays', 'weekly', 'on_completion', 'custom'];
const DAY_LABELS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export default function CreateListModal({ onSave, onBack }: CreateListModalProps) {
  const [title, setTitle] = useState('');
  const [listType, setListType] = useState<ListType>('todo');
  const [aiAction, setAiAction] = useState<ListAiAction>('store_only');
  const [resetSchedule, setResetSchedule] = useState<ResetSchedule>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const isRoutine = listType === 'routine';

  const toggleDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      list_type: listType,
      ai_action: isRoutine ? 'store_only' : aiAction,
      reset_schedule: isRoutine ? resetSchedule : null,
      reset_custom_days: isRoutine && resetSchedule === 'custom' ? customDays : null,
    });
    setSaving(false);
  };

  return (
    <div className="create-list">
      <div className="create-list__top-bar">
        <button type="button" className="create-list__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="create-list__top-title">New List</span>
      </div>

      <div className="create-list__form">
        <div className="create-list__field">
          <label className="create-list__label">Title</label>
          <input
            type="text"
            className="create-list__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="List name..."
            autoFocus
          />
        </div>

        <div className="create-list__field">
          <label className="create-list__label">Type</label>
          <div className="create-list__option-row create-list__option-row--wrap">
            {LIST_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`create-list__option-btn ${listType === type ? 'create-list__option-btn--active' : ''}`}
                onClick={() => setListType(type)}
              >
                {LIST_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {isRoutine && (
          <div className="create-list__field">
            <label className="create-list__label">Reset Schedule</label>
            <div className="create-list__option-row create-list__option-row--wrap">
              {RESET_SCHEDULES.map((schedule) => (
                <button
                  key={schedule}
                  type="button"
                  className={`create-list__option-btn ${resetSchedule === schedule ? 'create-list__option-btn--active' : ''}`}
                  onClick={() => setResetSchedule(schedule)}
                >
                  {RESET_SCHEDULE_LABELS[schedule]}
                </button>
              ))}
            </div>

            {resetSchedule === 'custom' && (
              <div className="create-list__days-row">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`create-list__day-btn ${customDays.includes(day) ? 'create-list__day-btn--active' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isRoutine && (
          <div className="create-list__field">
            <label className="create-list__label">What should I do with this?</label>
            <div className="create-list__option-row create-list__option-row--wrap">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`create-list__option-btn ${aiAction === action ? 'create-list__option-btn--active' : ''}`}
                  onClick={() => setAiAction(action)}
                >
                  {LIST_AI_ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={!title.trim() || saving}>
        {saving ? 'Creating...' : 'Create List'}
      </Button>
    </div>
  );
}
