import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, Button } from '../shared';
import type { SpouseInsight, SpouseInsightCategory } from '../../lib/types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS, SPOUSE_INSIGHT_CATEGORY_ORDER } from '../../lib/types';

interface InsightCardProps {
  insight: SpouseInsight;
  onUpdate: (id: string, updates: { text?: string; category?: SpouseInsightCategory }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

export function InsightCard({ insight, onUpdate, onArchive }: InsightCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(insight.text);
  const [editCategory, setEditCategory] = useState<SpouseInsightCategory>(insight.category);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(insight.id, { text: editText.trim(), category: editCategory });
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="insight-card insight-card--editing">
        <select
          className="insight-card__category-select"
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value as SpouseInsightCategory)}
        >
          {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <textarea
          className="insight-card__textarea"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={3}
        />
        <div className="insight-card__actions">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => { setEditing(false); setEditText(insight.text); setEditCategory(insight.category); }}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="insight-card">
      <p className="insight-card__text">{insight.text}</p>
      <div className="insight-card__meta">
        {insight.source_label && (
          <span className="insight-card__source">Source: {insight.source_label}</span>
        )}
        <span className="insight-card__date">
          {new Date(insight.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="insight-card__toolbar">
        <button className="insight-card__btn" onClick={() => setEditing(true)} aria-label="Edit">
          <Pencil size={14} />
        </button>
        {confirmArchive ? (
          <span className="insight-card__confirm">
            Remove? <button onClick={() => onArchive(insight.id)}>Yes</button>{' '}
            <button onClick={() => setConfirmArchive(false)}>No</button>
          </span>
        ) : (
          <button className="insight-card__btn" onClick={() => setConfirmArchive(true)} aria-label="Archive">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </Card>
  );
}
