import { useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../shared/Button';
import type { ListType, ListAiAction, ResetSchedule } from '../../../lib/types';
import { LIST_TYPE_LABELS, LIST_TYPE_DESCRIPTIONS, LIST_AI_ACTION_LABELS, RESET_SCHEDULE_LABELS } from '../../../lib/types';
import './CreateListModal.css';

interface CreateListModalProps {
  onSave: (data: {
    title: string;
    list_type: ListType;
    ai_action: ListAiAction;
    reset_schedule?: ResetSchedule | null;
    reset_custom_days?: number[] | null;
    victory_on_complete?: boolean;
  }) => Promise<unknown>;
  onBack: () => void;
}

const LIST_TYPES: ListType[] = ['shopping', 'wishlist', 'expenses', 'todo', 'someday', 'routine', 'custom'];
const AI_ACTIONS: ListAiAction[] = ['store_only', 'remind', 'schedule', 'prioritize'];
const RESET_SCHEDULES: ResetSchedule[] = ['daily', 'weekdays', 'weekly', 'on_completion', 'custom'];
const DAY_LABELS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

// Types that show the victory_on_complete toggle
const VICTORY_ELIGIBLE_TYPES: ListType[] = ['someday', 'todo', 'wishlist', 'custom'];
// Types that hide the AI action selector
const HIDE_AI_ACTION_TYPES: ListType[] = ['routine', 'someday'];

export default function CreateListModal({ onSave, onBack }: CreateListModalProps) {
  const [title, setTitle] = useState('');
  const [listType, setListType] = useState<ListType>('todo');
  const [aiAction, setAiAction] = useState<ListAiAction>('store_only');
  const [resetSchedule, setResetSchedule] = useState<ResetSchedule>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [victoryOnComplete, setVictoryOnComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isRoutine = listType === 'routine';
  const showVictoryToggle = VICTORY_ELIGIBLE_TYPES.includes(listType);
  const showAiAction = !HIDE_AI_ACTION_TYPES.includes(listType) && !isRoutine;

  const handleTypeChange = (type: ListType) => {
    setListType(type);
    // Auto-set victory default based on type
    if (type === 'someday') {
      setVictoryOnComplete(true);
    } else if (!VICTORY_ELIGIBLE_TYPES.includes(type)) {
      setVictoryOnComplete(false);
    }
  };

  const toggleDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleShowTooltip = (type: ListType, e: React.MouseEvent | React.TouchEvent) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      text: LIST_TYPE_DESCRIPTIONS[type],
      x: rect.left,
      y: rect.bottom + 8,
    });
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 4000);
  };

  const handleHideTooltip = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setTooltip(null);
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      list_type: listType,
      ai_action: isRoutine || listType === 'someday' ? 'store_only' : aiAction,
      reset_schedule: isRoutine ? resetSchedule : null,
      reset_custom_days: isRoutine && resetSchedule === 'custom' ? customDays : null,
      victory_on_complete: showVictoryToggle ? victoryOnComplete : false,
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
                onClick={() => handleTypeChange(type)}
                onMouseEnter={(e) => handleShowTooltip(type, e)}
                onMouseLeave={handleHideTooltip}
                onTouchStart={(e) => handleShowTooltip(type, e)}
              >
                {LIST_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          {tooltip && (
            <div
              className="create-list__tooltip"
              style={{ top: tooltip.y, left: tooltip.x }}
            >
              {tooltip.text}
            </div>
          )}
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

        {showAiAction && (
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

        {showVictoryToggle && (
          <div className="create-list__field">
            <label className="create-list__toggle-wrapper">
              <input
                type="checkbox"
                className="create-list__toggle-input"
                checked={victoryOnComplete}
                onChange={(e) => setVictoryOnComplete(e.target.checked)}
              />
              <span className="create-list__toggle-switch" />
              <span className="create-list__toggle-label">Celebrate completions as victories</span>
            </label>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={!title.trim() || saving}>
        {saving ? 'Creating...' : 'Create List'}
      </Button>
    </div>
  );
}
