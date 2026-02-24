import { useNavigate } from 'react-router-dom';
import { CollapsibleGroup } from '../shared/CollapsibleGroup';
import { PersonCard } from './PersonCard';
import type { Person } from '../../lib/types';
import { CREW_SECTIONS } from '../../lib/types';

interface CrewCategoryViewProps {
  people: Person[];
  onPersonClick: (person: Person) => void;
}

export function CrewCategoryView({ people, onPersonClick }: CrewCategoryViewProps) {
  const navigate = useNavigate();

  const sections = CREW_SECTIONS.map((section) => ({
    ...section,
    people: people.filter((p) => section.types.includes(p.relationship_type)),
  })).filter((s) => s.people.length > 0);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="crew-category-view">
      {sections.map((section) => (
        <CollapsibleGroup
          key={section.key}
          label={section.label}
          count={section.people.length}
          defaultExpanded={true}
        >
          {section.people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onClick={() => {
                if (person.is_first_mate) {
                  navigate('/first-mate');
                } else {
                  onPersonClick(person);
                }
              }}
            />
          ))}
        </CollapsibleGroup>
      ))}
    </div>
  );
}
