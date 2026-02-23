import { useState, useCallback } from 'react';
import { ArrowLeft, Trash2, Check, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared';
import { TRIAGE_CATEGORY_LABELS, TRIAGE_CATEGORY_DESTINATIONS } from '../../lib/types';
import type { TriageItem, TriageCategory } from '../../lib/types';
import './TriageReview.css';

interface RoutingCounts {
  tasksCreated: number;
  journalEntriesCreated: number;
  insightsCreated: number;
  principlesCreated: number;
  listItemsCreated: number;
  remindersStubbed: number;
  personNotesStubbed: number;
  discarded: number;
}

interface TriageReviewProps {
  items: TriageItem[];
  onUpdateItem: (itemId: string, updates: Partial<TriageItem>) => void;
  onDiscardItem: (itemId: string) => void;
  onRouteAll: (items: TriageItem[]) => Promise<RoutingCounts>;
  onClose: () => void;
  routing: boolean;
}

const ALL_CATEGORIES = Object.keys(TRIAGE_CATEGORY_LABELS) as TriageCategory[];

export default function TriageReview({
  items,
  onUpdateItem,
  onDiscardItem,
  onRouteAll,
  onClose,
  routing,
}: TriageReviewProps) {
  const [routingComplete, setRoutingComplete] = useState(false);
  const [routingCounts, setRoutingCounts] = useState<RoutingCounts | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const activeItems = items.filter((i) => i.category !== 'discard');
  const discardedCount = items.filter((i) => i.category === 'discard').length;

  const handleRouteAll = useCallback(async () => {
    const counts = await onRouteAll(items);
    setRoutingCounts(counts);
    setRoutingComplete(true);
  }, [items, onRouteAll]);

  const handleCategoryChange = useCallback((itemId: string, category: TriageCategory) => {
    onUpdateItem(itemId, { category });
    setCategoryPickerOpen(null);
  }, [onUpdateItem]);

  const handleTextChange = useCallback((itemId: string, text: string) => {
    onUpdateItem(itemId, { text });
  }, [onUpdateItem]);

  const handleRestoreItem = useCallback((itemId: string) => {
    onUpdateItem(itemId, { category: 'journal' });
  }, [onUpdateItem]);

  // Post-routing summary
  if (routingComplete && routingCounts) {
    const summaryLines: string[] = [];
    if (routingCounts.tasksCreated > 0) {
      summaryLines.push(`${routingCounts.tasksCreated} task${routingCounts.tasksCreated !== 1 ? 's' : ''} to Compass`);
    }
    if (routingCounts.journalEntriesCreated > 0) {
      summaryLines.push(`${routingCounts.journalEntriesCreated} entr${routingCounts.journalEntriesCreated !== 1 ? 'ies' : 'y'} to Log`);
    }
    if (routingCounts.insightsCreated > 0) {
      summaryLines.push(`${routingCounts.insightsCreated} insight${routingCounts.insightsCreated !== 1 ? 's' : ''} to Keel`);
    }
    if (routingCounts.principlesCreated > 0) {
      summaryLines.push(`${routingCounts.principlesCreated} principle${routingCounts.principlesCreated !== 1 ? 's' : ''} to Mast`);
    }
    if (routingCounts.listItemsCreated > 0) {
      summaryLines.push(`${routingCounts.listItemsCreated} list item${routingCounts.listItemsCreated !== 1 ? 's' : ''} noted`);
    }
    if (routingCounts.remindersStubbed > 0) {
      summaryLines.push(`${routingCounts.remindersStubbed} reminder${routingCounts.remindersStubbed !== 1 ? 's' : ''} as tasks`);
    }
    if (routingCounts.personNotesStubbed > 0) {
      summaryLines.push(`${routingCounts.personNotesStubbed} person note${routingCounts.personNotesStubbed !== 1 ? 's' : ''} noted`);
    }
    if (routingCounts.discarded > 0) {
      summaryLines.push(`${routingCounts.discarded} discarded`);
    }

    return (
      <div className="triage-review">
        <div className="triage-review__top-bar">
          <div className="triage-review__top-spacer" />
          <span className="triage-review__top-title">Routing Complete</span>
          <div className="triage-review__top-spacer" />
        </div>
        <div className="triage-review__summary">
          <div className="triage-review__summary-icon">
            <Check size={32} strokeWidth={1.5} />
          </div>
          <h3 className="triage-review__summary-heading">The hold is clear.</h3>
          <div className="triage-review__summary-counts">
            {summaryLines.map((line, i) => (
              <p key={i} className="triage-review__summary-line">{line}</p>
            ))}
          </div>
          <Button onClick={onClose} fullWidth>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="triage-review">
      <div className="triage-review__top-bar">
        <button
          type="button"
          className="triage-review__back"
          onClick={onClose}
          aria-label="Back to conversation"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="triage-review__top-title">Review & Route</span>
        <span className="triage-review__item-count">
          {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="triage-review__list">
        {activeItems.map((item) => (
          <div key={item.id} className="triage-review__item">
            <div className="triage-review__item-header">
              <div className="triage-review__category-wrapper">
                <button
                  type="button"
                  className={`triage-review__category-badge triage-review__category-badge--${item.category}`}
                  onClick={() => setCategoryPickerOpen(
                    categoryPickerOpen === item.id ? null : item.id,
                  )}
                >
                  {TRIAGE_CATEGORY_LABELS[item.category]}
                  <span className="triage-review__category-dest">
                    {TRIAGE_CATEGORY_DESTINATIONS[item.category]}
                  </span>
                  <ChevronDown size={12} />
                </button>
                {categoryPickerOpen === item.id && (
                  <>
                    <div
                      className="triage-review__picker-backdrop"
                      onClick={() => setCategoryPickerOpen(null)}
                      aria-hidden="true"
                    />
                    <div className="triage-review__category-picker">
                      {ALL_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`triage-review__picker-option ${
                            item.category === cat ? 'triage-review__picker-option--active' : ''
                          }`}
                          onClick={() => handleCategoryChange(item.id, cat)}
                        >
                          <span className="triage-review__picker-label">
                            {TRIAGE_CATEGORY_LABELS[cat]}
                          </span>
                          <span className="triage-review__picker-dest">
                            {TRIAGE_CATEGORY_DESTINATIONS[cat]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                className="triage-review__discard-btn"
                onClick={() => onDiscardItem(item.id)}
                aria-label="Discard item"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {editingItemId === item.id ? (
              <textarea
                className="triage-review__item-edit"
                value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value)}
                onBlur={() => setEditingItemId(null)}
                autoFocus
                rows={3}
              />
            ) : (
              <p
                className="triage-review__item-text"
                onClick={() => setEditingItemId(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setEditingItemId(item.id);
                }}
              >
                {item.text}
              </p>
            )}

            {/* Metadata chips — only show non-empty ones */}
            {(item.metadata.life_area_tag ||
              item.metadata.due_suggestion ||
              item.metadata.entry_type ||
              item.metadata.person_name ||
              item.metadata.suggested_list) && (
              <div className="triage-review__item-meta">
                {item.metadata.life_area_tag && (
                  <span className="triage-review__meta-chip">
                    {item.metadata.life_area_tag.replace(/_/g, ' ')}
                  </span>
                )}
                {item.metadata.due_suggestion && item.metadata.due_suggestion !== 'no_date' && (
                  <span className="triage-review__meta-chip">
                    {item.metadata.due_suggestion === 'today' ? 'Due today' : 'This week'}
                  </span>
                )}
                {item.metadata.entry_type && (
                  <span className="triage-review__meta-chip">{item.metadata.entry_type}</span>
                )}
                {item.metadata.person_name && (
                  <span className="triage-review__meta-chip">{item.metadata.person_name}</span>
                )}
                {item.metadata.suggested_list && (
                  <span className="triage-review__meta-chip">
                    List: {item.metadata.suggested_list}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {discardedCount > 0 && (
          <div className="triage-review__discarded-section">
            <span className="triage-review__discarded-label">
              {discardedCount} discarded
            </span>
            <div className="triage-review__discarded-items">
              {items
                .filter((i) => i.category === 'discard')
                .map((item) => (
                  <div key={item.id} className="triage-review__discarded-item">
                    <span className="triage-review__discarded-text">{item.text}</span>
                    <button
                      type="button"
                      className="triage-review__restore-btn"
                      onClick={() => handleRestoreItem(item.id)}
                      aria-label="Restore item"
                      title="Restore as journal entry"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="triage-review__bottom-bar">
        {routing ? (
          <div className="triage-review__routing-status">
            <LoadingSpinner />
            <span>Routing items...</span>
          </div>
        ) : (
          <>
            <Button
              onClick={handleRouteAll}
              disabled={activeItems.length === 0}
              fullWidth
            >
              Route {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
            </Button>
            <button
              type="button"
              className="triage-review__back-link"
              onClick={onClose}
            >
              Back to conversation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
