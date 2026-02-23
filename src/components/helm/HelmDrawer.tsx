import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X, Plus, History } from 'lucide-react';
import { useHelmContext } from '../../contexts/HelmContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConversationHistory from './ConversationHistory';
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
    loadHistory,
    showHistory,
    setShowHistory,
  } = useHelmContext();

  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartState = useRef(drawerState);
  const [historyOffset, setHistoryOffset] = useState(0);

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
    else if (drawerState === 'peek') closeDrawer();
    else closeDrawer();
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

  const handleSend = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

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
        role="dialog"
        aria-label="Helm chat drawer"
        aria-hidden={drawerState === 'closed'}
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
              <h3 className="helm-drawer__title">The Helm</h3>
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
                <History size={18} strokeWidth={1.5} />
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
                onLoadMore={handleLoadMore}
                onClose={() => setShowHistory(false)}
              />
            ) : (
              <>
                <MessageList messages={messages} loading={loading} />
                <MessageInput onSend={handleSend} disabled={loading} />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
