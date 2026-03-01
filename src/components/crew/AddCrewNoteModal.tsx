import { useState } from 'react';
import { PenLine, ListPlus } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';
import type { CrewNoteCategory } from '../../lib/types';
import { CREW_NOTE_CATEGORY_LABELS, CREW_NOTE_CATEGORY_ORDER } from '../../lib/types';

const CREW_NOTE_BULK_CATEGORIES = CREW_NOTE_CATEGORY_ORDER.map((c) => ({ value: c, label: CREW_NOTE_CATEGORY_LABELS[c] }));

const CREW_NOTE_BULK_PROMPT = `You are parsing text into notes about a specific person for a personal growth app. Each item should be categorized as one of: "personality" (personality traits), "interests" (hobbies and interests), "challenges" (challenges they face), "growth" (areas they are growing in), "observations" (things observed about them), or "general" (other). Extract individual observations from the input. Return a JSON array of objects with "text" and "category" fields.`;

interface AddCrewNoteModalProps {
  onClose: () => void;
  onSave: (data: { text: string; category: CrewNoteCategory }) => Promise<unknown>;
  preselectedCategory?: CrewNoteCategory;
}

export function AddCrewNoteModal({ onClose, onSave, preselectedCategory }: AddCrewNoteModalProps) {
  const [mode, setMode] = useState<'select' | 'write' | 'bulk'>('select');
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

  const handleBulkSave = async (items: ParsedBulkItem[]) => {
    for (const item of items) {
      await onSave({
        text: item.text,
        category: (item.category as CrewNoteCategory) || 'general',
      });
    }
  };

  return (
    <AddEntryModal title="Add Note" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Add a single observation</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('bulk')}>
            <ListPlus size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Bulk Add</div>
              <div className="add-entry-method__desc">Paste multiple observations at once</div>
            </div>
          </button>
        </div>
      ) : mode === 'bulk' ? (
        <BulkAddWithAISort
          title="Bulk Add Notes"
          placeholder={"Paste observations about this person...\n\nLoves building with Lego\nStruggles with transitions between activities\nVery empathetic and caring with younger kids\nLearning to read chapter books"}
          categories={CREW_NOTE_BULK_CATEGORIES}
          parsePrompt={CREW_NOTE_BULK_PROMPT}
          onSave={handleBulkSave}
          onClose={onClose}
        />
      ) : (
        <div className="add-entry-form">
          <button className="add-entry-form__back" onClick={() => setMode('select')}>
            Back to options
          </button>
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
      )}
    </AddEntryModal>
  );
}
