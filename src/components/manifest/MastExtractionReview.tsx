import { useState, useCallback } from 'react';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import type { MastEntryType } from '../../lib/types';
import { MAST_TYPE_LABELS } from '../../lib/types';
import './ExtractionReview.css';

interface MastExtractionEntry {
  text: string;
  entry_type: string;
  selected: boolean;
}

interface MastExtractionReviewProps {
  sourceTitle: string;
  entries: Array<{ text: string; entry_type: string }> | null;
  extracting: boolean;
  onSave: (entries: Array<{ type: MastEntryType; text: string; source: 'manifest_extraction' }>) => Promise<void>;
  onCancel: () => void;
}

const VALID_MAST_TYPES: MastEntryType[] = ['value', 'declaration', 'faith_foundation', 'scripture_quote', 'vision'];

export default function MastExtractionReview({
  sourceTitle,
  entries,
  extracting,
  onSave,
  onCancel,
}: MastExtractionReviewProps) {
  const [editableEntries, setEditableEntries] = useState<MastExtractionEntry[]>(
    () => (entries || []).map((e) => ({
      text: e.text,
      entry_type: VALID_MAST_TYPES.includes(e.entry_type as MastEntryType) ? e.entry_type : 'value',
      selected: true,
    })),
  );
  const [saving, setSaving] = useState(false);

  const toggleEntry = useCallback((index: number) => {
    setEditableEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  }, []);

  const updateText = useCallback((index: number, text: string) => {
    setEditableEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  }, []);

  const updateType = useCallback((index: number, entry_type: string) => {
    setEditableEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], entry_type };
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const selected = editableEntries
        .filter((e) => e.selected && e.text.trim())
        .map((e) => ({
          type: e.entry_type as MastEntryType,
          text: e.text.trim(),
          source: 'manifest_extraction' as const,
        }));
      await onSave(selected);
    } finally {
      setSaving(false);
    }
  }, [editableEntries, onSave]);

  if (extracting) {
    return (
      <div className="extraction-review">
        <div className="extraction-review__loading">
          <LoadingSpinner />
          <p>Analyzing content for Mast principles...</p>
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="extraction-review">
        <div className="extraction-review__empty">
          <p>No potential Mast entries found in this content.</p>
          <Button onClick={onCancel} variant="secondary">Close</Button>
        </div>
      </div>
    );
  }

  const selectedCount = editableEntries.filter((e) => e.selected).length;

  return (
    <div className="extraction-review">
      <h3 className="extraction-review__heading">Suggested Mast Entries</h3>
      <p className="extraction-review__subtitle">From: {sourceTitle}</p>
      <p className="extraction-review__desc">
        Select the principles you want to add to your Mast. You can edit the text and change the type before saving.
      </p>

      <div className="extraction-review__list">
        {editableEntries.map((entry, index) => (
          <div
            key={index}
            className={`extraction-review__item ${entry.selected ? 'extraction-review__item--selected' : ''}`}
          >
            <label className="extraction-review__checkbox-label">
              <input
                type="checkbox"
                checked={entry.selected}
                onChange={() => toggleEntry(index)}
                className="extraction-review__checkbox"
              />
            </label>
            <div className="extraction-review__item-content">
              <select
                className="extraction-review__type-select"
                value={entry.entry_type}
                onChange={(e) => updateType(index, e.target.value)}
              >
                {VALID_MAST_TYPES.map((t) => (
                  <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <textarea
                className="extraction-review__text"
                value={entry.text}
                onChange={(e) => updateText(index, e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="extraction-review__actions">
        <Button onClick={onCancel} variant="secondary">Skip</Button>
        <Button
          onClick={handleSave}
          variant="primary"
          disabled={saving || selectedCount === 0}
        >
          {saving ? 'Adding...' : `Add ${selectedCount} to Mast`}
        </Button>
      </div>
    </div>
  );
}
