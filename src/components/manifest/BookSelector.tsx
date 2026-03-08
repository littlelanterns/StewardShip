import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ManifestItem, DiscussionAudience } from '../../lib/types';
import { BOOK_GENRE_LABELS } from '../../lib/types';
import './BookSelector.css';

const AUDIENCE_OPTIONS: Array<{ value: DiscussionAudience; label: string }> = [
  { value: 'personal', label: 'Personal' },
  { value: 'family', label: 'Family' },
  { value: 'teen', label: 'Teen' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'children', label: 'Children' },
];

interface BookSelectorProps {
  items: ManifestItem[];
  onStart: (manifestItemIds: string[], audience: DiscussionAudience) => void;
  onClose: () => void;
}

export function BookSelector({ items, onStart, onClose }: BookSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState<DiscussionAudience>('personal');

  const completedItems = items.filter((i) => i.processing_status === 'completed');

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (selectedIds.size === 0) return;
    onStart(Array.from(selectedIds), audience);
  }, [selectedIds, audience, onStart]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="book-selector-backdrop" onClick={handleBackdropClick}>
      <div className="book-selector-modal">
        <div className="book-selector-modal__header">
          <h3 className="book-selector-modal__title">Select Books to Discuss</h3>
          <button type="button" className="book-selector-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="book-selector-modal__body">
          {completedItems.length === 0 ? (
            <div className="book-selector-modal__empty">
              No processed books available. Upload and process books first.
            </div>
          ) : (
            <>
              <div className="book-selector__audience-row">
                <span className="book-selector__audience-label">Audience:</span>
                <select
                  className="book-selector__audience-select"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as DiscussionAudience)}
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {completedItems.map((item) => (
                <label key={item.id} className="book-selector__item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => handleToggle(item.id)}
                  />
                  <div className="book-selector__item-info">
                    <div className="book-selector__item-title">{item.title}</div>
                    <div className="book-selector__item-meta">
                      {item.file_type.toUpperCase()}
                      {item.chunk_count > 0 && ` — ${item.chunk_count} chunks`}
                    </div>
                    {item.genres && item.genres.length > 0 && (
                      <div className="book-selector__item-genres">
                        {item.genres.map((g) => (
                          <span key={g} className="book-selector__genre-chip">
                            {BOOK_GENRE_LABELS[g] || g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="book-selector-modal__footer">
          <span className="book-selector__count">
            {selectedIds.size} book{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            className="book-selector__start-btn"
            onClick={handleStart}
            disabled={selectedIds.size === 0}
          >
            Start Discussion
          </button>
        </div>
      </div>
    </div>
  );
}
