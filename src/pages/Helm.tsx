import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, History, MoreVertical, PackageOpen } from 'lucide-react';
import { useHelmContext } from '../contexts/HelmContext';
import { usePageContext } from '../hooks/usePageContext';
import { useUnloadTheHold } from '../hooks/useUnloadTheHold';
import { GUIDED_MODE_LABELS } from '../lib/types';
import MessageList from '../components/helm/MessageList';
import MessageInput from '../components/helm/MessageInput';
import ConversationHistory from '../components/helm/ConversationHistory';
import TriageReview from '../components/helm/TriageReview';
import { LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Helm.css';

export default function Helm() {
  usePageContext({ page: 'helm' });
  const navigate = useNavigate();
  const {
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
    closeDrawer,
    isThinking,
  } = useHelmContext();

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

  const [historyOffset, setHistoryOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTriageReview, setShowTriageReview] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);

  const hasUserMessages = messages.some((m) => m.role === 'user');

  // Reset triage state when conversation changes
  useEffect(() => {
    resetTriage();
    setShowTriageReview(false);
  }, [activeConversation?.id, resetTriage]);

  // Close drawer when entering full page (it shares state)
  useEffect(() => {
    closeDrawer();
  }, [closeDrawer]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

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

  const handleSaveToLog = useCallback(() => {
    // Stub — will wire to Journal in later phase
    setMenuOpen(false);
  }, []);

  const handleExport = useCallback(() => {
    // Stub — will implement in later phase
    setMenuOpen(false);
  }, []);

  // Triage flow: start dump → trigger AI triage → show review
  const handleReviewAndRoute = useCallback(async () => {
    if (!activeConversation) return;
    setTriageLoading(true);

    try {
      // Create hold_dumps record
      const dump = await startDump(activeConversation.id);
      if (!dump) return;

      // Trigger AI triage (pass dump.id to avoid stale closure)
      const items = await triggerTriage(activeConversation.id, dump.id);
      if (items.length > 0) {
        setShowTriageReview(true);
      }
    } finally {
      setTriageLoading(false);
    }
  }, [activeConversation, startDump, triggerTriage]);

  // Handle routing completion — also archive raw dump to Journal
  const handleRouteAll = useCallback(async (items: typeof triageItems) => {
    const counts = await routeAll(items);

    // Archive raw dump text to Journal as brain_dump entry
    if (activeConversation) {
      await archiveToLog(activeConversation.id);
    }

    return counts;
  }, [routeAll, archiveToLog, activeConversation]);

  const handleTriageClose = useCallback(() => {
    setShowTriageReview(false);
  }, []);

  const guidedModeLabel = activeConversation?.guided_mode
    ? GUIDED_MODE_LABELS[activeConversation.guided_mode]
    : null;

  return (
    <div className="helm-page">
      {/* Top bar */}
      <div className="helm-page__top-bar">
        <button
          type="button"
          className="helm-page__top-btn"
          onClick={handleBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>

        <div className="helm-page__top-center">
          <h1 className="helm-page__title">The Helm</h1>
          {guidedModeLabel && (
            <span className="helm-page__guided-tag">{guidedModeLabel}</span>
          )}
        </div>

        <div className="helm-page__top-actions">
          <button
            type="button"
            className="helm-page__top-btn"
            onClick={startNewConversation}
            aria-label="New conversation"
            title="New conversation"
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="helm-page__top-btn"
            onClick={handleShowHistory}
            aria-label="Conversation history"
            title="Conversation history"
          >
            <History size={20} strokeWidth={1.5} />
          </button>
          <div className="helm-page__menu-wrapper">
            <button
              type="button"
              className="helm-page__top-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More options"
            >
              <MoreVertical size={20} strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="helm-page__menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="helm-page__menu" role="menu">
                  <button
                    type="button"
                    className="helm-page__menu-item"
                    role="menuitem"
                    onClick={handleSaveToLog}
                  >
                    Save to Journal
                  </button>
                  <button
                    type="button"
                    className="helm-page__menu-item"
                    role="menuitem"
                    onClick={handleExport}
                  >
                    Export conversation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.helm} />

      {/* Content */}
      <div className="helm-page__content">
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
              <div className="helm-page__unload-bar">
                {triageLoading || sorting ? (
                  <div className="helm-page__unload-loading">
                    <LoadingSpinner />
                    <span>Sorting through the hold...</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="helm-page__unload-btn"
                      onClick={handleReviewAndRoute}
                      disabled={isThinking}
                    >
                      <PackageOpen size={18} strokeWidth={1.5} />
                      Review & Route
                    </button>
                    {triageError && (
                      <span className="helm-page__unload-error">{triageError}</span>
                    )}
                  </>
                )}
              </div>
            )}

            <MessageInput onSend={handleSend} disabled={loading || isThinking} />
          </>
        )}
      </div>

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
  );
}
