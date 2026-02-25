import type { UserSettings, DayOfWeek } from '../../lib/types';
import { DAY_OF_WEEK_LABELS } from '../../lib/types';

interface RhythmsSectionProps {
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
}

export function RhythmsSection({
  settings,
  onUpdateSetting,
}: RhythmsSectionProps) {
  const dayOptions = Object.entries(DAY_OF_WEEK_LABELS) as [DayOfWeek, string][];

  return (
    <div className="settings-section__body">
      {/* Friday Overview */}
      <h4 className="settings-subsection__title">Friday Overview</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.friday_overview_enabled ?? true}
          onChange={e => onUpdateSetting('friday_overview_enabled', e.target.checked)}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Day</label>
        <select
          className="settings-field__select"
          value={settings?.friday_overview_day || 'friday'}
          onChange={e => onUpdateSetting('friday_overview_day', e.target.value)}
          disabled={!settings?.friday_overview_enabled}
        >
          {dayOptions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Time</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.friday_overview_time || '17:00'}
          onChange={e => onUpdateSetting('friday_overview_time', e.target.value)}
          disabled={!settings?.friday_overview_enabled}
        />
      </div>

      {/* Sunday Reflection */}
      <h4 className="settings-subsection__title">Sunday Reflection</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.sunday_reflection_enabled ?? true}
          onChange={e => onUpdateSetting('sunday_reflection_enabled', e.target.checked)}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Day</label>
        <select
          className="settings-field__select"
          value={settings?.sunday_reflection_day || 'sunday'}
          onChange={e => onUpdateSetting('sunday_reflection_day', e.target.value)}
          disabled={!settings?.sunday_reflection_enabled}
        >
          {dayOptions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Time</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.sunday_reflection_time || '09:00'}
          onChange={e => onUpdateSetting('sunday_reflection_time', e.target.value)}
          disabled={!settings?.sunday_reflection_enabled}
        />
      </div>

      {/* Monthly Review */}
      <h4 className="settings-subsection__title">Monthly Review</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.monthly_review_enabled ?? true}
          onChange={e => onUpdateSetting('monthly_review_enabled', e.target.checked)}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Day of Month</label>
        <input
          type="number"
          className="settings-field__input settings-field__input--narrow"
          value={settings?.monthly_review_day ?? 1}
          onChange={e => onUpdateSetting('monthly_review_day', parseInt(e.target.value, 10) || 1)}
          min={1}
          max={28}
          disabled={!settings?.monthly_review_enabled}
        />
        <span className="settings-field__hint">1-28 (avoids month-end issues)</span>
      </div>

      {/* Quarterly Inventory */}
      <h4 className="settings-subsection__title">Quarterly Inventory</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.quarterly_inventory_enabled ?? true}
          onChange={e => onUpdateSetting('quarterly_inventory_enabled', e.target.checked)}
        />
      </div>

      {/* Journal Export Reminder */}
      <h4 className="settings-subsection__title">Journal Export</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Export Reminder</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.journal_export_reminder ?? false}
          onChange={e => onUpdateSetting('journal_export_reminder', e.target.checked)}
        />
      </div>
    </div>
  );
}
