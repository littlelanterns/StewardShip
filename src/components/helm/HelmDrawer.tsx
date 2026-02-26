import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X, Plus, Clock, PackageOpen } from 'lucide-react';
import { useHelmContext } from '../../contexts/HelmContext';
import { useUnloadTheHold } from '../../hooks/useUnloadTheHold';
import { GUIDED_MODE_LABELS } from '../../lib/types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConversationHistory from './ConversationHistory';
import TriageReview from './TriageReview';
import { LoadingSpinner } from '../shared';
import './HelmDrawer.css';

const PAGE_LABELS: Record<string, string> = {
  crowsnest: "Crow's Nest",
  compass: 'The Compass',
  helm: 'The Helm',
  log: 'The Log',
  charts: 'Charts',
  mast: 'The Mast',
  keel: 'The Keel',
  wheel: 'The Wheel',
  lifeinventory: 'Life Inventory',
  rigging: 'Rigging',
  firstmate: 'First Mate',
  crew: 'Crew',
  victories: 'Victories',
  safeharbor: 'Safe Harbor',
  manifest: 'The Manifest',
  settings: 'Settings',
  meetings: 'Meetings',
  lists: 'Lists',
  reveille: 'Reveille',
  reckoning: 'Reckoning',
};

export default function HelmDrawer() {
  const {
    drawerState,
    closeDrawer,
    expandDrawer,
    setDrawerState,
    pageContext,
    messages,
    loading,
    activeConversation,
    conversations,
    historyLoading,
    hasMoreHistory,
    sendMessage,
    startNewConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    loadHistory,
    showHistory,
    setShowHistory,
    isThinking,
  } = useHelmContext();

  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartState = useRef(drawerState);
  const [historyOffset, setHistoryOffset] = useState(0);

  // Unload the Hold triage
  const {
    triageItems,
    sorting,
    routing,
    error: triageError,
    startDump,
    triggerTriage,
    updateTriageItem,
    discardTriageItem,
    routeAll,
    archiveToLog,
    reset: resetTriage,
  } = useUnloadTheHold();

  const [showTriageReview, setShowTriageReview] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);

  const hasUserMessages = messages.some((m) => m.role === 'user');

  const guidedModeLabel = activeConversation?.guided_mode
    ? GUIDED_MODE_LABELS[activeConversation.guided_mode]
    : null;

  // Reset triage state when conversation changes
  useEffect(() => {
    resetTriage();
    setShowTriageReview(false);
  }, [activeConversation?.id, resetTriage]);

  const handleExpandToFullPage = useCallback(() => {
    closeDrawer();
    navigate('/helm');
  }, [closeDrawer, navigate]);

  // Close on Escape
  useEffect(() => {
    if (drawerState === 'closed') return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerState, closeDrawer]);

  // Touch drag handling
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      dragStartState.current = drawerState;
    },
    [drawerState],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - dragStartY.current;
      dragStartY.current = null;

      const threshold = 60;

      if (deltaY < -threshold) {
        // Swiped up
        if (dragStartState.current === 'closed') setDrawerState('peek');
        else if (dragStartState.current === 'peek') expandDrawer();
      } else if (deltaY > threshold) {
        // Swiped down
        if (dragStartState.current === 'full') setDrawerState('peek');
        else if (dragStartState.current === 'peek') closeDrawer();
      }
    },
    [setDrawerState, expandDrawer, closeDrawer],
  );

  const handleHandleClick = useCallback(() => {
    if (drawerState === 'closed') setDrawerState('peek');
    else {
      (document.activeElement as HTMLElement)?.blur();
      closeDrawer();
    }
  }, [drawerState, setDrawerState, closeDrawer]);

  const handleShowHistory = useCallback(() => {
    setHistoryOffset(0);
    loadHistory(0);
    setShowHistory(true);
  }, [loadHistory, setShowHistory]);

  const handleLoadMore = useCallback(() => {
    const nextOffset = historyOffset + 20;
    setHistoryOffset(nextOffset);
    loadHistory(nextOffset);
  }, [historyOffset, loadHistory]);

  const handleSend = useCallback((content: string, attachment?: { storagePath: string; fileType: string; fileName: string }) => {
    sendMessage(content, attachment);
  }, [sendMessage]);

  // Triage flow: start dump → trigger AI triage → show review
  const handleReviewAndRoute = useCallback(async () => {
    if (!activeConversation) return;
    setTriageLoading(true);

    try {
      const dump = await startDump(activeConversation.id);
      if (!dump) return;

      const items = await triggerTriage(activeConversation.id, dump.id);
      if (items.length > 0) {
        setShowTriageReview(true);
      }
    } finally {
      setTriageLoading(false);
    }
  }, [activeConversation, startDump, triggerTriage]);

  const handleRouteAll = useCallback(async (items: typeof triageItems) => {
    const counts = await routeAll(items);

    if (activeConversation) {
      await archiveToLog(activeConversation.id);
    }

    return counts;
  }, [routeAll, archiveToLog, activeConversation]);

  const handleTriageClose = useCallback(() => {
    setShowTriageReview(false);
  }, []);

  const contextLabel = PAGE_LABELS[pageContext.page] || pageContext.page;

  return (
    <>
      {/* Backdrop for peek/full states */}
      {drawerState !== 'closed' && (
        <div
          className="helm-drawer__backdrop"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        className={`helm-drawer helm-drawer--${drawerState}`}
        role={drawerState !== 'closed' ? 'dialog' : undefined}
        aria-label={drawerState !== 'closed' ? 'Helm chat drawer' : undefined}
      >
        {/* Drag handle */}
        <div
          className="helm-drawer__handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleClick}
          role="button"
          tabIndex={0}
          aria-label={drawerState === 'closed' ? 'Open Helm chat' : 'Close Helm chat'}
        >
          <div className="helm-drawer__handle-bar" />
        </div>

        {/* Header with controls */}
        {drawerState !== 'closed' && (
          <div className="helm-drawer__header">
            <div className="helm-drawer__header-left">
              <div className="helm-drawer__title-row">
                <h3 className="helm-drawer__title">The Helm</h3>
                {guidedModeLabel && (
                  <span className="helm-drawer__guided-tag">{guidedModeLabel}</span>
                )}
              </div>
              <span className="helm-drawer__context-label">
                From: {contextLabel}
              </span>
            </div>
            <div className="helm-drawer__controls">
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={startNewConversation}
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={handleShowHistory}
                aria-label="Conversation history"
                title="Conversation history"
              >
                <Clock size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={handleExpandToFullPage}
                aria-label="Expand to full page"
                title="Expand to full page"
              >
                <Maximize2 size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {drawerState !== 'closed' && (
          <div className="helm-drawer__content">
            {showHistory ? (
              <ConversationHistory
                conversations={conversations}
                activeConversationId={activeConversation?.id || null}
                loading={historyLoading}
                hasMore={hasMoreHistory}
                onSelect={switchConversation}
                onDelete={deleteConversation}
                onRename={renameConversation}
                onLoadMore={handleLoadMore}
                onClose={() => setShowHistory(false)}
              />
            ) : (
              <>
                <MessageList messages={messages} loading={loading} isThinking={isThinking} />

                {/* Review & Route action bar — available for all conversations */}
                {hasUserMessages && !showTriageReview && (
                  <div className="helm-drawer__unload-bar">
                    {triageLoading || sorting ? (
                      <div className="helm-drawer__unload-loading">
                        <LoadingSpinner />
                        <span>Sorting through the hold...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="helm-drawer__unload-btn"
                          onClick={handleReviewAndRoute}
                          disabled={isThinking}
                        >
                          <PackageOpen size={18} strokeWidth={1.5} />
                          Review & Route
                        </button>
                        {triageError && (
                          <span className="helm-drawer__unload-error">{triageError}</span>
                        )}
                      </>
                    )}
                  </div>
                )}

                <MessageInput onSend={handleSend} disabled={loading || isThinking} />
              </>
            )}
          </div>
        )}

        {/* Triage Review overlay */}
        {showTriageReview && triageItems.length > 0 && (
          <TriageReview
            items={triageItems}
            onUpdateItem={updateTriageItem}
            onDiscardItem={discardTriageItem}
            onRouteAll={handleRouteAll}
            onClose={handleTriageClose}
            routing={routing}
          />
        )}
      </div>
    </>
  );
}
