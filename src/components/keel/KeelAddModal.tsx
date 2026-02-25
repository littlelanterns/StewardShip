import { useState } from 'react';
import { PenLine, MessageSquare, Upload } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { useHelmContext } from '../../contexts/HelmContext';
import type { KeelCategory } from '../../lib/types';
import { KEEL_CATEGORY_LABELS, KEEL_CATEGORY_ORDER } from '../../lib/types';

interface KeelAddModalProps {
  onClose: () => void;
  onCreate: (data: { category: KeelCategory; text: string; source?: string }) => Promise<unknown>;
  preselectedCategory?: KeelCategory | null;
}

export function KeelAddModal({ onClose, onCreate, preselectedCategory }: KeelAddModalProps) {
  const { startGuidedConversation } = useHelmContext();
  const [mode, setMode] = useState<'select' | 'write' | 'file'>(preselectedCategory ? 'write' : 'select');
  const [category, setCategory] = useState<KeelCategory>(preselectedCategory || 'personality_assessment');
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
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
      await onCreate({
        category,
        text: text.trim(),
        source: source.trim() || undefined,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AddEntryModal title="Add to Keel" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Add self-knowledge directly</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('file')}>
            <Upload size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Upload a file</div>
              <div className="add-entry-method__desc">Upload a personality assessment or document</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => { startGuidedConversation('self_discovery'); onClose(); }}>
            <MessageSquare size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Discover at The Helm</div>
              <div className="add-entry-method__desc">Guided self-discovery conversation</div>
            </div>
          </button>
        </div>
      ) : mode === 'file' ? (
        <div className="add-entry-form">
          <button className="add-entry-form__back" onClick={() => setMode('select')}>
            Back to options
          </button>
          <div className="add-entry-file-stub">
            File processing is coming soon. Once available, you'll be able to upload
            personality assessments, test results, and other documents for AI-generated summaries.
          </div>
          <div className="add-entry-form__actions">
            <Button variant="secondary" onClick={() => setMode('select')}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="add-entry-form">
          {!preselectedCategory && (
            <button className="add-entry-form__back" onClick={() => setMode('select')}>
              Back to options
            </button>
          )}
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Category</label>
            <select
              className="add-entry-form__select"
              value={category}
              onChange={(e) => setCategory(e.target.value as KeelCategory)}
            >
              {KEEL_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{KEEL_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Content</label>
            <textarea
              className="add-entry-form__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What do you know about yourself?"
              rows={4}
              autoFocus
            />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Source (optional)</label>
            <input
              className="add-entry-form__input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder='e.g., "Enneagram Type 1", "therapist", "self-observed"'
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
