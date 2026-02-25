import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { UserSettings, MastEntry } from '../../lib/types';

interface DailyRhythmsSectionProps {
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
}

const ROTATION_OPTIONS = [
  { value: 'every_open', label: 'Every app open' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Manual (pinned)' },
];

const GRATITUDE_FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_other_day', label: 'Every other day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'off', label: 'Off' },
];

const JOY_FREQ_OPTIONS = [
  { value: 'every_few_days', label: 'Every few days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'off', label: 'Off' },
];

const ANTICIPATION_FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'off', label: 'Off' },
];

const READING_SOURCE_OPTIONS = [
  { value: 'mast', label: 'Mast (your principles)' },
  { value: 'manifest', label: 'Manifest (your library)' },
  { value: 'log', label: 'Log (past entries)' },
];

export function DailyRhythmsSection({
  settings,
  onUpdateSetting,
}: DailyRhythmsSectionProps) {
  const { user } = useAuthContext();
  const [mastEntries, setMastEntries] = useState<MastEntry[]>([]);

  useEffect(() => {
    if (!user || settings?.mast_thought_rotation !== 'manual') return;
    supabase
      .from('mast_entries')
      .select('id, text, type')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setMastEntries(data as MastEntry[]);
      });
  }, [user, settings?.mast_thought_rotation]);

  const handleReadingSourceToggle = useCallback((source: string, checked: boolean) => {
    const current = settings?.morning_reading_sources || [];
    const updated = checked
      ? [...current, source]
      : current.filter(s => s !== source);
    onUpdateSetting('morning_reading_sources', updated);
  }, [settings?.morning_reading_sources, onUpdateSetting]);

  return (
    <div className="settings-section__body">
      {/* Reveille */}
      <h4 className="settings-subsection__title">Reveille (Morning)</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable Reveille</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.reveille_enabled ?? true}
          onChange={e => onUpdateSetting('reveille_enabled', e.target.checked)}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Morning Time</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.reveille_time || '06:30'}
          onChange={e => onUpdateSetting('reveille_time', e.target.value)}
          disabled={!settings?.reveille_enabled}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Morning Thought Rotation</label>
        <select
          className="settings-field__select"
          value={settings?.mast_thought_rotation || 'daily'}
          onChange={e => onUpdateSetting('mast_thought_rotation', e.target.value)}
          disabled={!settings?.reveille_enabled}
        >
          {ROTATION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {settings?.mast_thought_rotation === 'manual' && (
        <div className="settings-field">
          <label className="settings-field__label">Pinned Mast Entry</label>
          <select
            className="settings-field__select"
            value={settings?.mast_thought_pinned_id || ''}
            onChange={e => onUpdateSetting('mast_thought_pinned_id', e.target.value || null)}
          >
            <option value="">Select an entry</option>
            {mastEntries.map(entry => (
              <option key={entry.id} value={entry.id}>
                {entry.text.substring(0, 80)}{entry.text.length > 80 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="settings-field">
        <label className="settings-field__label">Morning Reading Sources</label>
        <div className="settings-field__checkbox-group">
          {READING_SOURCE_OPTIONS.map(opt => (
            <label key={opt.value} className="settings-field__checkbox-label">
              <input
                type="checkbox"
                checked={(settings?.morning_reading_sources || []).includes(opt.value)}
                onChange={e => handleReadingSourceToggle(opt.value, e.target.checked)}
                disabled={!settings?.reveille_enabled}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reckoning */}
      <h4 className="settings-subsection__title">Reckoning (Evening)</h4>

      <div className="settings-field settings-field--row">
        <label className="settings-field__label">Enable Reckoning</label>
        <input
          type="checkbox"
          className="settings-field__toggle"
          checked={settings?.reckoning_enabled ?? true}
          onChange={e => onUpdateSetting('reckoning_enabled', e.target.checked)}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Evening Time</label>
        <input
          type="time"
          className="settings-field__input settings-field__input--time"
          value={settings?.reckoning_time || '21:00'}
          onChange={e => onUpdateSetting('reckoning_time', e.target.value)}
          disabled={!settings?.reckoning_enabled}
        />
      </div>

      {/* Prompted Entries */}
      <h4 className="settings-subsection__title">Prompted Entries</h4>

      <div className="settings-field">
        <label className="settings-field__label">Gratitude Prompts</label>
        <select
          className="settings-field__select"
          value={settings?.gratitude_prompt_frequency || 'daily'}
          onChange={e => onUpdateSetting('gratitude_prompt_frequency', e.target.value)}
        >
          {GRATITUDE_FREQ_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Joy / Wonder Prompts</label>
        <select
          className="settings-field__select"
          value={settings?.joy_prompt_frequency || 'weekly'}
          onChange={e => onUpdateSetting('joy_prompt_frequency', e.target.value)}
        >
          {JOY_FREQ_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-field">
        <label className="settings-field__label">Anticipation Prompts</label>
        <select
          className="settings-field__select"
          value={settings?.anticipation_prompt_frequency || 'weekly'}
          onChange={e => onUpdateSetting('anticipation_prompt_frequency', e.target.value)}
        >
          {ANTICIPATION_FREQ_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
