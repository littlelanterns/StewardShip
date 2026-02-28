import { useCallback, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { HatchTab } from '../../lib/types';
import './HatchTabBar.css';

interface HatchTabBarProps {
  tabs: HatchTab[];
  activeTabId: string | null;
  onSelectTab: (id: string | null) => void;
  onCloseTab: (id: string) => Promise<void>;
  onNewTab: () => void;
  onRenameTab: (id: string, title: string) => Promise<void>;
}

export default function HatchTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onRenameTab,
}: HatchTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const editRef = useRef<HTMLSpanElement>(null);

  const handleDoubleClick = useCallback((tabId: string) => {
    setEditingTabId(tabId);
    // Focus will happen on next render via ref
    requestAnimationFrame(() => {
      if (editRef.current) {
        editRef.current.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, []);

  const handleBlur = useCallback(
    (tabId: string) => {
      if (editRef.current) {
        const newTitle = editRef.current.textContent?.trim();
        if (newTitle && newTitle.length > 0) {
          onRenameTab(tabId, newTitle);
        }
      }
      setEditingTabId(null);
    },
    [onRenameTab],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBlur(tabId);
      } else if (e.key === 'Escape') {
        setEditingTabId(null);
      }
    },
    [handleBlur],
  );

  return (
    <div className="hatch-tab-bar" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`hatch-tab-bar__tab ${activeTabId === tab.id ? 'hatch-tab-bar__tab--active' : ''}`}
          role="tab"
          aria-selected={activeTabId === tab.id}
          onClick={() => onSelectTab(tab.id)}
        >
          {editingTabId === tab.id ? (
            <span
              ref={editRef}
              className="hatch-tab-bar__tab-title hatch-tab-bar__tab-title--editing"
              contentEditable
              suppressContentEditableWarning
              onBlur={() => handleBlur(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              {tab.title}
            </span>
          ) : (
            <span
              className="hatch-tab-bar__tab-title"
              onDoubleClick={() => handleDoubleClick(tab.id)}
              title={tab.title}
            >
              {tab.title}
            </span>
          )}
          <button
            type="button"
            className="hatch-tab-bar__tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            aria-label={`Close ${tab.title}`}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}

      {tabs.length >= 10 && (
        <span className="hatch-tab-bar__warning">10 tabs</span>
      )}

      <button
        type="button"
        className="hatch-tab-bar__new"
        onClick={onNewTab}
        aria-label="New tab"
        title="New tab"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
