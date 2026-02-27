import { useState } from 'react';
import { Button } from '../../shared/Button';
import BulkAddItems from './BulkAddItems';
import type { List } from '../../../lib/types';
import './RoutineSetupWizard.css';

interface RoutineSetupWizardProps {
  list: List;
  onComplete: () => void;
  onAddItems: (items: string[]) => Promise<void>;
  onAssignToCompass: (data: {
    recurrence_rule: string;
    custom_days?: number[] | null;
    ends_at?: string | null;
  }) => Promise<void>;
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

export default function RoutineSetupWizard({
  list,
  onComplete,
  onAddItems,
  onAssignToCompass,
}: RoutineSetupWizardProps) {
  const [step, setStep] = useState<'add_items' | 'assign'>('add_items');
  const [itemsAdded, setItemsAdded] = useState(false);

  // Assign step state
  const [rule, setRule] = useState('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [duration, setDuration] = useState<'ongoing' | 'until'>('ongoing');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleBulkAddComplete = async (items: string[]) => {
    await onAddItems(items);
    setItemsAdded(true);
    setStep('assign');
  };

  const handleBulkAddClose = () => {
    // "Skip" from bulk add → go to assign step
    setStep('assign');
  };

  const handleToggleDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleAssign = async () => {
    setSaving(true);
    try {
      await onAssignToCompass({
        recurrence_rule: rule,
        custom_days: rule === 'custom' ? customDays : null,
        ends_at: duration === 'until' && endDate ? new Date(endDate + 'T23:59:59').toISOString() : null,
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAssign = () => {
    onComplete();
  };

  return (
    <div className="routine-wizard">
      {/* Step indicator */}
      <div className="routine-wizard__steps">
        <div className={`routine-wizard__step ${step === 'add_items' ? 'routine-wizard__step--active' : 'routine-wizard__step--done'}`}>
          <span className="routine-wizard__step-dot">1</span>
          <span className="routine-wizard__step-label">Add Items</span>
        </div>
        <div className="routine-wizard__step-line" />
        <div className={`routine-wizard__step ${step === 'assign' ? 'routine-wizard__step--active' : ''}`}>
          <span className="routine-wizard__step-dot">2</span>
          <span className="routine-wizard__step-label">Compass</span>
        </div>
      </div>

      {/* Step 1: Add Items */}
      {step === 'add_items' && (
        <div className="routine-wizard__content">
          <BulkAddItems
            listTitle={list.title}
            onAddItems={handleBulkAddComplete}
            onClose={handleBulkAddClose}
          />
        </div>
      )}

      {/* Step 2: Assign to Compass */}
      {step === 'assign' && (
        <div className="routine-wizard__content">
          <div className="routine-wizard__assign">
            <h2 className="routine-wizard__title">Show on your Compass?</h2>
            <p className="routine-wizard__subtitle">
              This routine will appear as a card on your Compass page on the days you choose.
            </p>

            {itemsAdded && (
              <div className="routine-wizard__success-note">
                Items added to {list.title}
              </div>
            )}

            <div className="routine-wizard__section">
              <label className="routine-wizard__label">Schedule</label>
              <div className="routine-wizard__options">
                {[
                  { value: 'daily', label: 'Every day' },
                  { value: 'weekdays', label: 'Weekdays' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'custom', label: 'Custom days' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`routine-wizard__option ${rule === opt.value ? 'routine-wizard__option--active' : ''}`}
                    onClick={() => setRule(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {rule === 'custom' && (
                <div className="routine-wizard__days">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      className={`routine-wizard__day ${customDays.includes(day.value) ? 'routine-wizard__day--active' : ''}`}
                      onClick={() => handleToggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="routine-wizard__section">
              <label className="routine-wizard__label">Duration</label>
              <div className="routine-wizard__options">
                <button
                  type="button"
                  className={`routine-wizard__option ${duration === 'ongoing' ? 'routine-wizard__option--active' : ''}`}
                  onClick={() => setDuration('ongoing')}
                >
                  Ongoing
                </button>
                <button
                  type="button"
                  className={`routine-wizard__option ${duration === 'until' ? 'routine-wizard__option--active' : ''}`}
                  onClick={() => setDuration('until')}
                >
                  Until date
                </button>
              </div>

              {duration === 'until' && (
                <input
                  type="date"
                  className="routine-wizard__date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              )}
            </div>

            <div className="routine-wizard__actions">
              <Button onClick={handleAssign} disabled={saving || (rule === 'custom' && customDays.length === 0)}>
                {saving ? 'Assigning...' : 'Assign to Compass'}
              </Button>
              <button type="button" className="routine-wizard__skip" onClick={handleSkipAssign}>
                Skip — I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
