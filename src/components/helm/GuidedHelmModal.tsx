import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Maximize2, PackageOpen } from 'lucide-react';
import { useHelmContext } from '../../contexts/HelmContext';
import { useUnloadTheHold } from '../../hooks/useUnloadTheHold';
import { GUIDED_MODE_LABELS } from '../../lib/types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TriageReview from './TriageReview';
import { LoadingSpinner } from '../shared';
import './GuidedHelmModal.css';

export default function GuidedHelmModal() {
  const navigate = useNavigate();
  const {
    guidedModalOpen,
    closeGuidedModal,
    activeConversation,
    messages,
    loading,
    isThinking,
    sendMessage,
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

  const [showTriageReview, setShowTriageReview] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);

  const isUnloadMode = activeConversation?.guided_mode === 'unload_the_hold';
  const hasUserMessages = messages.some((m) => m.role === 'user');

  // Reset triage state when conversation changes
  useEffect(() => {
    resetTriage();
    setShowTriageReview(false);
  }, [activeConversation?.id, resetTriage]);

  // Escape key to close
  useEffect(() => {
    if (!guidedModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGuidedModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [guidedModalOpen, closeGuidedModal]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeGuidedModal();
  }, [closeGuidedModal]);

  const handleExpand = useCallback(() => {
    closeGuidedModal();
    navigate('/helm');
  }, [closeGuidedModal, navigate]);

  const handleSend = useCallback((content: string, attachment?: { storagePath: string; fileType: string; fileName: string }) => {
    sendMessage(content, attachment);
  }, [sendMessage]);

  // Triage flow for Unload the Hold
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

  if (!guidedModalOpen) return null;

  const guidedModeLabel = activeConversation?.guided_mode
    ? GUIDED_MODE_LABELS[activeConversation.guided_mode] || activeConversation.guided_mode
    : 'Guided';

  return (
    <div className="guided-helm-backdrop" onClick={handleBackdropClick}>
      <div className="guided-helm-modal">
        {/* Header */}
        <div className="guided-helm-modal__header">
          <div className="guided-helm-modal__header-left">
            <h2 className="guided-helm-modal__title">The Helm</h2>
            <span className="guided-helm-modal__mode-tag">{guidedModeLabel}</span>
          </div>
          <div className="guided-helm-modal__header-actions">
            <button
              type="button"
              className="guided-helm-modal__header-btn"
              onClick={handleExpand}
              aria-label="Expand to full page"
              title="Expand to full page"
            >
              <Maximize2 size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="guided-helm-modal__header-btn"
              onClick={closeGuidedModal}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="guided-helm-modal__body">
          {showTriageReview && triageItems.length > 0 ? (
            <TriageReview
              items={triageItems}
              onUpdateItem={updateTriageItem}
              onDiscardItem={discardTriageItem}
              onRouteAll={handleRouteAll}
              onClose={handleTriageClose}
              routing={routing}
            />
          ) : (
            <>
              <MessageList messages={messages} loading={loading} isThinking={isThinking} />

              {/* Unload the Hold: Review & Route bar */}
              {isUnloadMode && hasUserMessages && !showTriageReview && (
                <div className="guided-helm-modal__unload-bar">
                  {triageLoading || sorting ? (
                    <div className="guided-helm-modal__unload-loading">
                      <LoadingSpinner />
                      <span>Sorting through the hold...</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="guided-helm-modal__unload-btn"
                        onClick={handleReviewAndRoute}
                        disabled={isThinking}
                      >
                        <PackageOpen size={16} strokeWidth={1.5} />
                        Review & Route
                      </button>
                      {triageError && (
                        <span className="guided-helm-modal__unload-error">{triageError}</span>
                      )}
                    </>
                  )}
                </div>
              )}

              <MessageInput onSend={handleSend} disabled={loading || isThinking} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
