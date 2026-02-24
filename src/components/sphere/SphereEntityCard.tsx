import { useState } from 'react';
import type { SphereEntity, SphereLevel, SphereEntityCategory } from '../../lib/types';
import { SPHERE_ENTITY_CATEGORY_LABELS, SPHERE_LEVEL_LABELS, SPHERE_LEVEL_ORDER } from '../../lib/types';
import type { GapIndicator } from '../../hooks/useSphere';

interface SphereEntityCardProps {
  entity: SphereEntity;
  gap: GapIndicator;
  onUpdate: (id: string, updates: Partial<SphereEntity>) => void;
  onArchive: (id: string) => void;
}

export function SphereEntityCard({ entity, gap, onUpdate, onArchive }: SphereEntityCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entity.name);
  const [category, setCategory] = useState<SphereEntityCategory>(entity.entity_category);
  const [desired, setDesired] = useState<SphereLevel>(entity.desired_sphere);
  const [current, setCurrent] = useState<SphereLevel | ''>(entity.current_sphere || '');
  const [notes, setNotes] = useState(entity.notes || '');
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleSave = () => {
    onUpdate(entity.id, {
      name,
      entity_category: category,
      desired_sphere: desired,
      current_sphere: current || null,
      notes: notes || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="sphere-entity-card sphere-entity-card--editing">
        <input
          className="sphere-entity-card__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <select
          className="sphere-entity-card__select"
          value={category}
          onChange={(e) => setCategory(e.target.value as SphereEntityCategory)}
        >
          {Object.entries(SPHERE_ENTITY_CATEGORY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          className="sphere-entity-card__select"
          value={desired}
          onChange={(e) => setDesired(e.target.value as SphereLevel)}
        >
          {SPHERE_LEVEL_ORDER.map((lvl) => (
            <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
          ))}
        </select>
        <select
          className="sphere-entity-card__select"
          value={current}
          onChange={(e) => setCurrent(e.target.value as SphereLevel | '')}
        >
          <option value="">No current assessment</option>
          {SPHERE_LEVEL_ORDER.map((lvl) => (
            <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
          ))}
        </select>
        <textarea
          className="sphere-entity-card__textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
        />
        <div className="sphere-entity-card__actions">
          <button type="button" className="btn btn--sm" onClick={handleSave}>Save</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sphere-entity-card">
      <div className="sphere-entity-card__left">
        {gap.hasGap && (
          <span
            className={`sphere-entity-card__gap sphere-entity-card__gap--${gap.direction}`}
            title={gap.description}
          />
        )}
        <div className="sphere-entity-card__info">
          <span className="sphere-entity-card__name">{entity.name}</span>
          <span className="sphere-entity-card__badge">
            {SPHERE_ENTITY_CATEGORY_LABELS[entity.entity_category]}
          </span>
        </div>
      </div>
      <div className="sphere-entity-card__right">
        <button
          type="button"
          className="sphere-entity-card__menu"
          onClick={() => setEditing(true)}
          aria-label="Edit entity"
        >
          Edit
        </button>
        {confirmArchive ? (
          <span className="sphere-entity-card__confirm">
            <button type="button" className="btn btn--sm btn--danger" onClick={() => onArchive(entity.id)}>Remove</button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirmArchive(false)}>Keep</button>
          </span>
        ) : (
          <button
            type="button"
            className="sphere-entity-card__menu"
            onClick={() => setConfirmArchive(true)}
            aria-label="Archive entity"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}
