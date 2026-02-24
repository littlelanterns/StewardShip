import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSphere } from '../../hooks/useSphere';
import type { SphereData } from '../../hooks/useSphere';
import type { Person, SphereLevel } from '../../lib/types';
import { SPHERE_LEVEL_ORDER } from '../../lib/types';
import { LoadingSpinner, EmptyState } from '../shared';
import { FocusCenterCard } from './FocusCenterCard';
import { SphereSectionHeader } from './SphereSectionHeader';
import { SpherePersonCard } from './SpherePersonCard';
import { SphereEntityCard } from './SphereEntityCard';
import { SphereAssignment } from './SphereAssignment';
import './Sphere.css';

interface SphereViewProps {
  people: Person[];
  onPersonTap: (person: Person) => void;
  onUpdatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
}

export function SphereView({ people, onPersonTap, onUpdatePerson }: SphereViewProps) {
  const navigate = useNavigate();
  const {
    sphereEntities,
    loading,
    fetchSphereEntities,
    updateSphereEntity,
    archiveSphereEntity,
    getSphereData,
    getGapIndicator,
  } = useSphere();

  const [sphereData, setSphereData] = useState<SphereData | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  useEffect(() => {
    fetchSphereEntities();
  }, [fetchSphereEntities]);

  const loadSphereData = useCallback(async () => {
    const data = await getSphereData(people);
    setSphereData(data);
  }, [getSphereData, people]);

  useEffect(() => {
    loadSphereData();
  }, [loadSphereData]);

  const handlePersonTap = useCallback((person: Person) => {
    if (person.is_first_mate) {
      navigate('/first-mate');
    } else {
      onPersonTap(person);
    }
  }, [navigate, onPersonTap]);

  const handleSphereChange = useCallback(async (
    personId: string,
    desired: SphereLevel | null,
    current: SphereLevel | null,
  ) => {
    await onUpdatePerson(personId, { desired_sphere: desired, current_sphere: current });
    setEditingPerson(null);
    loadSphereData();
  }, [onUpdatePerson, loadSphereData]);

  if (loading && !sphereData) {
    return <div className="sphere-view__loading"><LoadingSpinner size="md" /></div>;
  }

  if (!sphereData) {
    return <EmptyState heading="Sphere of Influence" message="Loading sphere data..." />;
  }

  const allEmpty = SPHERE_LEVEL_ORDER.every(
    (lvl) => sphereData.levels[lvl].people.length === 0 && sphereData.levels[lvl].entities.length === 0
  ) && sphereData.unassigned.people.length === 0;

  return (
    <div className="sphere-view">
      {allEmpty && people.length === 0 ? (
        <EmptyState
          heading="Sphere of Influence"
          message="Add people to your Crew first, then assign them to spheres to map your circle of influence."
        />
      ) : (
        <>
          {SPHERE_LEVEL_ORDER.map((level) => {
            const section = sphereData.levels[level];
            const count = section.people.length + section.entities.length;
            const isFocus = level === 'focus';

            return (
              <div key={level} className={`sphere-view__section sphere-view__section--${level}`}>
                <SphereSectionHeader level={level} count={count} />

                {isFocus && (
                  <FocusCenterCard
                    spouse={sphereData.focusCenter.spouse}
                    showGod={sphereData.focusCenter.god}
                  />
                )}

                {section.people.map((person) => (
                  <SpherePersonCard
                    key={person.id}
                    person={person}
                    gap={getGapIndicator(person)}
                    onTap={handlePersonTap}
                    onChangeSphere={setEditingPerson}
                  />
                ))}

                {section.entities.map((entity) => (
                  <SphereEntityCard
                    key={entity.id}
                    entity={entity}
                    gap={getGapIndicator(entity)}
                    onUpdate={updateSphereEntity}
                    onArchive={archiveSphereEntity}
                  />
                ))}

                {count === 0 && !isFocus && (
                  <p className="sphere-view__empty-hint">No one in this sphere yet</p>
                )}
              </div>
            );
          })}

          {sphereData.unassigned.people.length > 0 && (
            <div className="sphere-view__section sphere-view__section--unassigned">
              <div className="sphere-section-header">
                <div className="sphere-section-header__top">
                  <h3 className="sphere-section-header__title">Unassigned</h3>
                  <span className="sphere-section-header__count">
                    {sphereData.unassigned.people.length}
                  </span>
                </div>
                <p className="sphere-section-header__desc">
                  People not yet placed in a sphere
                </p>
              </div>
              {sphereData.unassigned.people.map((person) => (
                <SpherePersonCard
                  key={person.id}
                  person={person}
                  gap={getGapIndicator(person)}
                  onTap={handlePersonTap}
                  onChangeSphere={setEditingPerson}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editingPerson && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingPerson(null)}>
          <div className="modal-panel" role="dialog" aria-label="Sphere Assignment">
            <div className="modal-panel__header">
              <h2 className="modal-panel__title">
                {editingPerson.name} — Sphere
              </h2>
              <button
                className="modal-panel__close"
                onClick={() => setEditingPerson(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-panel__body">
              <SphereAssignment
                desiredSphere={editingPerson.desired_sphere}
                currentSphere={editingPerson.current_sphere}
                onDesiredChange={(desired) => {
                  handleSphereChange(
                    editingPerson.id,
                    desired,
                    editingPerson.current_sphere,
                  );
                }}
                onCurrentChange={(current) => {
                  handleSphereChange(
                    editingPerson.id,
                    editingPerson.desired_sphere,
                    current,
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
