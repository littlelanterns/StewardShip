import { useState } from 'react';
import { Copy, Trash2, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../shared';
import type { CyranoMessage } from '../../lib/types';
import { CYRANO_TEACHING_SKILL_LABELS } from '../../lib/types';

interface CyranoDraftsProps {
  drafts: CyranoMessage[];
  onMarkSent: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CyranoDrafts({ drafts, onMarkSent, onDelete }: CyranoDraftsProps) {
  const [expanded, setExpanded] = useState(drafts.length > 0);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (drafts.length === 0) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Copied');
    setTimeout(() => setToast(null), 1500);
  };

  const truncate = (text: string, max = 120) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  return (
    <Card className="cyrano-drafts">
      <button
        className="cyrano-drafts__header"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="cyrano-drafts__title">Cyrano Drafts</h3>
        <span className="cyrano-drafts__count">{drafts.length}</span>
      </button>

      {toast && <div className="cyrano-drafts__toast">{toast}</div>}

      {expanded && (
        <div className="cyrano-drafts__list">
          {drafts.map((draft) => {
            const isExpanded = expandedDraftId === draft.id;
            return (
              <div key={draft.id} className="cyrano-drafts__item">
                {draft.teaching_skill && (
                  <span className="cyrano-drafts__skill-badge">
                    {CYRANO_TEACHING_SKILL_LABELS[draft.teaching_skill]}
                  </span>
                )}
                {isExpanded && draft.raw_input !== draft.crafted_version && (
                  <div className="cyrano-drafts__raw">
                    Your original: {draft.raw_input}
                  </div>
                )}
                <button
                  className="cyrano-drafts__item-text"
                  onClick={() => setExpandedDraftId(isExpanded ? null : draft.id)}
                >
                  {isExpanded ? draft.crafted_version : truncate(draft.crafted_version)}
                </button>
                <div className="cyrano-drafts__item-meta">
                  <span className="cyrano-drafts__item-date">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </span>
                  <div className="cyrano-drafts__item-actions">
                    <button
                      className="cyrano-drafts__action-btn"
                      onClick={() => handleCopy(draft.final_version || draft.crafted_version)}
                      aria-label="Copy draft"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="cyrano-drafts__action-btn cyrano-drafts__action-btn--send"
                      onClick={() => onMarkSent(draft.id)}
                      aria-label="Mark as sent"
                    >
                      <Send size={14} />
                    </button>
                    {confirmDeleteId === draft.id ? (
                      <span className="cyrano-drafts__confirm">
                        Remove?{' '}
                        <button onClick={() => { onDelete(draft.id); setConfirmDeleteId(null); }}>Yes</button>{' '}
                        <button onClick={() => setConfirmDeleteId(null)}>No</button>
                      </span>
                    ) : (
                      <button
                        className="cyrano-drafts__action-btn"
                        onClick={() => setConfirmDeleteId(draft.id)}
                        aria-label="Delete draft"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
