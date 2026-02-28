import { useState, useCallback } from 'react';
import { Check, X, ChevronDown, Pencil } from 'lucide-react';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import type {
  HatchExtractedItem,
  HatchRoutingDestination,
} from '../../lib/types';
import './HatchExtractedCard.css';

const ITEM_TYPE_LABELS: Record<string, string> = {
  action_item: 'Task',
  reflection: 'Reflection',
  revelation: 'Insight',
  value: 'Principle',
  victory: 'Victory',
  trackable: 'Tracker',
  meeting_followup: 'Agenda',
  list_item: 'List Item',
  general: 'Note',
};

interface HatchExtractedCardProps {
  item: HatchExtractedItem;
  onRoute: (itemId: string, destination: HatchRoutingDestination) => void;
  onSkip: (itemId: string) => void;
  onEditText: (itemId: string, newText: string) => void;
  disabled?: boolean;
}

export default function HatchExtractedCard({
  item,
  onRoute,
  onSkip,
  onEditText,
  disabled,
}: HatchExtractedCardProps) {
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.extracted_text);

  const suggestedConfig = HATCH_DESTINATION_CONFIG[item.suggested_destination];
  const typeLabel = ITEM_TYPE_LABELS[item.item_type] || 'Item';

  const handleAcceptSuggestion = useCallback(() => {
    onRoute(item.id, item.suggested_destination);
  }, [item.id, item.suggested_destination, onRoute]);

  const handlePickDestination = useCallback(
    (dest: HatchRoutingDestination) => {
      onRoute(item.id, dest);
      setShowDestPicker(false);
    },
    [item.id, onRoute],
  );

  const handleSaveEdit = useCallback(() => {
    if (editText.trim() !== item.extracted_text) {
      onEditText(item.id, editText.trim());
    }
    setEditing(false);
  }, [item.id, item.extracted_text, editText, onEditText]);

  if (item.status === 'routed') {
    const destConfig =
      HATCH_DESTINATION_CONFIG[
        (item.actual_destination as HatchRoutingDestination) ||
          item.suggested_destination
      ];
    return (
      <div className="hatch-extracted-card hatch-extracted-card--routed">
        <span className="hatch-extracted-card__routed-label">
          Routed to {destConfig?.label || 'destination'}
        </span>
      </div>
    );
  }

  if (item.status === 'skipped') {
    return (
      <div className="hatch-extracted-card hatch-extracted-card--skipped">
        <span className="hatch-extracted-card__skipped-label">Skipped</span>
      </div>
    );
  }

  return (
    <div className="hatch-extracted-card">
      <div className="hatch-extracted-card__header">
        <span className="hatch-extracted-card__type-badge">{typeLabel}</span>
        <span className="hatch-extracted-card__confidence">
          {Math.round(item.confidence * 100)}%
        </span>
      </div>

      <div className="hatch-extracted-card__body">
        {editing ? (
          <div className="hatch-extracted-card__edit">
            <textarea
              className="hatch-extracted-card__edit-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="hatch-extracted-card__edit-actions">
              <button
                type="button"
                className="hatch-extracted-card__edit-save"
                onClick={handleSaveEdit}
              >
                Save
              </button>
              <button
                type="button"
                className="hatch-extracted-card__edit-cancel"
                onClick={() => {
                  setEditText(item.extracted_text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="hatch-extracted-card__text">
            {item.extracted_text}
            <button
              type="button"
              className="hatch-extracted-card__edit-btn"
              onClick={() => setEditing(true)}
              aria-label="Edit text"
            >
              <Pencil size={12} />
            </button>
          </p>
        )}
      </div>

      <div className="hatch-extracted-card__actions">
        <button
          type="button"
          className="hatch-extracted-card__accept"
          onClick={handleAcceptSuggestion}
          disabled={disabled}
          title={`Send to ${suggestedConfig?.label}`}
        >
          <Check size={14} />
          {suggestedConfig?.label || 'Accept'}
        </button>

        <button
          type="button"
          className="hatch-extracted-card__change-dest"
          onClick={() => setShowDestPicker(!showDestPicker)}
          disabled={disabled}
        >
          <ChevronDown size={14} />
        </button>

        <button
          type="button"
          className="hatch-extracted-card__skip"
          onClick={() => onSkip(item.id)}
          disabled={disabled}
          title="Skip this item"
        >
          <X size={14} />
        </button>
      </div>

      {showDestPicker && (
        <div className="hatch-extracted-card__dest-picker">
          {(
            Object.entries(HATCH_DESTINATION_CONFIG) as [
              HatchRoutingDestination,
              (typeof HATCH_DESTINATION_CONFIG)[HatchRoutingDestination],
            ][]
          ).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`hatch-extracted-card__dest-option${key === item.suggested_destination ? ' hatch-extracted-card__dest-option--suggested' : ''}`}
              onClick={() => handlePickDestination(key)}
            >
              {config.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
