import { useState } from 'react';
import { Copy, Trash2, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../shared';
import type { HigginsMessage } from '../../lib/types';
import { HIGGINS_TEACHING_SKILL_LABELS } from '../../lib/types';
import './HigginsDrafts.css';

interface HigginsDraftsProps {
  drafts: HigginsMessage[];
  onMarkSent: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function HigginsDrafts({ drafts, onMarkSent, onDelete }: HigginsDraftsProps) {
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
    <Card className="higgins-drafts">
      <button
        className="higgins-drafts__header"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="higgins-drafts__title">Higgins Drafts</h3>
        <span className="higgins-drafts__count">{drafts.length}</span>
      </button>

      {toast && <div className="higgins-drafts__toast">{toast}</div>}

      {expanded && (
        <div className="higgins-drafts__list">
          {drafts.map((draft) => {
            const isExpanded = expandedDraftId === draft.id;
            const displayText = draft.final_version || draft.crafted_version || draft.raw_input;
            return (
              <div key={draft.id} className="higgins-drafts__item">
                <div className="higgins-drafts__badges">
                  <span className="higgins-drafts__mode-badge">
                    {draft.mode === 'say_something' ? 'Say' : 'Navigate'}
                  </span>
                  {draft.teaching_skill && (
                    <span className="higgins-drafts__skill-badge">
                      {HIGGINS_TEACHING_SKILL_LABELS[draft.teaching_skill]}
                    </span>
                  )}
                </div>
                {isExpanded && draft.crafted_version && draft.raw_input !== draft.crafted_version && (
                  <div className="higgins-drafts__raw">
                    Your original: {draft.raw_input}
                  </div>
                )}
                <button
                  className="higgins-drafts__item-text"
                  onClick={() => setExpandedDraftId(isExpanded ? null : draft.id)}
                >
                  {isExpanded ? displayText : truncate(displayText)}
                </button>
                <div className="higgins-drafts__item-meta">
                  <span className="higgins-drafts__item-date">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </span>
                  <div className="higgins-drafts__item-actions">
                    {displayText && (
                      <button
                        className="higgins-drafts__action-btn"
                        onClick={() => handleCopy(displayText)}
                        aria-label="Copy draft"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    <button
                      className="higgins-drafts__action-btn higgins-drafts__action-btn--send"
                      onClick={() => onMarkSent(draft.id)}
                      aria-label="Mark as sent"
                    >
                      <Send size={14} />
                    </button>
                    {confirmDeleteId === draft.id ? (
                      <span className="higgins-drafts__confirm">
                        Remove?{' '}
                        <button onClick={() => { onDelete(draft.id); setConfirmDeleteId(null); }}>Yes</button>{' '}
                        <button onClick={() => setConfirmDeleteId(null)}>No</button>
                      </span>
                    ) : (
                      <button
                        className="higgins-drafts__action-btn"
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
