import { useState } from 'react';
import { GripVertical, Pencil } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import './EntryCard.css';

interface EntryCardProps {
  id: string;
  text: string;
  badges: { label: string; value: string }[];
  /** Extra fields rendered in edit mode (e.g., category dropdown, source input) */
  editFields?: React.ReactNode;
  /** Current values for editable fields */
  editText: string;
  onSave: (text: string) => Promise<void>;
  onArchive: () => void;
  onEditTextChange: (text: string) => void;
  /** Called when entering/exiting edit mode */
  onEditModeChange?: (editing: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: {
    attributes: any;
    listeners: any;
  };
  isDragging?: boolean;
  className?: string;
}

export function EntryCard({
  text,
  badges,
  editFields,
  editText,
  onSave,
  onArchive,
  onEditTextChange,
  onEditModeChange,
  dragHandleProps,
  isDragging = false,
  className = '',
}: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const isLong = text.length > 200;
  const showTruncated = isLong && !expanded && !editing;

  function startEdit() {
    setEditing(true);
    setExpanded(true);
    setError(null);
    onEditModeChange?.(true);
  }

  function cancelEdit() {
    setEditing(false);
    setConfirmArchive(false);
    setError(null);
    onEditTextChange(text);
    onEditModeChange?.(false);
  }

  async function handleSave() {
    if (!editText.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(editText);
      setEditing(false);
      onEditModeChange?.(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleArchiveClick() {
    if (confirmArchive) {
      onArchive();
      setConfirmArchive(false);
      setEditing(false);
      onEditModeChange?.(false);
    } else {
      setConfirmArchive(true);
    }
  }

  return (
    <Card className={`entry-card ${isDragging ? 'entry-card--dragging' : ''} ${className}`.trim()}>
      {editing ? (
        <div className="entry-card__edit-form">
          <div className="entry-card__field-group">
            <label className="entry-card__field-label">Content</label>
            <textarea
              className="entry-card__textarea"
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>
          {editFields}
          {error && <p className="entry-card__error">{error}</p>}
          <div className="entry-card__edit-actions">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <button
              className="entry-card__archive-btn"
              onClick={handleArchiveClick}
              disabled={saving}
            >
              {confirmArchive ? 'Confirm archive?' : 'Archive'}
            </button>
          </div>
        </div>
      ) : (
        <div className="entry-card__view">
          <button
            className="entry-card__drag-handle"
            aria-label="Drag to reorder"
            {...(dragHandleProps?.attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            {...(dragHandleProps?.listeners as React.DOMAttributes<HTMLButtonElement>)}
          >
            <GripVertical size={18} />
          </button>
          <div className="entry-card__body">
            <p className={`entry-card__text ${showTruncated ? 'entry-card__text--truncated' : ''}`}>
              {text}
            </p>
            {isLong && !editing && (
              <button
                className="entry-card__toggle-text"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
            {badges.length > 0 && (
              <div className="entry-card__meta">
                {badges.map((badge) => (
                  <span key={badge.label} className="entry-card__badge" title={badge.label}>
                    {badge.value}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="entry-card__actions">
            <button
              className="entry-card__edit-btn"
              onClick={startEdit}
              aria-label="Edit entry"
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
