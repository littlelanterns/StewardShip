import { useEffect, useState, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useCrew } from '../hooks/useCrew';
import { useSphere } from '../hooks/useSphere';
import { useHiggins } from '../hooks/useHiggins';
import { useAuthContext } from '../contexts/AuthContext';
import type { Person } from '../lib/types';
import { Plus } from 'lucide-react';
import { LoadingSpinner, EmptyState, FloatingActionButton, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { CrewCategoryView } from '../components/crew/CrewCategoryView';
import { PersonDetail } from '../components/crew/PersonDetail';
import { AddCrewmateModal } from '../components/crew/AddCrewmateModal';
import { SphereView } from '../components/sphere/SphereView';
import { AddSphereEntityModal } from '../components/sphere/AddSphereEntityModal';
import '../components/crew/Crew.css';
import './Crew.css';

type CrewView = 'list' | 'detail' | 'sphere';

export default function Crew() {
  usePageContext({ page: 'crew' });
  const {
    people,
    selectedPerson,
    crewNotes,
    loading,
    fetchPeople,
    fetchPerson,
    createPerson,
    updatePerson,
    archivePerson,
    fetchCrewNotes,
    createCrewNote,
    updateCrewNote,
    archiveCrewNote,
    setSelectedPerson,
  } = useCrew();

  const { createSphereEntity } = useSphere();
  const { user } = useAuthContext();
  const {
    drafts: higginsDrafts,
    markSent: markHigginsSent,
    deleteDraft: deleteHigginsDraft,
  } = useHiggins(user?.id, selectedPerson?.id);

  const [view, setView] = useState<CrewView>('list');
  const [showAdd, setShowAdd] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handlePersonClick = useCallback(async (person: Person) => {
    await fetchPerson(person.id);
    if (person.has_rich_context) {
      await fetchCrewNotes(person.id);
    }
    setView('detail');
  }, [fetchPerson, fetchCrewNotes]);

  const handleBack = useCallback(() => {
    const prevView = view === 'detail' ? 'list' : view;
    setView(prevView === 'sphere' ? 'sphere' : 'list');
    setSelectedPerson(null);
    fetchPeople();
  }, [view, setSelectedPerson, fetchPeople]);

  // For sphere view — navigate to detail from sphere
  const handleSpherePersonTap = useCallback(async (person: Person) => {
    await fetchPerson(person.id);
    if (person.has_rich_context) {
      await fetchCrewNotes(person.id);
    }
    setView('detail');
  }, [fetchPerson, fetchCrewNotes]);

  if (view === 'detail' && selectedPerson) {
    return (
      <div className="page crew-page">
        <PersonDetail
          person={selectedPerson}
          crewNotes={crewNotes}
          onBack={handleBack}
          onUpdate={async (id, updates) => { await updatePerson(id, updates); }}
          onArchive={archivePerson}
          onFetchNotes={fetchCrewNotes}
          onCreateNote={createCrewNote}
          onUpdateNote={updateCrewNote}
          onArchiveNote={archiveCrewNote}
          higginsDrafts={higginsDrafts}
          onMarkHigginsSent={markHigginsSent}
          onDeleteHigginsDraft={deleteHigginsDraft}
        />
      </div>
    );
  }

  const isSphere = view === 'sphere';

  return (
    <div className="page crew-page">
      <div className="crew-page__header">
        <h1 className="crew-page__title">Crew</h1>
        <div className="crew-page__view-toggle">
          <button
            className={`crew-page__toggle-btn ${!isSphere ? 'crew-page__toggle-btn--active' : ''}`}
            onClick={() => setView('list')}
          >
            By Category
          </button>
          <button
            className={`crew-page__toggle-btn ${isSphere ? 'crew-page__toggle-btn--active' : ''}`}
            onClick={() => setView('sphere')}
          >
            By Sphere
          </button>
        </div>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.crew} />

      {isSphere ? (
        <div className="crew-page__content">
          <SphereView
            people={people}
            onPersonTap={handleSpherePersonTap}
            onUpdatePerson={async (id, updates) => { await updatePerson(id, updates); }}
          />
        </div>
      ) : loading && people.length === 0 ? (
        <div className="crew-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          heading="Your Crew"
          message="Add the people in your life — family, friends, colleagues, mentors. The AI uses this context to help you navigate relationships wisely."
        />
      ) : (
        <div className="crew-page__content">
          <CrewCategoryView
            people={people}
            onPersonClick={handlePersonClick}
          />
        </div>
      )}

      {isSphere ? (
        <div className="crew-page__fab-group">
          <FloatingActionButton onClick={() => setShowAdd(true)} aria-label="Add Person">
            <Plus size={24} />
          </FloatingActionButton>
          <button
            type="button"
            className="crew-page__add-entity-btn"
            onClick={() => setShowAddEntity(true)}
          >
            + Non-Person Influence
          </button>
        </div>
      ) : (
        <FloatingActionButton onClick={() => setShowAdd(true)} aria-label="Add Crewmate">
          <Plus size={24} />
        </FloatingActionButton>
      )}

      {showAdd && (
        <AddCrewmateModal
          onClose={() => setShowAdd(false)}
          onSave={(data) => createPerson(data)}
        />
      )}

      {showAddEntity && (
        <AddSphereEntityModal
          onClose={() => setShowAddEntity(false)}
          onSave={(data) => createSphereEntity(data)}
        />
      )}
    </div>
  );
}
