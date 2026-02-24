import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, Button } from '../shared';
import type { CrewNote, CrewNoteCategory } from '../../lib/types';
import { CREW_NOTE_CATEGORY_LABELS, CREW_NOTE_CATEGORY_ORDER } from '../../lib/types';

interface CrewNoteCardProps {
  note: CrewNote;
  onUpdate: (id: string, updates: { text?: string; category?: CrewNoteCategory }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

export function CrewNoteCard({ note, onUpdate, onArchive }: CrewNoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [editCategory, setEditCategory] = useState<CrewNoteCategory>(note.category);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(note.id, { text: editText.trim(), category: editCategory });
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="crew-note-card crew-note-card--editing">
        <select className="crew-note-card__category-select" value={editCategory} onChange={(e) => setEditCategory(e.target.value as CrewNoteCategory)}>
          {CREW_NOTE_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{CREW_NOTE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <textarea className="crew-note-card__textarea" value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
        <div className="crew-note-card__actions">
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="secondary" onClick={() => { setEditing(false); setEditText(note.text); setEditCategory(note.category); }}>Cancel</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="crew-note-card">
      <p className="crew-note-card__text">{note.text}</p>
      <div className="crew-note-card__meta">
        {note.source_label && <span className="crew-note-card__source">Source: {note.source_label}</span>}
        <span className="crew-note-card__date">{new Date(note.created_at).toLocaleDateString()}</span>
      </div>
      <div className="crew-note-card__toolbar">
        <button className="crew-note-card__btn" onClick={() => setEditing(true)} aria-label="Edit"><Pencil size={14} /></button>
        {confirmArchive ? (
          <span className="crew-note-card__confirm">
            Remove? <button onClick={() => onArchive(note.id)}>Yes</button> <button onClick={() => setConfirmArchive(false)}>No</button>
          </span>
        ) : (
          <button className="crew-note-card__btn" onClick={() => setConfirmArchive(true)} aria-label="Archive"><Trash2 size={14} /></button>
        )}
      </div>
    </Card>
  );
}
