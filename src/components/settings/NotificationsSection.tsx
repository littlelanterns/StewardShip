import { useState, useEffect, useCallback } from 'react';
import { Button } from '../shared';
import { getPushPermission, subscribeToPush } from '../../lib/pushNotifications';
import type { UserSettings } from '../../lib/types';

interface NotificationsSectionProps {
  userId: string;
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
  onUpdateSettings: (updates: Record<string, unknown>) => Promise<void>;
}

const DELIVERY_CATEGORIES: {
  key: string;
  label: string;
  settingKey: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}[] = [
  {
    key: 'tasks', label: 'Tasks', settingKey: 'notification_tasks',
    options: [
      { value: 'reveille_batch', label: 'Morning Briefing' },
      { value: 'push', label: 'Push' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'reveille_batch',
  },
  {
    key: 'meetings', label: 'Meetings', settingKey: 'notification_meetings',
    options: [
      { value: 'reveille_batch', label: 'Morning Briefing' },
      { value: 'push', label: 'Push' },
      { value: 'both', label: 'Both' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'reveille_batch',
  },
  {
    key: 'people', label: 'People', settingKey: 'notification_people',
    options: [
      { value: 'push', label: 'Push' },
      { value: 'reveille_batch', label: 'Morning Briefing' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'push',
  },
  {
    key: 'growth', label: 'Growth', settingKey: 'notification_growth',
    options: [
      { value: 'reveille_batch', label: 'Morning Briefing' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'reveille_batch',
  },
  {
    key: 'streaks', label: 'Streaks', settingKey: 'notification_streaks',
    options: [
      { value: 'reckoning_batch', label: 'Evening Review' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'reckoning_batch',
  },
  {
    key: 'rhythms', label: 'Rhythms', settingKey: 'notification_rhythms',
    options: [
      { value: 'push', label: 'Push' },
      { value: 'in_app', label: 'In-App' },
      { value: 'off', label: 'Off' },
    ],
    defaultValue: 'push',
  },
  {
    key: 'custom', label: 'Custom', settingKey: 'notification_custom',
    options: [
      { value: 'push', label: 'Push' },
      { value: 'reveille_batch', label: 'Morning Briefing' },
    ],
    defaultValue: 'push',
  },
];

const ADVANCE_DAYS_OPTIONS = [
  { value: 0, label: 'Day of only' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
];

export function NotificationsSection({
  userId,
  settings,
  onUpdateSetting,
  onUpdateSettings: _onUpdateSettings,
}: NotificationsSectionProps) {
  const [pushStatus, setPushStatus] = useState<'enabled' | 'not_setup' | 'blocked' | 'unsupported'>('not_setup');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const perm = getPushPermission();
    if (perm === 'unsupported') setPushStatus('unsupported');
    else if (perm === 'granted') setPushStatus('enabled');
    else if (perm === 'denied') setPushStatus('blocked');
    else setPushStatus('not_setup');
  }, []);

  const handleEnablePush = useCallback(async () => {
    setSubscribing(true);
    const success = await subscribeToPush(userId);
    if (success) {
      setPushStatus('enabled');
      onUpdateSetting('push_notifications_enabled', true);
    } else {
      const perm = getPushPermission();
      if (perm === 'denied') setPushStatus('blocked');
    }
    setSubscribing(false);
  }, [userId, onUpdateSetting]);

  const pushEnabled = settings?.push_notifications_enabled ?? false;

  return (
    <div className="settings-section__body">
      {/* Push Notifications */}
      <h4 className="settings-subsection__title">Push Notifications</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Push Notifications</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={pushEnabled}
          onChange={e => onUpdateSetting('push_notifications_enabled', e.target.checked)}
          disabled={pushStatus === 'unsupported' || pushStatus === 'blocked'}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Permission Status</label>
        <div className="settings-field__status-row">
          {pushStatus === 'enabled' && (
            <span className="settings-badge settings-badge--success">Enabled</span>
          )}
          {pushStatus === 'not_setup' && (
            <>
              <span className="settings-badge settings-badge--neutral">Not set up</span>
              <Button variant="secondary" onClick={handleEnablePush} disabled={subscribing}>
                {subscribing ? 'Enabling...' : 'Enable'}
              </Button>
            </>
          )}
          {pushStatus === 'blocked' && (
            <>
              <span className="settings-badge settings-badge--warning">Blocked in browser</span>
              <span className="settings-field__hint">
                Enable notifications in your browser settings to use push
              </span>
            </>
          )}
          {pushStatus === 'unsupported' && (
            <span className="settings-badge settings-badge--neutral">Not available on this device</span>
          )}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Quiet Hours Start</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.quiet_hours_start || '22:00'}
          onChange={e => onUpdateSetting('quiet_hours_start', e.target.value)}
          disabled={!pushEnabled}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Quiet Hours End</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.quiet_hours_end || settings?.reveille_time || '06:30'}
          onChange={e => onUpdateSetting('quiet_hours_end', e.target.value)}
          disabled={!pushEnabled}
        />
        <span className="settings-field__hint">
          Defaults to your Reveille time
        </span>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Daily Push Limit</label>
        <input
          type="number"
          className="settings-field__input settings-field__input--narrow"
          value={settings?.max_daily_push ?? 5}
          onChange={e => onUpdateSetting('max_daily_push', parseInt(e.target.value, 10) || 5)}
          min={1}
          max={20}
          disabled={!pushEnabled}
        />
      </div>

      {/* Delivery Preferences */}
      <h4 className="settings-subsection__title">Delivery Preferences</h4>

      <div className="settings-delivery-grid">
        {DELIVERY_CATEGORIES.map(cat => (
          <div key={cat.key} className="settings-delivery-row">
            <span className="settings-delivery-row__label">{cat.label}</span>
            <select
              className="settings-field__select settings-field__select--compact"
              value={(settings as unknown as Record<string, unknown>)?.[cat.settingKey] as string || cat.defaultValue}
              onChange={e => onUpdateSetting(cat.settingKey, e.target.value)}
            >
              {cat.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Important Dates */}
      <h4 className="settings-subsection__title">Important Dates</h4>

      <div className="settings-field">
        <label className="settings-field__label">Advance Notice</label>
        <select
          className="settings-field__select"
          value={settings?.important_dates_advance_days ?? 1}
          onChange={e => onUpdateSetting('important_dates_advance_days', parseInt(e.target.value, 10))}
        >
          {ADVANCE_DAYS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
