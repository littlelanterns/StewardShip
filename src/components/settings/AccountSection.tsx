import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '../shared';
import { useTheme } from '../../contexts/ThemeContext';
import { resetFeatureGuideCache } from '../../hooks/useFeatureGuide';
import type { UserProfile, UserSettings } from '../../lib/types';
import type { User } from '@supabase/supabase-js';

// Common IANA timezones for the dropdown
const TIMEZONE_OPTIONS = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix',
  'America/Toronto', 'America/Vancouver', 'America/Edmonton',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Singapore',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Bangkok',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Fiji',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Buenos_Aires',
  'Africa/Johannesburg', 'Africa/Cairo', 'Africa/Lagos',
];

const THEME_OPTIONS = [
  { value: 'captains-quarters', label: "Captain's Quarters", subtitle: 'Warm & Classic' },
  { value: 'deep-waters', label: 'Deep Waters', subtitle: 'Dark & Oceanic' },
  { value: 'hearthstone', label: 'Hearthstone', subtitle: 'Soft & Earthy' },
];

const FONT_SCALE_OPTIONS = [
  { value: 'default', label: 'Default', hint: 'Standard text size' },
  { value: 'large', label: 'Large', hint: 'Easier to read' },
  { value: 'extra_large', label: 'Extra Large', hint: 'Maximum readability' },
] as const;

interface AccountSectionProps {
  user: User;
  profile: UserProfile | null;
  settings: UserSettings | null;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onUpdateProfileDebounced: (field: string, value: unknown) => void;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
  onChangePassword: (pw: string) => Promise<{ error: string | null }>;
  onDeleteAccount: () => Promise<{ error: string | null }>;
}

