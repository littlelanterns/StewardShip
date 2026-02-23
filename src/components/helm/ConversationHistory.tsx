import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { HelmConversation } from '../../lib/types';
import { GUIDED_MODE_LABELS } from '../../lib/types';
import { LoadingSpinner } from '../shared';
import './ConversationHistory.css';

interface ConversationHistoryProps {
  conversations: HelmConversation[];
  activeConversationId: string | null;
  loading: boolean;
  hasMore: boolean;
  onSelect: (conversationId: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ConversationHistory({
  conversations,
  activeConversationId,
  loading,
  hasMore,
  onSelect,
  onLoadMore,
  onClose,
}: ConversationHistoryProps) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="conversation-history">
      <div className="conversation-history__header">
        <h3 className="conversation-history__title">Conversations</h3>
        <button
          type="button"
          className="conversation-history__close"
          onClick={onClose}
          aria-label="Close conversation history"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="conversation-history__list">
        {conversations.length === 0 && !loading && (
          <p className="conversation-history__empty">
            No conversations yet.
          </p>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            className={`conversation-history__item ${
              conv.id === activeConversationId ? 'conversation-history__item--active' : ''
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <span className="conversation-history__item-title">
              {conv.title || 'Untitled conversation'}
            </span>
            <span className="conversation-history__item-meta">
              <span className="conversation-history__item-date">
                {formatDate(conv.created_at)}
              </span>
              {conv.guided_mode && (
                <span className="conversation-history__item-tag">
                  {GUIDED_MODE_LABELS[conv.guided_mode] || conv.guided_mode}
                </span>
              )}
            </span>
          </button>
        ))}

        {loading && (
          <div className="conversation-history__loading">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {hasMore && !loading && (
          <button
            type="button"
            className="conversation-history__load-more"
            onClick={onLoadMore}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
