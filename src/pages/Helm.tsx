import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, History, MoreVertical } from 'lucide-react';
import { useHelmContext } from '../contexts/HelmContext';
import { usePageContext } from '../hooks/usePageContext';
import { GUIDED_MODE_LABELS } from '../lib/types';
import MessageList from '../components/helm/MessageList';
import MessageInput from '../components/helm/MessageInput';
import ConversationHistory from '../components/helm/ConversationHistory';
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
    loadHistory,
    showHistory,
    setShowHistory,
    closeDrawer,
    isThinking,
  } = useHelmContext();

  const [historyOffset, setHistoryOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleSend = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleSaveToLog = useCallback(() => {
    // Stub — will wire to Log in later phase
    setMenuOpen(false);
  }, []);

  const handleExport = useCallback(() => {
    // Stub — will implement in later phase
    setMenuOpen(false);
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
                    Save to Log
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

      {/* Content */}
      <div className="helm-page__content">
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
            <MessageList messages={messages} loading={loading} isThinking={isThinking} />
            <MessageInput onSend={handleSend} disabled={loading || isThinking} />
          </>
        )}
      </div>
    </div>
  );
}
