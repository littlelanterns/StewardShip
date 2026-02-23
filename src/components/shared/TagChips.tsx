import { useState } from 'react';
import { LIFE_AREA_LABELS } from '../../lib/types';
import './TagChips.css';

const ALL_LIFE_AREAS = Object.keys(LIFE_AREA_LABELS);

interface TagChipsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  readonly?: boolean;
}

export function TagChips({ tags, onAdd, onRemove, readonly }: TagChipsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const availableTags = ALL_LIFE_AREAS.filter((t) => !tags.includes(t));

  return (
    <div className="tag-chips">
      {tags.map((tag) => (
        <span key={tag} className="tag-chips__chip">
          <span className="tag-chips__label">
            {LIFE_AREA_LABELS[tag] || tag}
          </span>
          {!readonly && (
            <button
              type="button"
              className="tag-chips__remove"
              onClick={() => onRemove(tag)}
              aria-label={`Remove ${LIFE_AREA_LABELS[tag] || tag} tag`}
            >
              x
            </button>
          )}
        </span>
      ))}

      {!readonly && (
        <div className="tag-chips__add-wrapper">
          <button
            type="button"
            className="tag-chips__add-btn"
            onClick={() => setShowPicker((o) => !o)}
          >
            + Add Tag
          </button>

          {showPicker && availableTags.length > 0 && (
            <div className="tag-chips__picker">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag-chips__picker-item"
                  onClick={() => {
                    onAdd(tag);
                    setShowPicker(false);
                  }}
                >
                  {LIFE_AREA_LABELS[tag] || tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
