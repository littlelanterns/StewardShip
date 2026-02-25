import type { UserSettings, CompassView } from '../../lib/types';
import { COMPASS_VIEW_LABELS } from '../../lib/types';

interface CompassSectionProps {
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
}

const VIEW_OPTIONS = (Object.entries(COMPASS_VIEW_LABELS) as [CompassView, string][]);

export function CompassSection({
  settings,
  onUpdateSetting,
}: CompassSectionProps) {
  return (
    <div className="settings-section__body">
      <div className="settings-field">
        <label className="settings-field__label">Default View</label>
        <select
          className="settings-field__select"
          value={settings?.default_compass_view || 'simple_list'}
          onChange={e => onUpdateSetting('default_compass_view', e.target.value)}
        >
          {VIEW_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="settings-field__hint">
          The view shown when you first open Compass each day
        </span>
      </div>
    </div>
  );
}
