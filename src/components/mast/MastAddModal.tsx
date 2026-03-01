import { useState } from 'react';
import { PenLine, MessageSquare, ListPlus } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';
import { useHelmContext } from '../../contexts/HelmContext';
import type { MastEntryType } from '../../lib/types';
import { MAST_TYPE_LABELS, MAST_TYPE_ORDER } from '../../lib/types';

const MAST_BULK_CATEGORIES = MAST_TYPE_ORDER.map((t) => ({ value: t, label: MAST_TYPE_LABELS[t] }));

const MAST_BULK_PROMPT = `You are parsing text into guiding principles for a personal growth app. Each item should be categorized as one of: "value" (core values), "declaration" (commitment statements about who the user is choosing to become), "faith_foundation" (faith or spiritual beliefs), "scripture_quote" (scriptures, quotes, or sayings), or "vision" (vision statements about the future). Extract individual principles from the input. Return a JSON array of objects with "text" and "category" fields.`;

interface MastAddModalProps {
  onClose: () => void;
  onCreate: (data: { type: MastEntryType; text: string; category?: string }) => Promise<unknown>;
  preselectedType?: MastEntryType | null;
}

export function MastAddModal({ onClose, onCreate, preselectedType }: MastAddModalProps) {
  const { startGuidedConversation } = useHelmContext();
  const [mode, setMode] = useState<'select' | 'write' | 'bulk'>(preselectedType ? 'write' : 'select');
  const [type, setType] = useState<MastEntryType>(preselectedType || 'value');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBulkSave = async (items: ParsedBulkItem[]) => {
    for (const item of items) {
      await onCreate({
        type: (item.category as MastEntryType) || 'value',
        text: item.text,
      });
    }
  };

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
          <button className="add-entry-method" onClick={() => { startGuidedConversation('declaration'); onClose(); }}>
            <MessageSquare size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Craft it at The Helm</div>
              <div className="add-entry-method__desc">Guided conversation to articulate your principle</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('bulk')}>
            <ListPlus size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Bulk Add</div>
              <div className="add-entry-method__desc">Paste multiple principles at once</div>
            </div>
          </button>
        </div>
      ) : mode === 'bulk' ? (
        <BulkAddWithAISort
          title="Bulk Add Principles"
          placeholder={"Paste principles, beliefs, vision statements...\n\nI choose to lead with patience.\nFamily is my highest priority.\n\"Trust in the Lord with all thine heart\" - Proverbs 3:5"}
          categories={MAST_BULK_CATEGORIES}
          parsePrompt={MAST_BULK_PROMPT}
          onSave={handleBulkSave}
          onClose={onClose}
        />
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
