import type { UserSettings } from '../../lib/types';

interface HatchSectionProps {
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
}

export function HatchSection({ settings, onUpdateSetting }: HatchSectionProps) {
  return (
    <div className="settings-section__body">
      <div className="settings-section__row">
        <div className="settings-section__row-text">
          <span className="settings-section__label">Open on startup</span>
          <span className="settings-section__helper">
            Automatically open The Hatch drawer when you load the app
          </span>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings?.hatch_drawer_open ?? true}
            onChange={(e) => onUpdateSetting('hatch_drawer_open', e.target.checked)}
          />
          <span className="settings-toggle__slider" />
        </label>
      </div>
    </div>
  );
}
