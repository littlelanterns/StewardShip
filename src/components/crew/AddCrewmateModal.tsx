import { useState } from 'react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button, Input } from '../shared';
import type { RelationshipType, ImportantDate } from '../../lib/types';
import { RELATIONSHIP_TYPE_LABELS } from '../../lib/types';

interface AddCrewmateModalProps {
  onClose: () => void;
  onSave: (data: {
    name: string;
    relationship_type: RelationshipType;
    age?: number;
    notes?: string;
    important_dates?: ImportantDate[];
  }) => Promise<unknown>;
}

const RELATIONSHIP_TYPES: RelationshipType[] = ['child', 'parent', 'sibling', 'coworker', 'friend', 'mentor', 'other'];

export function AddCrewmateModal({ onClose, onSave }: AddCrewmateModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RelationshipType>('friend');
  const [age, setAge] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        relationship_type: type,
        age: age ? parseInt(age, 10) : undefined,
        notes: notes.trim() || undefined,
        important_dates: birthday
          ? [{ label: 'Birthday', date: birthday, recurring: true }]
          : undefined,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AddEntryModal title="Add Crewmate" onClose={onClose}>
      <div className="add-entry-form">
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" autoFocus />
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Relationship</label>
          <select className="add-entry-form__select" value={type} onChange={(e) => setType(e.target.value as RelationshipType)}>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Age (optional)</label>
          <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Optional" />
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Birthday (optional)</label>
          <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>
        <div className="add-entry-form__field">
          <label className="add-entry-form__label">Notes (optional)</label>
          <textarea className="add-entry-form__textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quick notes about this person" rows={3} />
        </div>
        {error && <p className="add-entry-form__error">{error}</p>}
        <div className="add-entry-form__actions">
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </div>
    </AddEntryModal>
  );
}
