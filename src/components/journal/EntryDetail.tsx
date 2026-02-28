import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { JournalEntry, JournalEntryType } from '../../lib/types';
import { JOURNAL_ENTRY_TYPE_LABELS, LIFE_AREA_LABELS } from '../../lib/types';
import { Button } from '../shared';
import { TagChips } from '../shared/TagChips';
import { RoutingSelector } from '../shared/RoutingSelector';
import './EntryDetail.css';

interface EntryDetailProps {
  entry: JournalEntry;
  onUpdate: (id: string, updates: { text?: string; entry_type?: JournalEntryType; life_area_tags?: string[] }) => Promise<JournalEntry | null>;
  onArchive: (id: string) => void;
  onRouted: (entryId: string, target: string, referenceId: string) => void;
  onBack: () => void;
}

const QUICK_TYPES: JournalEntryType[] = ['journal_entry', 'gratitude', 'reflection', 'quick_note', 'commonplace', 'kid_quips', 'custom'];

export default function EntryDetail({ entry, onUpdate, onArchive, onRouted, onBack }: EntryDetailProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [editType, setEditType] = useState<JournalEntryType>(entry.entry_type);
  const [tags, setTags] = useState<string[]>(entry.life_area_tags);
  const [showRouting, setShowRouting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onUpdate(entry.id, {
      text: editText.trim(),
      entry_type: editType,
      life_area_tags: tags,
    });
    setEditing(false);
    setSaving(false);
  }, [entry.id, editText, editType, tags, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditText(entry.text);
    setEditType(entry.entry_type);
    setTags(entry.life_area_tags);
    setEditing(false);
  }, [entry]);

  const handleAddTag = useCallback((tag: string) => {
    setTags((prev) => [...prev, tag]);
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleArchive = useCallback(() => {
    onArchive(entry.id);
    onBack();
  }, [entry.id, onArchive, onBack]);

  const date = new Date(entry.created_at);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (showRouting) {
    return (
      <div className="entry-detail">
        <div className="entry-detail__top-bar">
          <button type="button" className="entry-detail__back" onClick={() => setShowRouting(false)} aria-label="Back">
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <span className="entry-detail__top-title">Route Entry</span>
        </div>
        <RoutingSelector
          entryId={entry.id}
          entryText={entry.text}
          onRouted={(target, refId) => {
            onRouted(entry.id, target, refId);
          }}
          onClose={() => setShowRouting(false)}
        />
      </div>
    );
  }

  return (
    <div className="entry-detail">
      <div className="entry-detail__top-bar">
        <button type="button" className="entry-detail__back" onClick={onBack} aria-label="Back to Journal">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="entry-detail__top-title">Entry Detail</span>
      </div>

      {/* Meta info */}
      <div className="entry-detail__meta">
        <span className="entry-detail__date">{formattedDate} at {formattedTime}</span>
        {entry.source !== 'manual_text' && (
          <span className="entry-detail__source">Source: {entry.source.replace(/_/g, ' ')}</span>
        )}
      </div>

      {/* Type badge */}
      {editing ? (
        <div className="entry-detail__type-bar">
          {QUICK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`entry-detail__type-chip ${editType === type ? 'entry-detail__type-chip--active' : ''}`}
              onClick={() => setEditType(type)}
            >
              {JOURNAL_ENTRY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : (
        <span className="entry-detail__type-badge">
          {JOURNAL_ENTRY_TYPE_LABELS[entry.entry_type]}
        </span>
      )}

      {/* Text content */}
      {editing ? (
        <textarea
          className="entry-detail__textarea"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          autoFocus
        />
      ) : (
        <div className="entry-detail__text">{entry.text}</div>
      )}

      {/* Tags */}
      <div className="entry-detail__tags-section">
        <span className="entry-detail__section-label">Life Areas</span>
        <TagChips
          tags={editing ? tags : entry.life_area_tags}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
          readonly={!editing}
        />
      </div>

      {/* Routing indicators */}
      {entry.routed_to.length > 0 && (
        <div className="entry-detail__routed">
          <span className="entry-detail__section-label">Routed to</span>
          <div className="entry-detail__routed-list">
            {entry.routed_to.map((target) => (
              <span key={target} className="entry-detail__routed-chip">
                {LIFE_AREA_LABELS[target] || target.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="entry-detail__actions">
        {editing ? (
          <>
            <Button variant="text" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={!editText.trim() || saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="secondary" onClick={() => setShowRouting(true)}>Route</Button>
            {showArchiveConfirm ? (
              <div className="entry-detail__archive-confirm">
                <span className="entry-detail__archive-text">Archive this entry?</span>
                <Button variant="text" onClick={() => setShowArchiveConfirm(false)}>Cancel</Button>
                <Button variant="text" onClick={handleArchive}>Archive</Button>
              </div>
            ) : (
              <Button variant="text" onClick={() => setShowArchiveConfirm(true)}>Archive</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
