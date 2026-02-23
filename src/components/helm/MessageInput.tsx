import { useState, useRef, useCallback } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="message-input">
      <button
        type="button"
        className="message-input__icon-btn"
        disabled
        title="Attachments coming soon"
        aria-label="Attach file (coming soon)"
      >
        <Paperclip size={20} strokeWidth={1.5} />
      </button>

      <textarea
        ref={textareaRef}
        className="message-input__field"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask the Helm..."
        rows={1}
        disabled={disabled}
      />

      <button
        type="button"
        className="message-input__icon-btn"
        disabled
        title="Voice input coming soon"
        aria-label="Voice input (coming soon)"
      >
        <Mic size={20} strokeWidth={1.5} />
      </button>

      <button
        type="button"
        className={`message-input__send-btn ${canSend ? 'message-input__send-btn--active' : ''}`}
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
      >
        <Send size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}
