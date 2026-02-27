import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, GraduationCap, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../shared';
import { CollapsibleGroup } from '../shared/CollapsibleGroup';
import { CrewNoteCard } from './CrewNoteCard';
import { AddCrewNoteModal } from './AddCrewNoteModal';
import { SphereAssignment } from '../sphere/SphereAssignment';
import { HigginsModal } from './HigginsModal';
import { HigginsDrafts } from './HigginsDrafts';
import { useHelmContext } from '../../contexts/HelmContext';
import type { Person, CrewNote, CrewNoteCategory, ImportantDate, SphereLevel, HigginsMessage } from '../../lib/types';
import { RELATIONSHIP_TYPE_LABELS, CREW_NOTE_CATEGORY_LABELS, CREW_NOTE_CATEGORY_ORDER, SPHERE_LEVEL_LABELS } from '../../lib/types';
import '../sphere/Sphere.css';

interface PersonDetailProps {
  person: Person;
  crewNotes: CrewNote[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onFetchNotes: (personId: string, category?: CrewNoteCategory) => Promise<void>;
  onCreateNote: (personId: string, data: { text: string; category: CrewNoteCategory }) => Promise<void>;
  onUpdateNote: (id: string, updates: { text?: string; category?: CrewNoteCategory }) => Promise<void>;
  onArchiveNote: (id: string) => Promise<void>;
  higginsDrafts: HigginsMessage[];
  onMarkHigginsSent: (id: string) => Promise<void>;
  onDeleteHigginsDraft: (id: string) => Promise<void>;
}

export function PersonDetail({
  person,
  crewNotes,
  onBack,
  onUpdate,
  onArchive,
  onFetchNotes,
  onCreateNote,
  onUpdateNote,
  onArchiveNote,
  higginsDrafts,
  onMarkHigginsSent,
  onDeleteHigginsDraft,
}: PersonDetailProps) {
  const navigate = useNavigate();
  const { openDrawer, expandDrawer } = useHelmContext();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editAge, setEditAge] = useState(person.age?.toString() || '');
  const [editPersonality, setEditPersonality] = useState(person.personality_summary || '');
  const [editLoveLanguage, setEditLoveLanguage] = useState(person.love_language || '');
  const [editNotes, setEditNotes] = useState(person.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [addNoteCategory, setAddNoteCategory] = useState<CrewNoteCategory | undefined>();
  const [showHiggins, setShowHiggins] = useState(false);

  useEffect(() => {
    if (person.has_rich_context) {
      onFetchNotes(person.id);
    }
  }, [person.id, person.has_rich_context, onFetchNotes]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    await onUpdate(person.id, {
      name: editName.trim() || person.name,
      age: editAge ? parseInt(editAge, 10) : null,
      personality_summary: editPersonality.trim() || null,
      love_language: editLoveLanguage.trim() || null,
      notes: editNotes.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  }, [person.id, person.name, editName, editAge, editPersonality, editLoveLanguage, editNotes, onUpdate]);

  const handleDiscuss = useCallback(() => {
    openDrawer();
    expandDrawer();
    navigate('/helm');
  }, [openDrawer, expandDrawer, navigate]);

  const handleUpgradeContext = useCallback(async () => {
    await onUpdate(person.id, { has_rich_context: true });
  }, [person.id, onUpdate]);

  // Group notes by category
  const notesByCategory: Record<CrewNoteCategory, CrewNote[]> = {} as Record<CrewNoteCategory, CrewNote[]>;
  for (const cat of CREW_NOTE_CATEGORY_ORDER) {
    notesByCategory[cat] = crewNotes.filter((n) => n.category === cat);
  }

  return (
    <div className="person-detail">
      <div className="person-detail__toolbar">
        <button className="person-detail__back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="person-detail__toolbar-actions">
          <button className="person-detail__action-btn" onClick={handleDiscuss} title="Discuss at The Helm">
            <MessageSquare size={18} />
          </button>
          {person.has_rich_context && !person.is_first_mate && (
            <button className="person-detail__action-btn" onClick={() => setShowHiggins(true)} title="Higgins">
              <GraduationCap size={18} />
            </button>
          )}
          {!editing && (
            <button className="person-detail__action-btn" onClick={() => setEditing(true)} title="Edit">
              <Pencil size={18} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <Card className="person-detail__edit-card">
          <div className="person-detail__form">
            <label className="person-detail__label">Name</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label className="person-detail__label">Age</label>
            <Input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} placeholder="Optional" />
            <label className="person-detail__label">Personality</label>
            <textarea className="person-detail__textarea" value={editPersonality} onChange={(e) => setEditPersonality(e.target.value)} placeholder="How would you describe them?" rows={3} />
            <label className="person-detail__label">Love Language</label>
            <Input value={editLoveLanguage} onChange={(e) => setEditLoveLanguage(e.target.value)} placeholder="e.g., Quality Time" />
            {!person.has_rich_context && (
              <>
                <label className="person-detail__label">Notes</label>
                <textarea className="person-detail__textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="General notes..." rows={3} />
              </>
            )}
            <div className="person-detail__form-actions">
              <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="person-detail__profile-card">
          <h2 className="person-detail__name">{person.name}</h2>
          <span className="person-detail__type-badge">
            {RELATIONSHIP_TYPE_LABELS[person.relationship_type]}
          </span>
          {person.age && <span className="person-detail__age">Age {person.age}</span>}
          {person.personality_summary && (
            <p className="person-detail__personality">{person.personality_summary}</p>
          )}
          {person.love_language && (
            <p className="person-detail__detail">Love Language: {person.love_language}</p>
          )}
          {person.important_dates && person.important_dates.length > 0 && (
            <div className="person-detail__dates">
              <span className="person-detail__dates-label">Important Dates:</span>
              {(person.important_dates as ImportantDate[]).map((d, i) => (
                <span key={i} className="person-detail__date-item">
                  {d.label}: {d.date}{d.recurring ? ' (yearly)' : ''}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {!person.is_first_mate && (
        <Card className="person-detail__sphere-card">
          <h3 className="person-detail__section-title">Sphere Placement</h3>
          {person.desired_sphere ? (
            <div className="person-detail__sphere-current">
              <span className="person-detail__sphere-value">
                Desired: {SPHERE_LEVEL_LABELS[person.desired_sphere]}
              </span>
              {person.current_sphere && (
                <span className="person-detail__sphere-value">
                  Current: {SPHERE_LEVEL_LABELS[person.current_sphere]}
                </span>
              )}
            </div>
          ) : null}
          <SphereAssignment
            desiredSphere={person.desired_sphere}
            currentSphere={person.current_sphere}
            onDesiredChange={(desired: SphereLevel | null) => {
              onUpdate(person.id, { desired_sphere: desired });
            }}
            onCurrentChange={(current: SphereLevel | null) => {
              onUpdate(person.id, { current_sphere: current });
            }}
          />
        </Card>
      )}

      {person.has_rich_context && (
        <div className="person-detail__notes-section">
          <h3 className="person-detail__section-title">Notes</h3>
          {CREW_NOTE_CATEGORY_ORDER.map((cat) => {
            const catNotes = notesByCategory[cat];
            if (catNotes.length === 0) return null;
            return (
              <CollapsibleGroup key={cat} label={CREW_NOTE_CATEGORY_LABELS[cat]} count={catNotes.length} defaultExpanded={true}>
                {catNotes.map((note) => (
                  <CrewNoteCard
                    key={note.id}
                    note={note}
                    onUpdate={onUpdateNote}
                    onArchive={onArchiveNote}
                  />
                ))}
                <button
                  className="person-detail__add-note-btn"
                  onClick={() => { setAddNoteCategory(cat); setShowAddNote(true); }}
                >
                  + Add to {CREW_NOTE_CATEGORY_LABELS[cat]}
                </button>
              </CollapsibleGroup>
            );
          })}
          <button
            className="person-detail__add-note-btn person-detail__add-note-btn--standalone"
            onClick={() => { setAddNoteCategory(undefined); setShowAddNote(true); }}
          >
            + Add Note
          </button>
        </div>
      )}

      {!person.has_rich_context && !editing && (
        <Card className="person-detail__basic-notes">
          <h3 className="person-detail__section-title">Notes</h3>
          {person.notes ? (
            <p className="person-detail__notes-text">{person.notes}</p>
          ) : (
            <p className="person-detail__notes-empty">No notes yet. Tap Edit to add some.</p>
          )}
          <Button variant="secondary" onClick={handleUpgradeContext}>
            Upgrade to Rich Context
          </Button>
        </Card>
      )}

      {person.has_rich_context && !person.is_first_mate && higginsDrafts.length > 0 && (
        <HigginsDrafts
          drafts={higginsDrafts}
          onMarkSent={onMarkHigginsSent}
          onDelete={onDeleteHigginsDraft}
        />
      )}

      <div className="person-detail__danger-zone">
        {confirmArchive ? (
          <div className="person-detail__confirm-archive">
            <p>Remove {person.name} from your crew?</p>
            <div className="person-detail__confirm-actions">
              <Button variant="primary" onClick={() => { onArchive(person.id); onBack(); }}>
                Yes, Remove
              </Button>
              <Button variant="secondary" onClick={() => setConfirmArchive(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button className="person-detail__archive-btn" onClick={() => setConfirmArchive(true)}>
            <Trash2 size={14} /> Archive
          </button>
        )}
      </div>

      {showAddNote && (
        <AddCrewNoteModal
          onClose={() => setShowAddNote(false)}
          onSave={(data) => onCreateNote(person.id, data)}
          preselectedCategory={addNoteCategory}
        />
      )}

      <HigginsModal
        personName={person.name}
        personId={person.id}
        isOpen={showHiggins}
        onClose={() => setShowHiggins(false)}
      />
    </div>
  );
}
