import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { WheelInstance, WheelRimEntry, LogEntry, HelmConversation } from '../../lib/types';
import { WHEEL_STATUS_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button } from '../shared';
import { SpokeView } from './SpokeView';
import { WheelJournalTab } from './WheelJournalTab';
import { WheelConversationsTab } from './WheelConversationsTab';
import './WheelDetail.css';

type DetailTab = 'spokes' | 'journal' | 'conversations';

interface WheelDetailProps {
  wheel: WheelInstance;
  rimEntries: WheelRimEntry[];
  linkedLogEntries: LogEntry[];
  linkedConversations: HelmConversation[];
  onBack: () => void;
  onContinueAtHelm: (wheel: WheelInstance) => void;
  onRimCheckIn: (wheel: WheelInstance) => void;
  onActivate: (id: string) => void;
  onComplete: (id: string) => void;
  onArchive: (id: string) => void;
  onLoadRimEntries: (wheelId: string) => void;
  onLoadJournal: (wheelId: string, tag?: string | null) => void;
  onLoadConversations: (wheelId: string) => void;
  onConversationClick?: (conversationId: string) => void;
}

export function WheelDetail({
  wheel,
  rimEntries,
  linkedLogEntries,
  linkedConversations,
  onBack,
  onContinueAtHelm,
  onRimCheckIn,
  onActivate,
  onComplete,
  onArchive,
  onLoadRimEntries,
  onLoadJournal,
  onLoadConversations,
  onConversationClick,
}: WheelDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('spokes');

  useEffect(() => {
    onLoadRimEntries(wheel.id);
  }, [wheel.id, onLoadRimEntries]);

  const handleLoadJournal = useCallback((wheelId: string, tag?: string | null) => {
    onLoadJournal(wheelId, tag);
  }, [onLoadJournal]);

  return (
    <div className="wheel-detail">
      <button type="button" className="wheel-detail__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="wheel-detail__header">
        <h2 className="wheel-detail__hub">{wheel.hub_text}</h2>
        <div className="wheel-detail__meta">
          <span
            className={`wheel-detail__status-badge${
              wheel.status === 'active' ? ' wheel-detail__status-badge--active' : ''
            }`}
          >
            {WHEEL_STATUS_LABELS[wheel.status]}
          </span>
          {wheel.life_area_tag && <span>{wheel.life_area_tag}</span>}
          {wheel.rim_count > 0 && (
            <span>{wheel.rim_count} Rim{wheel.rim_count > 1 ? 's' : ''}</span>
          )}
          {wheel.next_rim_date && wheel.status === 'active' && (
            <span>Next Rim: {wheel.next_rim_date}</span>
          )}
        </div>
      </div>

      <div className="wheel-detail__actions">
        {wheel.status === 'in_progress' && (
          <Button size="sm" onClick={() => onContinueAtHelm(wheel)}>
            Continue at Helm
          </Button>
        )}
        {wheel.status === 'active' && (
          <>
            <Button size="sm" onClick={() => onRimCheckIn(wheel)}>
              Rim Check-In
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onContinueAtHelm(wheel)}>
              Continue at Helm
            </Button>
          </>
        )}
        {wheel.status === 'in_progress' && wheel.current_spoke >= 6 && (
          <Button size="sm" variant="secondary" onClick={() => onActivate(wheel.id)}>
            Activate
          </Button>
        )}
        {wheel.status === 'active' && (
          <Button size="sm" variant="secondary" onClick={() => onComplete(wheel.id)}>
            Mark Complete
          </Button>
        )}
        {(wheel.status === 'completed' || wheel.status === 'in_progress') && (
          <Button size="sm" variant="text" onClick={() => onArchive(wheel.id)}>
            Archive
          </Button>
        )}
      </div>

      <div className="wheel-detail__tabs">
        <button
          type="button"
          className={`wheel-detail__tab${activeTab === 'spokes' ? ' wheel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('spokes')}
        >
          Spokes
        </button>
        <button
          type="button"
          className={`wheel-detail__tab${activeTab === 'journal' ? ' wheel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          className={`wheel-detail__tab${activeTab === 'conversations' ? ' wheel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          Conversations
        </button>
      </div>

      <div className="wheel-detail__tab-content">
        {activeTab === 'spokes' && (
          <>
            {[0, 1, 2, 3, 4, 5].map((spoke) => (
              <SpokeView key={spoke} wheel={wheel} spokeNumber={spoke} />
            ))}

            {rimEntries.length > 0 && (
              <div className="wheel-detail__rim-section">
                <h3>Rim Check-Ins ({rimEntries.length})</h3>
                {rimEntries.map((rim) => {
                  const date = new Date(rim.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  return (
                    <Card key={rim.id} className="wheel-detail__rim-entry">
                      <div className="wheel-detail__rim-header">
                        <span className="wheel-detail__rim-number">Rim #{rim.rim_number}</span>
                        <span className="wheel-detail__rim-date">{date}</span>
                      </div>
                      {rim.notes && (
                        <p className="wheel-detail__rim-notes">{rim.notes}</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'journal' && (
          <WheelJournalTab
            wheel={wheel}
            entries={linkedLogEntries}
            onLoad={handleLoadJournal}
          />
        )}

        {activeTab === 'conversations' && (
          <WheelConversationsTab
            wheel={wheel}
            conversations={linkedConversations}
            onLoad={onLoadConversations}
            onConversationClick={onConversationClick}
          />
        )}
      </div>
    </div>
  );
}
