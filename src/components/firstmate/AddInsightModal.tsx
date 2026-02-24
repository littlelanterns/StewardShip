import { useState } from 'react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import type { SpouseInsightCategory } from '../../lib/types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS, SPOUSE_INSIGHT_CATEGORY_ORDER } from '../../lib/types';

interface AddInsightModalProps {
  onClose: () => void;
  onSave: (data: { text: string; category: SpouseInsightCategory }) => Promise<unknown>;
  preselectedCategory?: SpouseInsightCategory;
}

export function AddInsightModal({ onClose, onSave, preselectedCategory }: AddInsightModalProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<SpouseInsightCategory>(preselectedCategory || 'general');
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
    <AddEntryModal title="Add Insight" onClose={onClose}>
      <div className="add-entry-form">
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Category</label>
          <select className="add-entry-form__select" value={category} onChange={(e) => setCategory(e.target.value as SpouseInsightCategory)}>
            {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Insight</label>
          <textarea className="add-entry-form__textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What have you learned about them?" rows={4} autoFocus />
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
