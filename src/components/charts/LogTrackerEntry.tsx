import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CustomTracker } from '../../lib/types';
import { useCharts } from '../../hooks/useCharts';
import { supabase } from '../../lib/supabase';
import './ChartCards.css';

interface LogTrackerEntryProps {
  tracker: CustomTracker;
  onClose: () => void;
  onLogged?: () => void;
}

export function LogTrackerEntry({ tracker, onClose, onLogged }: LogTrackerEntryProps) {
  const { logTrackerEntry } = useCharts();
  const [value, setValue] = useState('');
  const [boolValue, setBoolValue] = useState<boolean | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // "Add to" mode for count and duration trackers
  const supportsAddMode = tracker.tracking_type === 'count' || tracker.tracking_type === 'duration';
  const [mode, setMode] = useState<'add' | 'set'>(supportsAddMode ? 'add' : 'set');
  const [existingValue, setExistingValue] = useState<number | null>(null);

  // Fetch existing entry for the selected date
  useEffect(() => {
    if (!supportsAddMode) return;
    let cancelled = false;
    async function fetchExisting() {
      const { data } = await supabase
        .from('tracker_entries')
        .select('value_numeric')
        .eq('tracker_id', tracker.id)
        .eq('entry_date', date)
        .maybeSingle();
      if (!cancelled) setExistingValue(data?.value_numeric ?? null);
    }
    fetchExisting();
    return () => { cancelled = true; };
  }, [tracker.id, date, supportsAddMode]);

  const computedTotal = mode === 'add'
    ? (existingValue ?? 0) + (Number(value) || 0)
    : Number(value) || 0;

  const handleSave = async () => {
    setSaving(true);
    if (tracker.tracking_type === 'yes_no') {
      if (boolValue === null) { setSaving(false); return; }
      await logTrackerEntry(tracker.id, { boolean: boolValue }, date);
    } else {
      const num = mode === 'add' ? computedTotal : Number(value);
      if (isNaN(num)) { setSaving(false); return; }
      await logTrackerEntry(tracker.id, { numeric: num }, date);
    }
    setSaving(false);
    onLogged?.();
    onClose();
  };

  const unitLabel = tracker.tracking_type === 'duration' ? 'min' : '';

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal chart-modal--compact" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__header">
          <h2>Log: {tracker.name}</h2>
          <button type="button" className="chart-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="chart-modal__body">
          <label className="chart-field">
            <span className="chart-field__label">Date</span>
            <input
              type="date"
              className="chart-field__input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          {tracker.tracking_type === 'yes_no' ? (
            <div className="chart-field">
              <span className="chart-field__label">Did you do it?</span>
              <div className="yes-no-toggle">
                <button
                  type="button"
                  className={`yes-no-btn ${boolValue === true ? 'yes-no-btn--active-yes' : ''}`}
                  onClick={() => setBoolValue(true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`yes-no-btn ${boolValue === false ? 'yes-no-btn--active-no' : ''}`}
                  onClick={() => setBoolValue(false)}
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="chart-field">
              {supportsAddMode && (
                <div className="add-set-toggle">
                  <button
                    type="button"
                    className={`add-set-toggle__btn ${mode === 'add' ? 'add-set-toggle__btn--active' : ''}`}
                    onClick={() => setMode('add')}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    className={`add-set-toggle__btn ${mode === 'set' ? 'add-set-toggle__btn--active' : ''}`}
                    onClick={() => setMode('set')}
                  >
                    Set total
                  </button>
                </div>
              )}
              <span className="chart-field__label">
                {mode === 'add'
                  ? `+ Add ${tracker.tracking_type === 'duration' ? 'minutes' : 'value'}`
                  : tracker.tracking_type === 'duration' ? 'Minutes' : tracker.tracking_type === 'rating' ? 'Rating (1-10)' : 'Value'
                }
              </span>
              <input
                type="number"
                className="chart-field__input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min={tracker.tracking_type === 'rating' ? '1' : '0'}
                max={tracker.tracking_type === 'rating' ? '10' : undefined}
                placeholder={tracker.target_value ? `Target: ${tracker.target_value}` : ''}
                autoFocus
              />
              {supportsAddMode && mode === 'add' && value && (
                <span className="chart-field__helper">
                  {existingValue ?? 0}{unitLabel} + {Number(value) || 0}{unitLabel} = {computedTotal}{unitLabel}
                </span>
              )}
            </div>
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
            disabled={saving || (tracker.tracking_type === 'yes_no' ? boolValue === null : !value)}
          >
            {saving ? 'Saving...' : 'Log Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
