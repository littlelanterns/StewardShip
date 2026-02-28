import { useCallback, useRef, useState, useEffect } from 'react';
import type { HatchTab } from '../../lib/types';
import './HatchTabContent.css';

interface HatchTabContentProps {
  tab: HatchTab;
  onContentChange: (tabId: string, content: string) => void;
}

export default function HatchTabContent({ tab, onContentChange }: HatchTabContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-focus textarea when tab changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [tab.id]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      onContentChange(tab.id, value);

      // Show subtle "Saved" indicator after content change settles
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setShowSaved(false);
      savedTimer.current = setTimeout(() => {
        setShowSaved(true);
        // Hide after 2 seconds
        setTimeout(() => setShowSaved(false), 2000);
      }, 1000);
    },
    [tab.id, onContentChange],
  );

  return (
    <div className="hatch-tab-content">
      <span
        className={`hatch-tab-content__save-indicator ${showSaved ? 'hatch-tab-content__save-indicator--visible' : ''}`}
      >
        Saved
      </span>
      <textarea
        ref={textareaRef}
        className="hatch-tab-content__textarea"
        value={tab.content}
        onChange={handleChange}
        placeholder="What's on your mind?"
        aria-label="Hatch tab content"
      />
    </div>
  );
}
