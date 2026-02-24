import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageContext } from '../hooks/usePageContext';
import { useWheel } from '../hooks/useWheel';
import { useHelmContext } from '../contexts/HelmContext';
import type { WheelInstance } from '../lib/types';
import { FloatingActionButton, LoadingSpinner, EmptyState, Button } from '../components/shared';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { WheelCard } from '../components/wheel/WheelCard';
import { WheelDetail } from '../components/wheel/WheelDetail';
import './Wheel.css';

type WheelView = 'list' | 'detail';

export default function Wheel() {
  usePageContext({ page: 'wheel' });
  const navigate = useNavigate();
  const { startGuidedConversation, openDrawer, expandDrawer, switchConversation } = useHelmContext();

  const {
    wheels,
    selectedWheel,
    rimEntries,
    linkedLogEntries,
    linkedConversations,
    loading,
    fetchWheels,
    fetchWheel,
    activateWheel,
    completeWheel,
    archiveWheel,
    fetchRimEntries,
    getLinkedLogEntries,
    getLinkedConversations,
    setSelectedWheel,
  } = useWheel();

  const [view, setView] = useState<WheelView>('list');

  useEffect(() => {
    fetchWheels();
  }, [fetchWheels]);

  const activeWheels = wheels.filter((w) => w.status === 'active' || w.status === 'in_progress');
  const completedWheels = wheels.filter((w) => w.status === 'completed');

  const handleWheelClick = useCallback(async (wheel: WheelInstance) => {
    await fetchWheel(wheel.id);
    setView('detail');
  }, [fetchWheel]);

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedWheel(null);
    fetchWheels();
  }, [setSelectedWheel, fetchWheels]);

  const handleStartNew = useCallback(async () => {
    const conversation = await startGuidedConversation('wheel');
    if (conversation) {
      expandDrawer();
      navigate('/helm');
    }
  }, [startGuidedConversation, expandDrawer, navigate]);

  const handleContinueAtHelm = useCallback(async (wheel: WheelInstance) => {
    const conversation = await startGuidedConversation('wheel', undefined, wheel.id);
    if (conversation) {
      expandDrawer();
      navigate('/helm');
    }
  }, [startGuidedConversation, expandDrawer, navigate]);

  const handleRimCheckIn = useCallback(async (wheel: WheelInstance) => {
    const conversation = await startGuidedConversation('wheel', undefined, wheel.id);
    if (conversation) {
      expandDrawer();
      navigate('/helm');
    }
  }, [startGuidedConversation, expandDrawer, navigate]);

  const handleConversationClick = useCallback(async (conversationId: string) => {
    await switchConversation(conversationId);
    openDrawer();
    expandDrawer();
  }, [switchConversation, openDrawer, expandDrawer]);

  if (view === 'detail' && selectedWheel) {
    return (
      <div className="page wheel-page">
        <WheelDetail
          wheel={selectedWheel}
          rimEntries={rimEntries}
          linkedLogEntries={linkedLogEntries}
          linkedConversations={linkedConversations}
          onBack={handleBack}
          onContinueAtHelm={handleContinueAtHelm}
          onRimCheckIn={handleRimCheckIn}
          onActivate={activateWheel}
          onComplete={completeWheel}
          onArchive={(id) => { archiveWheel(id); handleBack(); }}
          onLoadRimEntries={fetchRimEntries}
          onLoadJournal={getLinkedLogEntries}
          onLoadConversations={getLinkedConversations}
          onConversationClick={handleConversationClick}
        />
      </div>
    );
  }

  return (
    <div className="page wheel-page">
      <div className="wheel-page__header">
        <h1 className="wheel-page__title">The Wheel</h1>
        <p className="wheel-page__subtitle">
          For the big changes — character, identity, deep patterns.
        </p>
      </div>

      {loading && wheels.length === 0 ? (
        <div className="wheel-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : wheels.length === 0 ? (
        <EmptyState
          heading="Begin a Change Process"
          message="The Wheel walks you through deep character change — not habits or tasks, but who you are becoming. Each Wheel has a hub, six spokes, and periodic check-ins."
        />
      ) : (
        <div className="wheel-page__content">
          {activeWheels.length > 0 && (
            <div className="wheel-page__section">
              {activeWheels.map((wheel) => (
                <WheelCard key={wheel.id} wheel={wheel} onClick={handleWheelClick} />
              ))}
            </div>
          )}

          {completedWheels.length > 0 && (
            <CollapsibleGroup
              label="Completed"
              count={completedWheels.length}
              defaultExpanded={false}
            >
              {completedWheels.map((wheel) => (
                <WheelCard key={wheel.id} wheel={wheel} onClick={handleWheelClick} />
              ))}
            </CollapsibleGroup>
          )}
        </div>
      )}

      <FloatingActionButton onClick={handleStartNew} aria-label="Start a New Wheel">
        +
      </FloatingActionButton>
    </div>
  );
}
