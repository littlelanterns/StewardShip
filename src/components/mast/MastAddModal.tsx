import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, MessageSquare } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import type { MastEntryType } from '../../lib/types';
import { MAST_TYPE_LABELS, MAST_TYPE_ORDER } from '../../lib/types';

interface MastAddModalProps {
  onClose: () => void;
  onCreate: (data: { type: MastEntryType; text: string; category?: string }) => Promise<unknown>;
  preselectedType?: MastEntryType | null;
}

export function MastAddModal({ onClose, onCreate, preselectedType }: MastAddModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'select' | 'write'>(preselectedType ? 'write' : 'select');
  const [type, setType] = useState<MastEntryType>(preselectedType || 'value');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!text.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ type, text: text.trim(), category: category.trim() || undefined });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AddEntryModal title="Add Principle" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Type your principle directly</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => navigate('/helm')}>
            <MessageSquare size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Craft it at The Helm</div>
              <div className="add-entry-method__desc">Guided conversation to articulate your principle</div>
            </div>
          </button>
        </div>
      ) : (
        <div className="add-entry-form">
          {!preselectedType && (
            <button className="add-entry-form__back" onClick={() => setMode('select')}>
              Back to options
            </button>
          )}
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Type</label>
            <select
              className="add-entry-form__select"
              value={type}
              onChange={(e) => setType(e.target.value as MastEntryType)}
            >
              {MAST_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Content</label>
            <textarea
              className="add-entry-form__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your principle..."
              rows={4}
              autoFocus
            />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Category (optional)</label>
            <input
              className="add-entry-form__input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder='e.g., "Marriage", "Work", "Faith"'
            />
          </div>
          {error && <p className="add-entry-form__error">{error}</p>}
          <div className="add-entry-form__actions">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </AddEntryModal>
  );
}