export function AccountSection({
  user,
  profile,
  settings,
  onUpdateProfile,
  onUpdateProfileDebounced,
  onUpdateSetting,
  onChangePassword,
  onDeleteAccount,
}: AccountSectionProps) {
  const { setTheme, fontScale, setFontScale } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [tzFilter, setTzFilter] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const nameRef = useRef(displayName);

  useEffect(() => {
    if (profile?.display_name && !nameRef.current) {
      setDisplayName(profile.display_name);
      nameRef.current = profile.display_name;
    }
  }, [profile?.display_name]);

  const handleNameChange = useCallback((val: string) => {
    setDisplayName(val);
    onUpdateProfileDebounced('display_name', val);
  }, [onUpdateProfileDebounced]);

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filteredTimezones = tzFilter
    ? TIMEZONE_OPTIONS.filter(tz => tz.toLowerCase().includes(tzFilter.toLowerCase()))
    : TIMEZONE_OPTIONS;

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    const { error } = await onChangePassword(newPassword);
    if (error) {
      setPasswordError(error);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  };

  const handleThemeChange = (themeValue: string) => {
    setTheme(themeValue);
    onUpdateSetting('theme', themeValue);
  };

  const handleFontScaleChange = (scale: 'default' | 'large' | 'extra_large') => {
    setFontScale(scale);
    onUpdateSetting('font_scale', scale);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    const { error } = await onDeleteAccount();
    if (error) {
      setDeleteError(error);
      setDeleting(false);
    }
    // On success, user is signed out and redirected by auth context
  };

  return (
    <div className="settings-section__body">
      {/* Display Name */}
      <div className="settings-field">
        <label className="settings-field__label">Display Name</label>
        <input
          type="text"
          className="settings-field__input"
          value={displayName}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Your name"
        />
      </div>

      {/* Email (read-only) */}
      <div className="settings-field">
        <label className="settings-field__label">Email</label>
        <div className="settings-field__readonly">{user.email}</div>
      </div>

      {/* Timezone */}
      <div className="settings-field">
        <label className="settings-field__label">Timezone</label>
        <input
          type="text"
          className="settings-field__input settings-field__input--search"
          value={tzFilter}
          onChange={e => setTzFilter(e.target.value)}
          placeholder="Search timezones..."
        />
        <select
          className="settings-field__select"
          value={profile?.timezone || ''}
          onChange={e => onUpdateProfile({ timezone: e.target.value })}
        >
          {profile?.timezone && !TIMEZONE_OPTIONS.includes(profile.timezone) && (
            <option value={profile.timezone}>{profile.timezone}</option>
          )}
          {detectedTz && !filteredTimezones.includes(detectedTz) && (
            <option value={detectedTz}>{detectedTz} (detected)</option>
          )}
          {filteredTimezones.map(tz => (
            <option key={tz} value={tz}>
              {tz}{tz === detectedTz ? ' (detected)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Theme */}
      <div className="settings-field">
        <label className="settings-field__label">Theme</label>
        <select
          className="settings-field__select"
          value={settings?.theme || 'captains-quarters'}
          onChange={e => handleThemeChange(e.target.value)}
        >
          {THEME_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label} — {opt.subtitle}</option>
          ))}
        </select>
      </div>

      {/* Font Scale */}
      <div className="settings-field">
        <label className="settings-field__label">Text Size</label>
        <select
          className="settings-field__select"
          value={fontScale}
          onChange={e => handleFontScaleChange(e.target.value as 'default' | 'large' | 'extra_large')}
        >
          {FONT_SCALE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
          ))}
        </select>
      </div>

      {/* Gender */}
      <div className="settings-field">
        <label className="settings-field__label">Gender</label>
        <select
          className="settings-field__select"
          value={profile?.gender || ''}
          onChange={e => onUpdateProfile({ gender: (e.target.value || null) as UserProfile['gender'] })}
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <span className="settings-field__hint">Used to personalize AI language</span>
      </div>

      {/* Relationship Status */}
      <div className="settings-field">
        <label className="settings-field__label">Relationship Status</label>
        <select
          className="settings-field__select"
          value={profile?.relationship_status || ''}
          onChange={e => onUpdateProfile({ relationship_status: (e.target.value || null) as UserProfile['relationship_status'] })}
        >
          <option value="">Prefer not to say</option>
          <option value="single">Single</option>
          <option value="dating">Dating</option>
          <option value="married">Married</option>
          <option value="divorced">Divorced</option>
          <option value="widowed">Widowed</option>
        </select>
        <span className="settings-field__hint">Unlocks First Mate and relationship features when set to Dating or Married</span>
      </div>

      {/* Feature Guides */}
      <div className="settings-field">
        <label className="settings-field__label">Feature Guides</label>
        <div className="settings-field__toggle-row">
          <label className="settings-field__toggle-label">
            <input
              type="checkbox"
              checked={settings?.show_feature_guides ?? true}
              onChange={e => {
                onUpdateSetting('show_feature_guides', e.target.checked);
                resetFeatureGuideCache();
              }}
            />
            Show introduction cards when visiting features for the first time
          </label>
        </div>
        {settings?.show_feature_guides && (settings?.dismissed_guides?.length ?? 0) > 0 && (
          <Button
            variant="text"
            onClick={() => {
              onUpdateSetting('dismissed_guides', []);
              resetFeatureGuideCache();
            }}
          >
            Reset All Guides
          </Button>
        )}
      </div>

      {/* Change Password */}
      <div className="settings-field">
        <label className="settings-field__label">Password</label>
        {!showPassword ? (
          <Button variant="secondary" onClick={() => setShowPassword(true)}>
            Change Password
          </Button>
        ) : (
          <div className="settings-field__password-form">
            <input
              type="password"
              className="settings-field__input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <input
              type="password"
              className="settings-field__input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            {passwordError && <div className="settings-field__error">{passwordError}</div>}
            {passwordSuccess && <div className="settings-field__success">Password updated successfully</div>}
            <div className="settings-field__actions">
              <Button variant="secondary" onClick={() => { setShowPassword(false); setNewPassword(''); setConfirmPassword(''); }}>
                Cancel
              </Button>
              <Button onClick={handlePasswordChange}>Update Password</Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Account */}
      <div className="settings-field settings-field--danger">
        <label className="settings-field__label">Danger Zone</label>
        <Button
          variant="secondary"
          className="settings-btn--danger"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete Account
        </Button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="settings-modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <h3 className="settings-modal__title">Delete Account</h3>
            <p className="settings-modal__warning">
              This will permanently delete your account and ALL your data — conversations, journal entries,
              goals, plans, everything. This cannot be undone.
            </p>
            <input
              type="text"
              className="settings-field__input"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder='Type DELETE to confirm'
              disabled={deleting}
            />
            {deleteError && <div className="settings-field__error">{deleteError}</div>}
            <div className="settings-modal__actions">
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                className="settings-btn--danger"
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
