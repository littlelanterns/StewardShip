import { useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { Paperclip } from 'lucide-react';
import type { HelmMessage } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { SLL_DISTINCTIONS } from '../../lib/sllDefinitions';
import MessageContextMenu from './MessageContextMenu';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: HelmMessage;
}

const SLL_MARKER_REGEX = /\[\[sll:(\w+)\]\]/g;

function SLLTerm({ sllKey }: { sllKey: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const distinction = SLL_DISTINCTIONS[sllKey];

  if (!distinction) return <span>{sllKey}</span>;

  return (
    <span className="sll-term" onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}>
      <span className="sll-term__text">{distinction.term}</span>
      {showTooltip && (
        <span className="sll-term__tooltip" onClick={(e) => e.stopPropagation()}>
          <span className="sll-term__tooltip-contrast">{distinction.contrast}</span>
          <span className="sll-term__tooltip-liner">{distinction.oneLiner}</span>
        </span>
      )}
    </span>
  );
}

function renderMessageContent(content: string): ReactNode {
  // Check if content has SLL markers
  if (!SLL_MARKER_REGEX.test(content)) {
    return content;
  }

  // Reset regex lastIndex
  SLL_MARKER_REGEX.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SLL_MARKER_REGEX.exec(content)) !== null) {
    // Add text before the marker
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Add the SLL term component
    parts.push(<SLLTerm key={`sll-${match.index}`} sllKey={match[1]} />);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser = message.role === 'user';

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: touch.clientX, y: touch.clientY });
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Build attachment preview URL if the message has a file
  const attachmentUrl = useMemo(() => {
    if (!message.file_storage_path) return null;
    const isImage = message.file_type?.startsWith('image/');
    if (!isImage) return null;
    const { data } = supabase.storage
      .from('helm-attachments')
      .getPublicUrl(message.file_storage_path);
    return data?.publicUrl || null;
  }, [message.file_storage_path, message.file_type]);

  const fileName = message.file_storage_path
    ? message.file_storage_path.split('/').pop()?.replace(/^\d+_[a-z0-9]+\./, '') || 'file'
    : null;

  // Don't render system messages as bubbles
  if (message.role === 'system') return null;

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Parse SLL markers only for assistant messages
  const renderedContent = !isUser ? renderMessageContent(message.content) : message.content;

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`} data-message-id={message.id}>
      <div
        className="message-bubble__content"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {message.file_storage_path && (
          <div className="message-bubble__attachment">
            {attachmentUrl ? (
              <img src={attachmentUrl} alt="Attachment" className="message-bubble__attachment-img" />
            ) : (
              <span className="message-bubble__attachment-file">
                <Paperclip size={14} /> {fileName}
              </span>
            )}
          </div>
        )}
        <p className="message-bubble__text">{renderedContent}</p>
        <span className="message-bubble__time">{time}</span>
      </div>

      {contextMenu && (
        <MessageContextMenu
          message={message}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
