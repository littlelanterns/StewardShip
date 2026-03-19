import { useState, useEffect, useRef, useCallback } from 'react';
import { List, ChevronUp, X } from 'lucide-react';
import './ChapterJumpOverlay.css';

interface ChapterSection {
  key: string;
  title: string;
  itemCount: number;
}

interface ChapterJumpOverlayProps {
  sections: ChapterSection[];
  /** CSS selector for section header elements to observe */
  headerSelector: string;
}

export function ChapterJumpOverlay({ sections, headerSelector }: ChapterJumpOverlayProps) {
  const [open, setOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Only show for 3+ sections
  if (sections.length < 3) return null;

  // Scroll spy via IntersectionObserver
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const headers = document.querySelectorAll(headerSelector);
    if (headers.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible header
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const idx = Array.from(headers).indexOf(topEntry.target as Element);
          if (idx >= 0 && idx < sections.length) {
            setCurrentSection(sections[idx].key);
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );

    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [headerSelector, sections]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleJump = useCallback((index: number) => {
    const headers = document.querySelectorAll(headerSelector);
    if (headers[index]) {
      headers[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setOpen(false);
  }, [headerSelector]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setOpen(false);
  }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        className="chapter-jump__trigger"
        onClick={() => setOpen(true)}
        title="Jump to chapter"
      >
        <List size={20} />
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          <div className="chapter-jump__backdrop" onClick={() => setOpen(false)} />
          <div className="chapter-jump__sheet" ref={sheetRef}>
            <div className="chapter-jump__sheet-header">
              <span className="chapter-jump__sheet-title">Chapters</span>
              <button type="button" className="chapter-jump__close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="chapter-jump__list">
              {sections.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  className={`chapter-jump__item${currentSection === s.key ? ' chapter-jump__item--active' : ''}`}
                  onClick={() => handleJump(i)}
                >
                  <span className="chapter-jump__item-title">{s.title}</span>
                  <span className="chapter-jump__item-count">{s.itemCount}</span>
                </button>
              ))}
            </div>
            <button type="button" className="chapter-jump__back-top" onClick={handleBackToTop}>
              <ChevronUp size={14} /> Back to top
            </button>
          </div>
        </>
      )}
    </>
  );
}
