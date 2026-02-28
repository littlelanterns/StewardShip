import { useEffect, useState } from 'react';
import { useHatchContext } from '../contexts/HatchContext';
import { usePageContext } from '../hooks/usePageContext';
import { FeatureGuide } from '../components/shared';
import HatchTabBar from '../components/hatch/HatchTabBar';
import HatchTabContent from '../components/hatch/HatchTabContent';
import HatchToolbar from '../components/hatch/HatchToolbar';
import HatchHistory from '../components/hatch/HatchHistory';
import './Hatch.css';

type HatchPageTab = 'workspace' | 'history';

export default function Hatch() {
  usePageContext({ page: 'hatch' });
  const {
    enterFullPage,
    exitFullPage,
    tabs,
    activeTabId,
    setActiveTabId,
    createTab,
    updateTabContent,
    updateTabTitle,
    closeTab,
  } = useHatchContext();

  const [activePageTab, setActivePageTab] = useState<HatchPageTab>('workspace');
  useEffect(() => {
    enterFullPage();
    return () => exitFullPage();
  }, [enterFullPage, exitFullPage]);

  // Create a tab if none exist when entering workspace
  useEffect(() => {
    if (activePageTab === 'workspace' && tabs.length === 0) {
      createTab();
    }
  }, [activePageTab, tabs.length, createTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="page-container hatch-page">
      <div className="hatch-page__header">
        <h1 className="page-title">The Hatch</h1>
        <div className="hatch-page__tabs">
          <button
            type="button"
            className={`hatch-page__tab${activePageTab === 'workspace' ? ' hatch-page__tab--active' : ''}`}
            onClick={() => setActivePageTab('workspace')}
          >
            Workspace
          </button>
          <button
            type="button"
            className={`hatch-page__tab${activePageTab === 'history' ? ' hatch-page__tab--active' : ''}`}
            onClick={() => setActivePageTab('history')}
          >
            History
          </button>
        </div>
      </div>

      <FeatureGuide
        featureKey="hatch"
        title="The Hatch"
        description="Capture anything here — type or speak. When you're ready, tap &quot;Send to...&quot; and route it to The Log, Compass, Lists, or anywhere else."
        tips={["Use voice input for hands-free capture", "Tabs persist across sessions until you send or archive them"]}
      />

      {activePageTab === 'workspace' ? (
        <div className="hatch-page__workspace">
          <HatchTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onNewTab={() => createTab()}
            onCloseTab={closeTab}
            onRenameTab={updateTabTitle}
          />
          {activeTab && (
            <>
              <div className="hatch-page__editor">
                <HatchTabContent
                  tab={activeTab}
                  onContentChange={updateTabContent}
                />
              </div>
              <HatchToolbar tabId={activeTab.id} />
            </>
          )}
        </div>
      ) : (
        <div className="hatch-page__history">
          <HatchHistory />
        </div>
      )}
    </div>
  );
}
