import { useState } from 'react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import type { CrewNoteCategory } from '../../lib/types';
import { CREW_NOTE_CATEGORY_LABELS, CREW_NOTE_CATEGORY_ORDER } from '../../lib/types';

interface AddCrewNoteModalProps {
  onClose: () => void;
  onSave: (data: { text: string; category: CrewNoteCategory }) => Promise<unknown>;
  preselectedCategory?: CrewNoteCategory;
}

export function AddCrewNoteModal({ onClose, onSave, preselectedCategory }: AddCrewNoteModalProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<CrewNoteCategory>(preselectedCategory || 'general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!text.trim()) { setError('Content cannot be empty.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ text: text.trim(), category });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AddEntryModal title="Add Note" onClose={onClose}>
      <div className="add-entry-form">
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Category</label>
          <select className="add-entry-form__select" value={category} onChange={(e) => setCategory(e.target.value as CrewNoteCategory)}>
            {CREW_NOTE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CREW_NOTE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Note</label>
          <textarea className="add-entry-form__textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What have you observed or learned?" rows={4} autoFocus />
        </div>
        {error && <p className="add-entry-form__error">{error}</p>}
        <div className="add-entry-form__actions">
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </div>
    </AddEntryModal>
  );
}
