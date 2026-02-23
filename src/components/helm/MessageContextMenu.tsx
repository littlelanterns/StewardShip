import { useEffect, useRef } from 'react';
import type { HelmMessage } from '../../lib/types';
import './MessageContextMenu.css';

interface MessageContextMenuProps {
  message: HelmMessage;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function MessageContextMenu({
  message,
  position,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [position]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    onClose();
  };

  const handleSaveToLog = () => {
    // Stub — will wire to Log in a later phase
    onClose();
  };

  const handleCreateTask = () => {
    // Stub — will wire to Compass in a later phase
    onClose();
  };

  const isAiMessage = message.role === 'assistant';

  return (
    <div
      ref={menuRef}
      className="message-context-menu"
      style={{ top: position.y, left: position.x }}
      role="menu"
    >
      <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleCopy}>
        Copy text
      </button>
      <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleSaveToLog}>
        Save to Log
      </button>
      <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleCreateTask}>
        Create task
      </button>
      {isAiMessage && (
        <>
          <div className="message-context-menu__divider" />
          <button
            type="button"
            className="message-context-menu__item message-context-menu__item--disabled"
            role="menuitem"
            disabled
          >
            Regenerate
          </button>
          <button
            type="button"
            className="message-context-menu__item message-context-menu__item--disabled"
            role="menuitem"
            disabled
          >
            Shorter / Longer
          </button>
        </>
      )}
    </div>
  );
}
