import { useState, useCallback } from 'react';
import { Button, LoadingSpinner } from '../shared';
import type { KeelCategory } from '../../lib/types';
import { KEEL_CATEGORY_LABELS } from '../../lib/types';
import './ExtractionReview.css';

interface KeelExtractionEntry {
  category: string;
  text: string;
  selected: boolean;
}

interface KeelExtractionReviewProps {
  sourceTitle: string;
  entries: Array<{ category: string; text: string }> | null;
  extracting: boolean;
  onSave: (entries: Array<{ category: KeelCategory; text: string; source: string; source_type: 'manifest_extraction' }>) => Promise<void>;
  onCancel: () => void;
}

const VALID_KEEL_CATEGORIES: KeelCategory[] = [
  'personality_assessment', 'trait_tendency', 'strength', 'growth_area', 'you_inc', 'general',
];

export default function KeelExtractionReview({
  sourceTitle,
  entries,
  extracting,
  onSave,
  onCancel,
}: KeelExtractionReviewProps) {
  const [editableEntries, setEditableEntries] = useState<KeelExtractionEntry[]>(
    () => (entries || []).map((e) => ({
      category: VALID_KEEL_CATEGORIES.includes(e.category as KeelCategory) ? e.category : 'general',
      text: e.text,
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

  const updateCategory = useCallback((index: number, category: string) => {
    setEditableEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], category };
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const selected = editableEntries
        .filter((e) => e.selected && e.text.trim())
        .map((e) => ({
          category: e.category as KeelCategory,
          text: e.text.trim(),
          source: sourceTitle,
          source_type: 'manifest_extraction' as const,
        }));
      await onSave(selected);
    } finally {
      setSaving(false);
    }
  }, [editableEntries, sourceTitle, onSave]);

  if (extracting) {
    return (
      <div className="extraction-review">
        <div className="extraction-review__loading">
          <LoadingSpinner />
          <p>Analyzing content for self-knowledge insights...</p>
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="extraction-review">
        <div className="extraction-review__empty">
          <p>No personality or self-knowledge data found in this content.</p>
          <Button onClick={onCancel} variant="secondary">Close</Button>
        </div>
      </div>
    );
  }

  const selectedCount = editableEntries.filter((e) => e.selected).length;

  return (
    <div className="extraction-review">
      <h3 className="extraction-review__heading">Suggested Keel Entries</h3>
      <p className="extraction-review__subtitle">From: {sourceTitle}</p>
      <p className="extraction-review__desc">
        Select the self-knowledge insights you want to add to your Keel. You can edit text and change categories before saving.
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
                value={entry.category}
                onChange={(e) => updateCategory(index, e.target.value)}
              >
                {VALID_KEEL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{KEEL_CATEGORY_LABELS[c]}</option>
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
          {saving ? 'Adding...' : `Add ${selectedCount} to Keel`}
        </Button>
      </div>
    </div>
  );
}
