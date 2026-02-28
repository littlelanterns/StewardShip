import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { autoTagTask } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
import { useHatchContext } from '../../contexts/HatchContext';
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
  const { regenerateMessage, resendShorter, resendLonger, isThinking, activeConversation } = useHelmContext();
  const { createTab, openHatch } = useHatchContext();
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

  const handleSelectText = () => {
    const messageEl = document.querySelector(
      `[data-message-id="${message.id}"] .message-bubble__text`
    );
    if (messageEl) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(messageEl);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    onClose();
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

  const handleCreateTask = async () => {
    if (!user) return;
    try {
      // Extract title: first line or first ~100 chars
      const firstLine = message.content.split('\n')[0];
      const title = firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine;
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('compass_tasks')
        .insert({
          user_id: user.id,
          title,
          source: 'helm_conversation',
          source_reference_id: message.conversation_id,
          due_date: today,
          status: 'pending',
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger auto-tag in background
      autoTagTask(title, null, user.id).then((tag) => {
        if (tag && data) {
          supabase
            .from('compass_tasks')
            .update({ life_area_tag: tag })
            .eq('id', data.id)
            .eq('user_id', user.id)
            .then(() => {});
        }
      });

      showToast('Task created in Compass');
    } catch {
      showToast('Failed to create task');
    }
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
  const isCyranoMode = activeConversation?.guided_mode === 'first_mate_action'
    && activeConversation?.guided_subtype === 'cyrano';

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(message.content);
    showToast('Draft copied');
  };

  const handleEditInHatch = async () => {
    try {
      await createTab('helm_edit', message.content, message.conversation_id);
      openHatch();
      showToast('Opened in Hatch');
    } catch {
      showToast('Failed to open');
    }
  };

  const handleSaveDraft = async () => {
    if (!user || !activeConversation?.guided_mode_reference_id) return;
    try {
      const { error } = await supabase
        .from('cyrano_messages')
        .insert({
          user_id: user.id,
          people_id: activeConversation.guided_mode_reference_id,
          raw_input: message.content,
          crafted_version: message.content,
          status: 'draft',
          helm_conversation_id: activeConversation.id,
        });

      if (error) throw error;
      showToast('Draft saved');
    } catch {
      showToast('Failed to save draft');
    }
  };

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
          <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleSelectText}>
            Select text
          </button>
          <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleSaveToLog}>
            Save to Log
          </button>
          <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleCreateTask}>
            Create task
          </button>
          <button type="button" className="message-context-menu__item" role="menuitem" onClick={handleEditInHatch}>
            Edit in Hatch
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
          {isCyranoMode && isAiMessage && (
            <>
              <div className="message-context-menu__divider" />
              <button
                type="button"
                className="message-context-menu__item"
                role="menuitem"
                onClick={handleCopyDraft}
              >
                Copy draft
              </button>
              <button
                type="button"
                className="message-context-menu__item"
                role="menuitem"
                onClick={handleSaveDraft}
              >
                Save draft
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
