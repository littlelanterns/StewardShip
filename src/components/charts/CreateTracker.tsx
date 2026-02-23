import { useState } from 'react';
import { X } from 'lucide-react';
import { useCharts } from '../../hooks/useCharts';
import { LIFE_AREA_LABELS } from '../../lib/types';
import type { TrackerType, TrackerVisualization, TrackerPromptPeriod } from '../../lib/types';
import './ChartCards.css';

interface CreateTrackerProps {
  onClose: () => void;
  onCreated?: () => void;
}

const TRACKER_TYPES: { value: TrackerType; label: string; desc: string }[] = [
  { value: 'count', label: 'Count', desc: 'Track a number (reps, pages, etc.)' },
  { value: 'yes_no', label: 'Yes / No', desc: 'Did you do it today?' },
  { value: 'duration', label: 'Duration', desc: 'Track minutes or hours' },
  { value: 'rating', label: 'Rating', desc: 'Rate 1-10' },
];

const VIZ_TYPES: { value: TrackerVisualization; label: string }[] = [
  { value: 'line_graph', label: 'Line Graph' },
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'streak_calendar', label: 'Streak Calendar' },
];

const PROMPT_PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: "Don't prompt" },
  { value: 'morning', label: 'Morning (Reveille)' },
  { value: 'evening', label: 'Evening (Reckoning)' },
  { value: 'both', label: 'Both' },
];

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export function CreateTracker({ onClose, onCreated }: CreateTrackerProps) {
  const { createTracker } = useCharts();
  const [name, setName] = useState('');
  const [trackingType, setTrackingType] = useState<TrackerType>('count');
  const [targetValue, setTargetValue] = useState('');
  const [visualization, setVisualization] = useState<TrackerVisualization>('line_graph');
  const [lifeArea, setLifeArea] = useState('');
  const [promptPeriod, setPromptPeriod] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const tracker = await createTracker({
      name: name.trim(),
      tracking_type: trackingType,
      target_value: targetValue ? Number(targetValue) : null,
      visualization,
      life_area_tag: lifeArea || null,
      prompt_period: (promptPeriod as TrackerPromptPeriod) || null,
    });
    setSaving(false);
    if (tracker) {
      onCreated?.();
      onClose();
    }
  };

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal__header">
          <h2>Create Tracker</h2>
          <button type="button" className="chart-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="chart-modal__body">
          <label className="chart-field">
            <span className="chart-field__label">Name</span>
            <input
              type="text"
              className="chart-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What are you tracking?"
              autoFocus
            />
          </label>

          <div className="chart-field">
            <span className="chart-field__label">Tracking Type</span>
            <div className="chart-type-grid">
              {TRACKER_TYPES.map((tt) => (
                <button
                  key={tt.value}
                  type="button"
                  className={`chart-type-option ${trackingType === tt.value ? 'chart-type-option--active' : ''}`}
                  onClick={() => setTrackingType(tt.value)}
                >
                  <span className="chart-type-option__label">{tt.label}</span>
                  <span className="chart-type-option__desc">{tt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {trackingType !== 'yes_no' && (
            <label className="chart-field">
              <span className="chart-field__label">Daily Target (optional)</span>
              <input
                type="number"
                className="chart-field__input"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 30"
                min="1"
              />
            </label>
          )}

          <div className="chart-field">
            <span className="chart-field__label">Visualization</span>
            <div className="chart-viz-options">
              {VIZ_TYPES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className={`chart-viz-option ${visualization === v.value ? 'chart-viz-option--active' : ''}`}
                  onClick={() => setVisualization(v.value)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <label className="chart-field">
            <span className="chart-field__label">Life Area (optional)</span>
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

          <div className="chart-field">
            <span className="chart-field__label">Daily Prompt</span>
            <span className="chart-field__helper">Show a quick-log prompt during your daily rhythm</span>
            <div className="chart-viz-options">
              {PROMPT_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`chart-viz-option ${promptPeriod === opt.value ? 'chart-viz-option--active' : ''}`}
                  onClick={() => setPromptPeriod(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-modal__footer">
          <button type="button" className="chart-btn chart-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="chart-btn chart-btn--primary"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Creating...' : 'Create Tracker'}
          </button>
        </div>
      </div>
    </div>
  );
}
