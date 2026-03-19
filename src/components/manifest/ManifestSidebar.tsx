import { useState, useMemo } from 'react';
import { Library, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { ManifestItem } from '../../lib/types';
import './ManifestSidebar.css';

interface ManifestSidebarProps {
  items: ManifestItem[];
  selectedItemId: string | null;
  currentSections?: Array<{ key: string; title: string }>;
  currentSectionKey?: string | null;
  onSelectItem: (item: ManifestItem) => void;
  onBackToLibrary: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ManifestSidebar({
  items,
  selectedItemId,
  currentSections,
  currentSectionKey,
  onSelectItem,
  onBackToLibrary,
  collapsed,
  onToggleCollapse,
}: ManifestSidebarProps) {
  const [chapterTreeOpen, setChapterTreeOpen] = useState(true);

  // Recently viewed (last 5 by last_viewed_at)
  const recentlyViewed = useMemo(() => {
    return [...items]
      .filter((i) => i.last_viewed_at)
      .sort((a, b) => new Date(b.last_viewed_at!).getTime() - new Date(a.last_viewed_at!).getTime())
      .slice(0, 5);
  }, [items]);

  // Books with extractions (for quick access)
  const extractedBooks = useMemo(() => {
    return items.filter((i) => i.extraction_status === 'completed').slice(0, 10);
  }, [items]);

  if (collapsed) {
    return (
      <div className="manifest-sidebar manifest-sidebar--collapsed">
        <button type="button" className="manifest-sidebar__expand" onClick={onToggleCollapse} title="Expand sidebar">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <nav className="manifest-sidebar">
      <div className="manifest-sidebar__header">
        <button type="button" className="manifest-sidebar__collapse" onClick={onToggleCollapse} title="Collapse sidebar">
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Back to library */}
      <button type="button" className="manifest-sidebar__nav-item manifest-sidebar__nav-item--library" onClick={onBackToLibrary}>
        <Library size={14} /> Library
      </button>

      {/* Current book chapters */}
      {selectedItemId && currentSections && currentSections.length > 0 && (
        <div className="manifest-sidebar__section">
          <button
            type="button"
            className="manifest-sidebar__section-header"
            onClick={() => setChapterTreeOpen((o) => !o)}
          >
            {chapterTreeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Chapters
          </button>
          {chapterTreeOpen && (
            <div className="manifest-sidebar__chapter-list">
              {currentSections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`manifest-sidebar__chapter${currentSectionKey === s.key ? ' manifest-sidebar__chapter--active' : ''}`}
                  onClick={() => {
                    const headers = document.querySelectorAll('.extraction-tab__section-header, .chapter-view__chapter-header');
                    const idx = currentSections.findIndex((cs) => cs.key === s.key);
                    if (headers[idx]) headers[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div className="manifest-sidebar__section">
          <div className="manifest-sidebar__section-label">Recently Viewed</div>
          {recentlyViewed.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`manifest-sidebar__nav-item${selectedItemId === item.id ? ' manifest-sidebar__nav-item--active' : ''}`}
              onClick={() => onSelectItem(item)}
              title={item.title}
            >
              <BookOpen size={12} />
              <span className="manifest-sidebar__item-title">{item.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Extracted Books */}
      {extractedBooks.length > 0 && (
        <div className="manifest-sidebar__section">
          <div className="manifest-sidebar__section-label">Extracted</div>
          {extractedBooks.filter((i) => !recentlyViewed.some((r) => r.id === i.id)).slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`manifest-sidebar__nav-item${selectedItemId === item.id ? ' manifest-sidebar__nav-item--active' : ''}`}
              onClick={() => onSelectItem(item)}
              title={item.title}
            >
              <BookOpen size={12} />
              <span className="manifest-sidebar__item-title">{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
