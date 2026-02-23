import { useEffect, useState, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
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
  onDelete: (conversationId: string) => Promise<void>;
  onRename: (conversationId: string, title: string) => Promise<void>;
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
  onDelete,
  onRename,
  onLoadMore,
  onClose,
}: ConversationHistoryProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape (respects editing and delete-confirm states)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else if (confirmingDeleteId) {
          setConfirmingDeleteId(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, confirmingDeleteId, editingId]);

  // Focus the input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (e: React.MouseEvent, conv: HelmConversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title || '');
  };

  const commitRename = (conversationId: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (trimmed) {
      onRename(conversationId, trimmed);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setConfirmingDeleteId(conversationId);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmingDeleteId) return;
    setDeleting(true);
    try {
      await onDelete(confirmingDeleteId);
    } finally {
      setConfirmingDeleteId(null);
      setDeleting(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDeleteId(null);
  };

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
          <div
            key={conv.id}
            className={`conversation-history__item ${
              conv.id === activeConversationId ? 'conversation-history__item--active' : ''
            }`}
          >
            <div
              className="conversation-history__item-content"
              onClick={() => { if (!editingId) onSelect(conv.id); }}
            >
              {editingId === conv.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  className="conversation-history__item-rename"
                  value={editValue}
                  placeholder="Untitled conversation"
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitRename(conv.id);
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setEditingId(null);
                    }
                  }}
                  onBlur={() => commitRename(conv.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="conversation-history__item-title"
                  onClick={(e) => startEditing(e, conv)}
                >
                  {conv.title || 'Untitled conversation'}
                </span>
              )}
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
            </div>

            {confirmingDeleteId === conv.id ? (
              <div className="conversation-history__delete-confirm">
                <span className="conversation-history__delete-label">Delete?</span>
                <button
                  type="button"
                  className="conversation-history__delete-yes"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? '...' : 'Yes'}
                </button>
                <button
                  type="button"
                  className="conversation-history__delete-no"
                  onClick={handleCancelDelete}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="conversation-history__delete-btn"
                onClick={(e) => handleDeleteClick(e, conv.id)}
                aria-label="Delete conversation"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
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
