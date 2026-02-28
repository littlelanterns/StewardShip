import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Maximize2, X } from 'lucide-react';
import { useHatchContext } from '../../contexts/HatchContext';
import HatchTabBar from './HatchTabBar';
import HatchTabContent from './HatchTabContent';
import HatchToolbar from './HatchToolbar';
import './HatchDrawer.css';

export default function HatchDrawer() {
  const {
    isOpen,
    openHatch,
    closeHatch,
    tabs,
    activeTabId,
    setActiveTabId,
    createTab,
    updateTabContent,
    updateTabTitle,
    closeTab,
  } = useHatchContext();

  const navigate = useNavigate();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeHatch();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, closeHatch]);

  const handleExpandToFullPage = useCallback(() => {
    closeHatch();
    navigate('/hatch');
  }, [closeHatch, navigate]);

  const handleNewTab = useCallback(() => {
    createTab();
  }, [createTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  return (
    <>
      {/* Pull tab — always visible on right edge when drawer is closed */}
      {!isOpen && (
        <button
          type="button"
          className="hatch-drawer__pull-tab"
          onClick={openHatch}
          aria-label="Open The Hatch"
          title="The Hatch"
        >
          <Inbox size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="hatch-drawer__backdrop"
          onClick={closeHatch}
          aria-hidden="true"
        />
      )}

      <div
        className={`hatch-drawer ${isOpen ? 'hatch-drawer--open' : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-label={isOpen ? 'The Hatch capture drawer' : undefined}
      >
        {/* Header */}
        <div className="hatch-drawer__header">
          <h3 className="hatch-drawer__title">The Hatch</h3>
          <div className="hatch-drawer__controls">
            <button
              type="button"
              className="hatch-drawer__control-btn"
              onClick={handleExpandToFullPage}
              aria-label="Expand to full page"
              title="Full page"
            >
              <Maximize2 size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="hatch-drawer__control-btn"
              onClick={closeHatch}
              aria-label="Close The Hatch"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="hatch-drawer__body">
          {/* Tab bar */}
          <HatchTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
            onNewTab={handleNewTab}
            onRenameTab={updateTabTitle}
          />

          {/* Tab content */}
          {activeTab ? (
            <HatchTabContent
              tab={activeTab}
              onContentChange={updateTabContent}
            />
          ) : (
            <div className="hatch-drawer__empty">
              <p className="hatch-drawer__empty-text">
                Capture a thought, voice note, or idea.
                <br />
                Route it anywhere when you are ready.
              </p>
            </div>
          )}

          {/* Bottom toolbar */}
          {activeTab && (
            <HatchToolbar tabId={activeTab.id} />
          )}
        </div>
      </div>
    </>
  );
}
