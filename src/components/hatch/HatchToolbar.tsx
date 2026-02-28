import { useState, useCallback } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { VoiceRecordButton } from '../shared';
import { useHatchContext } from '../../contexts/HatchContext';
import HatchSendToGrid from './HatchSendToGrid';
import HatchReviewRoute from './HatchReviewRoute';
import './HatchToolbar.css';

interface HatchToolbarProps {
  tabId: string;
}

export default function HatchToolbar({ tabId }: HatchToolbarProps) {
  const { tabs, updateTabContent } = useHatchContext();
  const [showGrid, setShowGrid] = useState(false);
  const [showReviewRoute, setShowReviewRoute] = useState(false);

  const activeTab = tabs.find((t) => t.id === tabId);
  const hasContent = activeTab ? activeTab.content.trim().length > 0 : false;

  const handleVoiceTranscription = useCallback(
    (text: string) => {
      if (!activeTab) return;
      const newContent = activeTab.content
        ? activeTab.content + '\n' + text
        : text;
      updateTabContent(tabId, newContent);
    },
    [activeTab, tabId, updateTabContent],
  );

  const handleSendToClick = useCallback(() => {
    setShowGrid(true);
  }, []);

  const handleGridClose = useCallback(() => {
    setShowGrid(false);
  }, []);

  const handleReviewRouteClick = useCallback(() => {
    setShowReviewRoute(true);
  }, []);

  const handleReviewRouteClose = useCallback(() => {
    setShowReviewRoute(false);
  }, []);

  if (showReviewRoute) {
    return <HatchReviewRoute tabId={tabId} onClose={handleReviewRouteClose} />;
  }

  if (showGrid) {
    return <HatchSendToGrid tabId={tabId} onClose={handleGridClose} />;
  }

  return (
    <div className="hatch-toolbar">
      <div className="hatch-toolbar__voice">
        <VoiceRecordButton
          onTranscription={handleVoiceTranscription}
          compact
        />
      </div>

      <div className="hatch-toolbar__actions">
        <button
          type="button"
          className="hatch-toolbar__review-btn"
          onClick={handleReviewRouteClick}
          disabled={!hasContent}
        >
          <Sparkles size={16} strokeWidth={1.5} />
          Review & Route
        </button>

        <button
          type="button"
          className="hatch-toolbar__send-btn"
          onClick={handleSendToClick}
          disabled={!hasContent}
        >
          <Send size={16} strokeWidth={1.5} />
          Send to...
        </button>
      </div>
    </div>
  );
}
