import { useState } from 'react';
import { X, Copy, Trash2, Edit3, Check, ExternalLink } from 'lucide-react';
import type { Victory, MastEntry } from '../../lib/types';
import { LIFE_AREA_LABELS, VICTORY_SOURCE_LABELS } from '../../lib/types';
import { Button } from '../shared/Button';
import './VictoryDetail.css';

interface VictoryDetailProps {
  victory: Victory;
  mastEntries: MastEntry[];
  onUpdate: (id: string, updates: Partial<Victory>) => Promise<Victory | null>;
  onArchive: (id: string) => void;
  onClose: () => void;
  onNavigateToSource?: (source: string, id: string) => void;
}

export function VictoryDetail({
  victory,
  mastEntries,
  onUpdate,
  onArchive,
  onClose,
  onNavigateToSource,
}: VictoryDetailProps) {
  const [editingCelebration, setEditingCelebration] = useState(false);
  const [celebrationDraft, setCelebrationDraft] = useState(victory.celebration_text || '');
  const [toast, setToast] = useState<string | null>(null);

  const date = new Date(victory.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const time = new Date(victory.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveCelebration = async () => {
    await onUpdate(victory.id, { celebration_text: celebrationDraft || null });
    setEditingCelebration(false);
  };

  const handleCopyToClipboard = () => {
    const text = [
      victory.description,
      victory.celebration_text ? `\n${victory.celebration_text}` : '',
      `\n— ${date}`,
    ].join('');
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  };

  const connectedMast = mastEntries.find((m) => m.id === victory.related_mast_entry_id);

  const sourceExists = victory.source_reference_id != null;

  return (
    <div className="victory-detail-overlay" onClick={onClose}>
      <div className="victory-detail" onClick={(e) => e.stopPropagation()}>
        <div className="victory-detail__header">
          <h2 className="victory-detail__title">Victory</h2>
          <button type="button" className="victory-detail__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="victory-detail__body">
          <p className="victory-detail__description">{victory.description}</p>

          <div className="victory-detail__section">
            <div className="victory-detail__section-header">
              <h4>Celebration</h4>
              {!editingCelebration && (
                <button
                  type="button"
                  className="victory-detail__edit-btn"
                  onClick={() => setEditingCelebration(true)}
                  aria-label="Edit celebration text"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            {editingCelebration ? (
              <div className="victory-detail__edit-area">
                <textarea
                  value={celebrationDraft}
                  onChange={(e) => setCelebrationDraft(e.target.value)}
                  rows={3}
                  className="victory-detail__textarea"
                />
                <div className="victory-detail__edit-actions">
                  <Button variant="text" onClick={() => setEditingCelebration(false)}>Cancel</Button>
                  <Button onClick={handleSaveCelebration}>
                    <Check size={14} /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="victory-detail__celebration">
                {victory.celebration_text || 'No celebration text yet.'}
              </p>
            )}
          </div>

          {victory.life_area_tag && (
            <div className="victory-detail__field">
              <span className="victory-detail__label">Life Area</span>
              <span className="victory-detail__tag">
                {LIFE_AREA_LABELS[victory.life_area_tag] || victory.life_area_tag}
              </span>
            </div>
          )}

          {connectedMast && (
            <div className="victory-detail__field">
              <span className="victory-detail__label">Connected Principle</span>
              <span className="victory-detail__mast-link">{connectedMast.text}</span>
            </div>
          )}

          <div className="victory-detail__field">
            <span className="victory-detail__label">Source</span>
            <span className="victory-detail__source-info">
              {VICTORY_SOURCE_LABELS[victory.source]}
              {victory.source_reference_id && onNavigateToSource && sourceExists && (
                <button
                  type="button"
                  className="victory-detail__source-link"
                  onClick={() => onNavigateToSource(victory.source, victory.source_reference_id!)}
                >
                  <ExternalLink size={12} /> View source
                </button>
              )}
            </span>
          </div>

          <div className="victory-detail__field">
            <span className="victory-detail__label">Recorded</span>
            <span>{date} at {time}</span>
          </div>
        </div>

        <div className="victory-detail__actions">
          <Button variant="text" onClick={handleCopyToClipboard}>
            <Copy size={14} /> Share
          </Button>
          <Button
            variant="text"
            onClick={() => {
              onArchive(victory.id);
              onClose();
            }}
            className="victory-detail__archive-btn"
          >
            <Trash2 size={14} /> Archive
          </Button>
        </div>

        {toast && <div className="victory-detail__toast">{toast}</div>}
      </div>
    </div>
  );
}
