import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useSettings } from '../hooks/useSettings';
import { useAuthContext } from '../contexts/AuthContext';
import { AccountSection } from '../components/settings/AccountSection';
import { AIConfigSection } from '../components/settings/AIConfigSection';
import { DailyRhythmsSection } from '../components/settings/DailyRhythmsSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { RhythmsSection } from '../components/settings/RhythmsSection';
import { MeetingSchedulesSection } from '../components/settings/MeetingSchedulesSection';
import { CompassSection } from '../components/settings/CompassSection';
import { DataPrivacySection } from '../components/settings/DataPrivacySection';
import { AboutSection } from '../components/settings/AboutSection';
import { LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import '../components/settings/Settings.css';

const SECTIONS = [
  { key: 'account', name: 'Account', description: 'Name, email, timezone, gender, relationship, appearance, password' },
  { key: 'ai', name: 'AI Assistant', description: 'Provider, model, response length, API key' },
  { key: 'daily-rhythms', name: 'Daily Rhythms', description: 'Reveille, Reckoning, prompted entries' },
  { key: 'notifications', name: 'Notifications', description: 'Push, quiet hours, delivery preferences' },
  { key: 'rhythms', name: 'Rhythms', description: 'Friday Overview, Sunday Reflection, monthly, quarterly' },
  { key: 'meetings', name: 'Meeting Schedules', description: 'Recurring meeting configuration' },
  { key: 'compass', name: 'Compass', description: 'Default task view' },
  { key: 'data', name: 'Data & Privacy', description: 'Export data, storage info' },
  { key: 'about', name: 'About StewardShip', description: 'Version, acknowledgments' },
];

const SECTION_INDEX: Record<string, number> = {};
SECTIONS.forEach((s, i) => { SECTION_INDEX[s.key] = i; });

export default function Settings() {
  usePageContext({ page: 'settings' });
  const [searchParams] = useSearchParams();
  const { user } = useAuthContext();
  const {
    profile,
    settings,
    loading,
    fetchSettings,
    updateProfile,
    updateProfileDebounced,
    updateSetting,
    updateSettings,
    changePassword,
    deleteAccount,
    saveApiKey,
    clearApiKey,
    testApiConnection,
    exportAllData,
    downloadBlob,
  } = useSettings();

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Deep link: auto-expand section from URL query param
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && section in SECTION_INDEX) {
      setExpandedSections(new Set([SECTION_INDEX[section]]));
      // Scroll to the section after a brief delay
      setTimeout(() => {
        const el = document.getElementById(`settings-section-${section}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!user) return null;

  if (loading && !settings) {
    return (
      <div className="settings-page">
        <div className="settings-page__header">
          <SettingsIcon size={22} strokeWidth={1.5} />
          <h1 className="settings-page__title">Settings</h1>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <SettingsIcon size={22} strokeWidth={1.5} color="var(--color-deep-teal)" />
        <h1 className="settings-page__title">Settings</h1>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.settings} />

      {SECTIONS.map((section, index) => {
        const isExpanded = expandedSections.has(index);

        return (
          <div key={section.key} id={`settings-section-${section.key}`} className="settings-section">
            <button
              className="settings-section__header"
              onClick={() => toggleSection(index)}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                size={16}
                className={`settings-section__chevron ${isExpanded ? 'settings-section__chevron--expanded' : ''}`}
              />
              <div className="settings-section__header-text">
                <span className="settings-section__name">{section.name}</span>
                <span className="settings-section__description">{section.description}</span>
              </div>
            </button>

            <div className={isExpanded ? 'settings-section__content--expanded' : 'settings-section__content--collapsed'}>
              {index === 0 && (
                <AccountSection
                  user={user}
                  profile={profile}
                  settings={settings}
                  onUpdateProfile={updateProfile}
                  onUpdateProfileDebounced={updateProfileDebounced}
                  onUpdateSetting={updateSetting}
                  onChangePassword={changePassword}
                  onDeleteAccount={deleteAccount}
                />
              )}
              {index === 1 && (
                <AIConfigSection
                  settings={settings}
                  onUpdateSetting={updateSetting}
                  onSaveApiKey={saveApiKey}
                  onClearApiKey={clearApiKey}
                  onTestConnection={testApiConnection}
                />
              )}
              {index === 2 && (
                <DailyRhythmsSection
                  settings={settings}
                  onUpdateSetting={updateSetting}
                />
              )}
              {index === 3 && (
                <NotificationsSection
                  userId={user.id}
                  settings={settings}
                  onUpdateSetting={updateSetting}
                  onUpdateSettings={updateSettings}
                />
              )}
              {index === 4 && (
                <RhythmsSection
                  settings={settings}
                  onUpdateSetting={updateSetting}
                />
              )}
              {index === 5 && (
                <MeetingSchedulesSection />
              )}
              {index === 6 && (
                <CompassSection
                  settings={settings}
                  onUpdateSetting={updateSetting}
                />
              )}
              {index === 7 && (
                <DataPrivacySection
                  onExportAllData={exportAllData}
                  onDownloadBlob={downloadBlob}
                />
              )}
              {index === 8 && (
                <AboutSection />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
