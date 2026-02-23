import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
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
  const { user } = useAuthContext();
  const { regenerateMessage, resendShorter, resendLonger, isThinking } = useHelmContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    showToast('Copied');
  };

  const handleSaveToLog = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('log_entries')
        .insert({
          user_id: user.id,
          text: message.content,
          entry_type: 'helm_conversation',
          source: 'helm_conversation',
          source_reference_id: message.conversation_id,
        });

      if (error) throw error;
      showToast('Saved to Log');
    } catch {
      showToast('Failed to save');
    }
  };

  const handleCreateTask = () => {
    // Stub — will wire to Compass in a later phase
    showToast('Task creation coming in Compass phase');
  };

  const handleRegenerate = () => {
    onClose();
    regenerateMessage(message);
  };

  const handleShorter = () => {
    onClose();
    resendShorter(message);
  };

  const handleLonger = () => {
    onClose();
    resendLonger(message);
  };

  const isAiMessage = message.role === 'assistant';

  return (
    <div
      ref={menuRef}
      className="message-context-menu"
      style={{ top: position.y, left: position.x }}
      role="menu"
    >
      {toast ? (
        <div className="message-context-menu__toast">{toast}</div>
      ) : (
        <>
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
                className="message-context-menu__item"
                role="menuitem"
                onClick={handleRegenerate}
                disabled={isThinking}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="message-context-menu__item"
                role="menuitem"
                onClick={handleShorter}
                disabled={isThinking}
              >
                Shorter
              </button>
              <button
                type="button"
                className="message-context-menu__item"
                role="menuitem"
                onClick={handleLonger}
                disabled={isThinking}
              >
                Longer
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
