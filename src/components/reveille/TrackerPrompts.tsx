import { useState } from 'react';
import { Check } from 'lucide-react';
import type { CustomTracker, TrackerEntry } from '../../lib/types';
import './Reveille.css';

interface TrackerPromptsProps {
  trackers: (CustomTracker & { todayEntry?: TrackerEntry })[];
  onLog: (trackerId: string, value: { numeric?: number; boolean?: boolean }) => Promise<void>;
}

export function TrackerPrompts({ trackers, onLog }: TrackerPromptsProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  if (trackers.length === 0) return null;

  const handleLog = async (tracker: CustomTracker & { todayEntry?: TrackerEntry }) => {
    setSaving((p) => ({ ...p, [tracker.id]: true }));
    const raw = values[tracker.id];

    let value: { numeric?: number; boolean?: boolean } = {};
    switch (tracker.tracking_type) {
      case 'yes_no':
        value = { boolean: raw === 'true' };
        break;
      case 'count':
      case 'duration':
      case 'rating':
        value = { numeric: Number(raw) || 0 };
        break;
    }

    await onLog(tracker.id, value);
    setLogged((p) => ({ ...p, [tracker.id]: true }));
    setSaving((p) => ({ ...p, [tracker.id]: false }));
  };

  return (
    <div className="rhythm-section">
      <h3 className="rhythm-section__title">Quick Log</h3>
      <div className="tracker-prompts">
        {trackers.map((tracker) => {
          const isLogged = logged[tracker.id] || !!tracker.todayEntry;
          return (
            <div
              key={tracker.id}
              className={`tracker-prompt ${isLogged ? 'tracker-prompt--logged' : ''}`}
            >
              <span className="tracker-prompt__name">{tracker.name}</span>
              {isLogged ? (
                <span className="tracker-prompt__done">
                  <Check size={14} /> Logged
                </span>
              ) : (
                <div className="tracker-prompt__input">
                  {tracker.tracking_type === 'yes_no' ? (
                    <div className="tracker-prompt__yesno">
                      <button
                        type="button"
                        className={`tracker-prompt__btn ${values[tracker.id] === 'true' ? 'tracker-prompt__btn--active' : ''}`}
                        onClick={() => setValues((p) => ({ ...p, [tracker.id]: 'true' }))}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className={`tracker-prompt__btn ${values[tracker.id] === 'false' ? 'tracker-prompt__btn--active' : ''}`}
                        onClick={() => setValues((p) => ({ ...p, [tracker.id]: 'false' }))}
                      >
                        No
                      </button>
                    </div>
                  ) : tracker.tracking_type === 'rating' ? (
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={values[tracker.id] || '5'}
                      onChange={(e) => setValues((p) => ({ ...p, [tracker.id]: e.target.value }))}
                      className="tracker-prompt__slider"
                    />
                  ) : (
                    <input
                      type="number"
                      placeholder={tracker.tracking_type === 'duration' ? 'min' : '0'}
                      value={values[tracker.id] || ''}
                      onChange={(e) => setValues((p) => ({ ...p, [tracker.id]: e.target.value }))}
                      className="tracker-prompt__number"
                      min="0"
                    />
                  )}
                  <button
                    type="button"
                    className="tracker-prompt__log-btn"
                    onClick={() => handleLog(tracker)}
                    disabled={saving[tracker.id] || (!values[tracker.id] && tracker.tracking_type !== 'rating')}
                  >
                    {saving[tracker.id] ? '...' : 'Log'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
