import { ChevronRight } from 'lucide-react';
import { Card } from '../shared';
import type { Person } from '../../lib/types';
import { RELATIONSHIP_TYPE_LABELS } from '../../lib/types';

interface PersonCardProps {
  person: Person;
  onClick: () => void;
}

export function PersonCard({ person, onClick }: PersonCardProps) {
  return (
    <Card
      className="person-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
    >
      <div className="person-card__content">
        <div className="person-card__info">
          <span className="person-card__name">{person.name}</span>
          <span className="person-card__type">
            {RELATIONSHIP_TYPE_LABELS[person.relationship_type]}
            {person.age ? `, ${person.age}` : ''}
          </span>
        </div>
        <div className="person-card__indicators">
          {person.is_first_mate && (
            <span className="person-card__badge person-card__badge--firstmate">First Mate</span>
          )}
          {person.has_rich_context && !person.is_first_mate && (
            <span className="person-card__badge person-card__badge--rich">Rich Context</span>
          )}
          <ChevronRight size={16} className="person-card__arrow" />
        </div>
      </div>
    </Card>
  );
}
