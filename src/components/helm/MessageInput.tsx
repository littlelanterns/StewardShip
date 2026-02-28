import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { VoiceRecordButton } from '../shared/VoiceRecordButton';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import './MessageInput.css';

const ACCEPTED_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface AttachedFile {
  file: File;
  previewUrl?: string;
}

interface MessageInputProps {
  onSend: (content: string, attachment?: { storagePath: string; fileType: string; fileName: string }) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const { user } = useAuthContext();
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || disabled || uploading) return;

    if (attachment) {
      // Upload file to Supabase Storage first
      setUploading(true);
      try {
        const ext = attachment.file.name.split('.').pop()?.toLowerCase() || 'bin';
        const storagePath = `${user?.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('helm-attachments')
          .upload(storagePath, attachment.file, {
            contentType: attachment.file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const messageText = trimmed || `[Attached: ${attachment.file.name}]`;
        onSend(messageText, {
          storagePath,
          fileType: attachment.file.type,
          fileName: attachment.file.name,
        });
      } catch (err) {
        console.error('File upload failed:', err);
        // Send without attachment on failure
        if (trimmed) onSend(trimmed);
      } finally {
        setUploading(false);
        clearAttachment();
      }
    } else {
      onSend(trimmed);
    }

    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, disabled, uploading, onSend, attachment, user?.id]);

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

  const handleTranscription = useCallback((transcribedText: string) => {
    setText(prev => {
      const separator = prev.trim() ? ' ' : '';
      return prev + separator + transcribedText;
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
      }, 0);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, previewUrl });

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }, []);

  const clearAttachment = useCallback(() => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
  }, [attachment]);

  const canSend = (text.trim().length > 0 || attachment !== null) && !disabled && !uploading;

  return (
    <div className="message-input-wrapper">
      {attachment && (
        <div className="message-input__attachment-preview">
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="Preview" className="message-input__attachment-thumb" />
          ) : (
            <span className="message-input__attachment-name">{attachment.file.name}</span>
          )}
          <button
            type="button"
            className="message-input__attachment-remove"
            onClick={clearAttachment}
            aria-label="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="message-input">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
        />
        <button
          type="button"
          className="message-input__icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="Attach file"
          aria-label="Attach file"
        >
          <Paperclip size={20} strokeWidth={1.5} />
        </button>

        <textarea
          ref={textareaRef}
          className="message-input__field"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading...' : 'Ask the Helm...'}
          rows={1}
          disabled={disabled || uploading}
        />

        <VoiceRecordButton
          onTranscription={handleTranscription}
          disabled={disabled || uploading}
          compact
        />

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
    </div>
  );
}
