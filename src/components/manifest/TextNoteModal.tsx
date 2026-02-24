import { useState, useCallback } from 'react';
import type { ManifestItem } from '../../lib/types';
import { Button } from '../shared';
import './TextNoteModal.css';

interface TextNoteModalProps {
  onSave: (title: string, content: string) => Promise<ManifestItem | null>;
  onClose: () => void;
}

export function TextNoteModal({ onSave, onClose }: TextNoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await onSave(title.trim(), content.trim());
    if (!result) {
      setError('Failed to create note. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
  }, [title, content, onSave, onClose]);

  return (
    <div className="text-note-modal__overlay" onClick={onClose}>
      <div className="text-note-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-note-modal__heading">Add Text Note</h3>

        <div className="text-note-modal__field">
          <label className="text-note-modal__label" htmlFor="note-title">Title</label>
          <input
            id="note-title"
            type="text"
            className="text-note-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            autoFocus
          />
        </div>

        <div className="text-note-modal__field">
          <label className="text-note-modal__label" htmlFor="note-content">Content</label>
          <textarea
            id="note-content"
            className="text-note-modal__textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or type your content..."
            rows={10}
          />
        </div>

        {error && <p className="text-note-modal__error">{error}</p>}

        <div className="text-note-modal__actions">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="text" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
