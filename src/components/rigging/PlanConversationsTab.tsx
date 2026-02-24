import { useEffect } from 'react';
import type { HelmConversation, RiggingPlan } from '../../lib/types';
import { Card } from '../shared/Card';
import { EmptyState, LoadingSpinner } from '../shared';

interface PlanConversationsTabProps {
  plan: RiggingPlan;
  conversations: HelmConversation[];
  loading?: boolean;
  onLoad: (planId: string) => void;
  onConversationClick?: (conversationId: string) => void;
}

export function PlanConversationsTab({
  plan,
  conversations,
  loading,
  onLoad,
  onConversationClick,
}: PlanConversationsTabProps) {
  useEffect(() => {
    onLoad(plan.id);
  }, [plan.id, onLoad]);

  if (loading) {
    return <LoadingSpinner size="sm" />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        heading="No conversations yet"
        message="Helm conversations about this plan will appear here."
      />
    );
  }

  return (
    <div className="plan-conversations-tab">
      {conversations.map((conv) => {
        const date = new Date(conv.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <Card
            key={conv.id}
            className="plan-conversations-tab__entry"
            onClick={onConversationClick ? () => onConversationClick(conv.id) : undefined}
          >
            <div className="plan-conversations-tab__header">
              <span className="plan-conversations-tab__title">
                {conv.title || 'Untitled Conversation'}
              </span>
              {conv.guided_mode && (
                <span className="plan-conversations-tab__mode">
                  {conv.guided_mode.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <span className="plan-conversations-tab__date">{date}</span>
          </Card>
        );
      })}
    </div>
  );
}
