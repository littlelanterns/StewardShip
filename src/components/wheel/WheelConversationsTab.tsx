import { useEffect } from 'react';
import type { HelmConversation, WheelInstance } from '../../lib/types';
import { Card } from '../shared/Card';
import { EmptyState, LoadingSpinner } from '../shared';

interface WheelConversationsTabProps {
  wheel: WheelInstance;
  conversations: HelmConversation[];
  loading?: boolean;
  onLoad: (wheelId: string) => void;
  onConversationClick?: (conversationId: string) => void;
}

export function WheelConversationsTab({
  wheel,
  conversations,
  loading,
  onLoad,
  onConversationClick,
}: WheelConversationsTabProps) {
  useEffect(() => {
    onLoad(wheel.id);
  }, [wheel.id, onLoad]);

  if (loading) {
    return <LoadingSpinner size="sm" />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        heading="No conversations yet"
        message="Helm conversations about this Wheel will appear here."
      />
    );
  }

  return (
    <div className="wheel-conversations-tab">
      {conversations.map((conv) => {
        const date = new Date(conv.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <Card
            key={conv.id}
            className="wheel-conversations-tab__entry"
            onClick={onConversationClick ? () => onConversationClick(conv.id) : undefined}
          >
            <div className="wheel-conversations-tab__header">
              <span className="wheel-conversations-tab__title">
                {conv.title || 'Untitled Conversation'}
              </span>
              {conv.guided_mode && (
                <span className="wheel-conversations-tab__mode">
                  {conv.guided_mode.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <span className="wheel-conversations-tab__date">{date}</span>
          </Card>
        );
      })}
    </div>
  );
}
