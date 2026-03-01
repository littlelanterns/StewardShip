import { useState } from 'react';
import { PenLine, ListPlus } from 'lucide-react';
import type { PriorityTier } from '../../lib/types';
import { PRIORITY_TIER_LABELS } from '../../lib/types';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';

const PRIORITY_TIERS: PriorityTier[] = ['committed_now', 'committed_later', 'interested'];

const PRIORITY_BULK_CATEGORIES = PRIORITY_TIERS.map((t) => ({
  value: t,
  label: PRIORITY_TIER_LABELS[t],
}));

const PRIORITY_BULK_PROMPT = `You are parsing text into individual priorities or commitments for a personal growth app. Each item should be a distinct priority, goal, or commitment. Categorize each as one of: "committed_now" (actively working on), "committed_later" (planned for future), or "interested" (exploring, not yet committed). Return a JSON array of objects with "text" and "category" fields.`;

interface AddPriorityModalProps {
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string | null;
    tier?: PriorityTier;
  }) => Promise<unknown>;
  committedNowCount: number;
}

export function AddPriorityModal({ onClose, onSave, committedNowCount }: AddPriorityModalProps) {
  const [mode, setMode] = useState<'select' | 'write' | 'bulk'>('select');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<PriorityTier>('interested');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      tier,
    });
    setSaving(false);
    onClose();
  };

  const handleBulkSave = async (items: ParsedBulkItem[]) => {
    for (const item of items) {
      const itemTier = (item.category as PriorityTier) || 'interested';
      await onSave({
        title: item.text,
        tier: itemTier,
      });
    }
    onClose();
  };

  const tooManyNow = tier === 'committed_now' && committedNowCount >= 7;

  return (
    <AddEntryModal title="Add Priority" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Add a single priority</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('bulk')}>
            <ListPlus size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Bulk Add</div>
              <div className="add-entry-method__desc">Paste multiple priorities at once</div>
            </div>
          </button>
        </div>
      ) : mode === 'bulk' ? (
        <BulkAddWithAISort
          title="Bulk Add Priorities"
          placeholder={"Paste your priorities, commitments, goals...\n\nLearn to play guitar\nFinish home renovation\nRead 12 books this year\nImprove morning routine"}
          categories={PRIORITY_BULK_CATEGORIES}
          parsePrompt={PRIORITY_BULK_PROMPT}
          onSave={handleBulkSave}
          onClose={onClose}
        />
      ) : (
        <div className="add-entry-form">
          <button className="add-entry-form__back" onClick={() => setMode('select')}>
            Back to options
          </button>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Title</label>
            <input
              type="text"
              className="add-entry-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to commit to?"
              autoFocus
            />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Description</label>
            <textarea
              className="add-entry-form__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={3}
            />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Tier</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
              {PRIORITY_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`add-task__recurrence-btn ${tier === t ? 'add-task__recurrence-btn--active' : ''}`}
                  onClick={() => setTier(t)}
                >
                  {PRIORITY_TIER_LABELS[t]}
                </button>
              ))}
            </div>
            {tooManyNow && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-cognac)', marginTop: 'var(--spacing-xs)' }}>
                You already have {committedNowCount} committed now items (recommended max: 7)
              </p>
            )}
          </div>
          <div className="add-entry-form__actions">
            <Button variant="primary" onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </AddEntryModal>
  );
}
