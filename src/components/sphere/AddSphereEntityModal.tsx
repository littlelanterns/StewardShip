import { useState } from 'react';
import { X } from 'lucide-react';
import type { SphereLevel, SphereEntityCategory } from '../../lib/types';
import { SPHERE_LEVEL_LABELS, SPHERE_LEVEL_ORDER, SPHERE_ENTITY_CATEGORY_LABELS } from '../../lib/types';

interface AddSphereEntityModalProps {
  onClose: () => void;
  onSave: (data: {
    name: string;
    entity_category: SphereEntityCategory;
    desired_sphere: SphereLevel;
    current_sphere?: SphereLevel;
    notes?: string;
  }) => void;
}

export function AddSphereEntityModal({ onClose, onSave }: AddSphereEntityModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SphereEntityCategory>('social_media');
  const [desired, setDesired] = useState<SphereLevel>('community');
  const [current, setCurrent] = useState<SphereLevel | ''>('');
  const [notes, setNotes] = useState('');

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      entity_category: category,
      desired_sphere: desired,
      current_sphere: current || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-label="Add Non-Person Influence">
        <div className="modal-panel__header">
          <h2 className="modal-panel__title">Add Influence</h2>
          <button className="modal-panel__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-panel__body">
          <label className="form-field">
            <span className="form-field__label">Name</span>
            <input
              className="form-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Instagram, CNN, local news"
              autoFocus
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Category</span>
            <select
              className="form-field__input"
              value={category}
              onChange={(e) => setCategory(e.target.value as SphereEntityCategory)}
            >
              {Object.entries(SPHERE_ENTITY_CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">Where do you want its influence?</span>
            <select
              className="form-field__input"
              value={desired}
              onChange={(e) => setDesired(e.target.value as SphereLevel)}
            >
              {SPHERE_LEVEL_ORDER.map((lvl) => (
                <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">Where is its influence right now? (optional)</span>
            <select
              className="form-field__input"
              value={current}
              onChange={(e) => setCurrent(e.target.value as SphereLevel | '')}
            >
              <option value="">Not sure yet</option>
              {SPHERE_LEVEL_ORDER.map((lvl) => (
                <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">Notes (optional)</span>
            <textarea
              className="form-field__input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context about this influence..."
              rows={2}
            />
          </label>

          <div className="modal-panel__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSave}
              onClick={handleSave}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
