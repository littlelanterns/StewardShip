import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../shared/Button';
import './AssignRoutineModal.css';

interface AssignRoutineModalProps {
  listTitle: string;
  onSave: (data: {
    recurrence_rule: string;
    custom_days?: number[] | null;
    ends_at?: string | null;
  }) => Promise<void>;
  onBack: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function AssignRoutineModal({ listTitle, onSave, onBack }: AssignRoutineModalProps) {
  const [rule, setRule] = useState('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [duration, setDuration] = useState<'ongoing' | 'until'>('ongoing');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleToggleDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        recurrence_rule: rule,
        custom_days: rule === 'custom' ? customDays : null,
        ends_at: duration === 'until' && endDate ? new Date(endDate + 'T23:59:59').toISOString() : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="assign-routine">
      <div className="assign-routine__header">
        <button type="button" className="assign-routine__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <h2 className="assign-routine__title">Assign to Compass</h2>
      </div>

      <p className="assign-routine__subtitle">
        Show "{listTitle}" on your Compass page for daily tracking.
      </p>

      <div className="assign-routine__section">
        <label className="assign-routine__label">Schedule</label>
        <div className="assign-routine__options">
          {[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Weekdays' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'custom', label: 'Custom days' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`assign-routine__option ${rule === opt.value ? 'assign-routine__option--active' : ''}`}
              onClick={() => setRule(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {rule === 'custom' && (
          <div className="assign-routine__days">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`assign-routine__day ${customDays.includes(day.value) ? 'assign-routine__day--active' : ''}`}
                onClick={() => handleToggleDay(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="assign-routine__section">
        <label className="assign-routine__label">Duration</label>
        <div className="assign-routine__options">
          <button
            type="button"
            className={`assign-routine__option ${duration === 'ongoing' ? 'assign-routine__option--active' : ''}`}
            onClick={() => setDuration('ongoing')}
          >
            Ongoing
          </button>
          <button
            type="button"
            className={`assign-routine__option ${duration === 'until' ? 'assign-routine__option--active' : ''}`}
            onClick={() => setDuration('until')}
          >
            Until date
          </button>
        </div>

        {duration === 'until' && (
          <input
            type="date"
            className="assign-routine__date-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        )}
      </div>

      <div className="assign-routine__actions">
        <Button onClick={handleSave} disabled={saving || (rule === 'custom' && customDays.length === 0)}>
          {saving ? 'Saving...' : 'Assign'}
        </Button>
        <Button variant="secondary" onClick={onBack}>Cancel</Button>
      </div>
    </div>
  );
}
