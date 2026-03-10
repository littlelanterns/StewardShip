import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './TagPills.css';

export interface TagPillsProps {
  /** Array of [tag, count] tuples */
  tags: Array<[string, number]>;
  /** Set of currently active/selected tags */
  activeTags: Set<string>;
  /** Called when a tag is toggled */
  onToggle: (tag: string) => void;
  /** Called when clear is pressed */
  onClear: () => void;
  /** User usage counts for sorting by popularity */
  usageCounts?: Record<string, number>;
  /** Collapsible section with toggle header? */
  collapsible?: boolean;
  /** Label for the collapsible toggle */
  label?: string;
  /** Show counts next to each tag? Default true */
  showCounts?: boolean;
  /** Horizontal scrolling single-row mode? */
  horizontal?: boolean;
  /** Show "All" button (for horizontal mode)? */
  showAllButton?: boolean;
  /** Remove max-height on pill list? */
  noMaxHeight?: boolean;
  /** Format tag label (default: replace _ with space) */
  formatLabel?: (tag: string) => string;
}

export function TagPills({
  tags,
  activeTags,
  onToggle,
  onClear,
  usageCounts,
  collapsible = false,
  label = 'Filter by tag',
  showCounts = true,
  horizontal = false,
  showAllButton = false,
  noMaxHeight = false,
  formatLabel,
}: TagPillsProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<'usage' | 'alpha'>('usage');

  const format = formatLabel || ((t: string) => t.replace(/_/g, ' '));

  const sorted = useMemo(() => {
    const list = [...tags];
    if (sortMode === 'alpha') {
      list.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      // Sort by user usage counts (if provided), then by item count, then alpha
      list.sort((a, b) => {
        const aUsage = usageCounts?.[a[0]] || 0;
        const bUsage = usageCounts?.[b[0]] || 0;
        if (bUsage !== aUsage) return bUsage - aUsage;
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      });
    }
    return list;
  }, [tags, sortMode, usageCounts]);

  if (tags.length === 0) return null;

  // Horizontal mode — simple scrolling row
  if (horizontal) {
    return (
      <div className="tag-pills--horizontal">
        {showAllButton && (
          <button
            type="button"
            className={`tag-pills__pill${activeTags.size === 0 ? ' tag-pills__pill--active' : ''}`}
            onClick={onClear}
          >
            All
          </button>
        )}
        {sorted.map(([tag, count]) => (
          <button
            key={tag}
            type="button"
            className={`tag-pills__pill${activeTags.has(tag) ? ' tag-pills__pill--active' : ''}`}
            onClick={() => onToggle(tag)}
          >
            {format(tag)}{showCounts && <> <span className="tag-pills__count">{count}</span></>}
          </button>
        ))}
      </div>
    );
  }

  // Collapsible mode
  if (collapsible) {
    return (
      <div className="tag-pills">
        <button
          type="button"
          className="tag-pills__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{label} ({tags.length})</span>
          {activeTags.size > 0 && (
            <span className="tag-pills__active-badge">{activeTags.size} active</span>
          )}
        </button>
        {expanded && (
          <>
            <div className="tag-pills__controls">
              <button
                type="button"
                className={`tag-pills__sort-btn${sortMode === 'usage' ? ' tag-pills__sort-btn--active' : ''}`}
                onClick={() => setSortMode('usage')}
              >
                Popular
              </button>
              <button
                type="button"
                className={`tag-pills__sort-btn${sortMode === 'alpha' ? ' tag-pills__sort-btn--active' : ''}`}
                onClick={() => setSortMode('alpha')}
              >
                A-Z
              </button>
              {activeTags.size > 0 && (
                <button
                  type="button"
                  className="tag-pills__sort-btn"
                  onClick={onClear}
                >
                  Clear
                </button>
              )}
            </div>
            <div className={`tag-pills__list${noMaxHeight ? ' tag-pills__list--no-max' : ''}`}>
              {sorted.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-pills__pill${activeTags.has(tag) ? ' tag-pills__pill--active' : ''}`}
                  onClick={() => onToggle(tag)}
                >
                  {format(tag)}{showCounts && <> <span className="tag-pills__count">{count}</span></>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Default: always-visible wrapped pills
  return (
    <div className="tag-pills">
      <div className="tag-pills__controls">
        <button
          type="button"
          className={`tag-pills__sort-btn${sortMode === 'usage' ? ' tag-pills__sort-btn--active' : ''}`}
          onClick={() => setSortMode('usage')}
        >
          Popular
        </button>
        <button
          type="button"
          className={`tag-pills__sort-btn${sortMode === 'alpha' ? ' tag-pills__sort-btn--active' : ''}`}
          onClick={() => setSortMode('alpha')}
        >
          A-Z
        </button>
        {activeTags.size > 0 && (
          <button
            type="button"
            className="tag-pills__sort-btn"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      <div className={`tag-pills__list${noMaxHeight ? ' tag-pills__list--no-max' : ''}`}>
        {sorted.map(([tag, count]) => (
          <button
            key={tag}
            type="button"
            className={`tag-pills__pill${activeTags.has(tag) ? ' tag-pills__pill--active' : ''}`}
            onClick={() => onToggle(tag)}
          >
            {format(tag)}{showCounts && <> <span className="tag-pills__count">{count}</span></>}
          </button>
        ))}
      </div>
    </div>
  );
}
