import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './CompletionNotePrompt.css';

interface CompletionNotePromptProps {
  taskId: string;
  taskTitle: string;
  onSave: (taskId: string, note: string) => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 8000;

export function CompletionNotePrompt({ taskId, taskTitle, onSave, onDismiss }: CompletionNotePromptProps) {
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const handleExpand = () => {
    setExpanded(true);
    // Pause auto-dismiss when user engages
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = () => {
    if (note.trim()) {
      onSave(taskId, note.trim());
    }
    onDismiss();
  };

  return (
    <div className="completion-note-prompt">
      <div className="completion-note-prompt__content">
        <div className="completion-note-prompt__header">
          <p className="completion-note-prompt__task">{taskTitle}</p>
          <button
            type="button"
            className="completion-note-prompt__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {!expanded ? (
          <button
            type="button"
            className="completion-note-prompt__expand-btn"
            onClick={handleExpand}
          >
            Add a note?
          </button>
        ) : (
          <div className="completion-note-prompt__input-area">
            <textarea
              ref={inputRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How did it go? What did you learn?"
              rows={2}
              className="completion-note-prompt__textarea"
            />
            <button
              type="button"
              className="completion-note-prompt__save-btn"
              onClick={handleSave}
              disabled={!note.trim()}
            >
              Save Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
