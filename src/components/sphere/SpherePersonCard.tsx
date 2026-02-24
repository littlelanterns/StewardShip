import { ChevronRight } from 'lucide-react';
import type { Person } from '../../lib/types';
import type { GapIndicator } from '../../hooks/useSphere';

interface SpherePersonCardProps {
  person: Person;
  gap: GapIndicator;
  onTap: (person: Person) => void;
  onChangeSphere: (person: Person) => void;
}

export function SpherePersonCard({ person, gap, onTap, onChangeSphere }: SpherePersonCardProps) {
  return (
    <button
      type="button"
      className="sphere-person-card"
      onClick={() => onTap(person)}
    >
      <div className="sphere-person-card__left">
        {gap.hasGap && (
          <span
            className={`sphere-person-card__gap sphere-person-card__gap--${gap.direction}`}
            title={gap.description}
          />
        )}
        <div className="sphere-person-card__info">
          <span className="sphere-person-card__name">{person.name}</span>
          <span className="sphere-person-card__type">{person.relationship_type}</span>
        </div>
      </div>
      <div className="sphere-person-card__right">
        <button
          type="button"
          className="sphere-person-card__menu"
          onClick={(e) => { e.stopPropagation(); onChangeSphere(person); }}
          aria-label="Change sphere assignment"
        >
          ...
        </button>
        <ChevronRight size={16} strokeWidth={1.5} />
      </div>
    </button>
  );
}
