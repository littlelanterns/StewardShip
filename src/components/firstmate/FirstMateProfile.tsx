import { useState } from 'react';
import { Card, Button, Input } from '../shared';
import type { Person, ImportantDate } from '../../lib/types';

interface FirstMateProfileProps {
  spouse: Person | null;
  onCreateSpouse: (data: { name: string }) => Promise<Person | null>;
  onUpdateSpouse: (updates: Partial<Pick<Person, 'name' | 'age' | 'personality_summary' | 'love_language' | 'important_dates' | 'notes'>>) => Promise<void>;
  partnerLabel: string; // "Spouse" / "Partner" based on relationship_status
}

export function FirstMateProfile({ spouse, onCreateSpouse, onUpdateSpouse, partnerLabel }: FirstMateProfileProps) {
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editLoveLanguage, setEditLoveLanguage] = useState('');
  const [saving, setSaving] = useState(false);

  if (!spouse && !creating) {
    return (
      <Card className="firstmate-profile firstmate-profile--empty">
        <h2 className="firstmate-profile__heading">Welcome to First Mate</h2>
        <p className="firstmate-profile__desc">
          This is where you'll build a living profile of your {partnerLabel.toLowerCase()} — their personality, love language, dreams, and the things you're grateful for about them.
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          Set Up Your {partnerLabel}'s Profile
        </Button>
      </Card>
    );
  }

  if (creating) {
    return (
      <Card className="firstmate-profile">
        <h2 className="firstmate-profile__heading">Who is your {partnerLabel.toLowerCase()}?</h2>
        <div className="firstmate-profile__form">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
            autoFocus
          />
          <div className="firstmate-profile__actions">
            <Button variant="primary" onClick={async () => {
              if (!name.trim()) return;
              setSaving(true);
              await onCreateSpouse({ name: name.trim() });
              setSaving(false);
              setCreating(false);
            }} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!spouse) return null;

  if (editing) {
    return (
      <Card className="firstmate-profile">
        <h2 className="firstmate-profile__heading">Edit Profile</h2>
        <div className="firstmate-profile__form">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="Age" type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} placeholder="Optional" />
          <div className="firstmate-profile__field">
            <label className="firstmate-profile__label">Personality Summary</label>
            <textarea
              className="firstmate-profile__textarea"
              value={editPersonality}
              onChange={(e) => setEditPersonality(e.target.value)}
              placeholder="How would you describe their personality?"
              rows={3}
            />
          </div>
          <Input label="Love Language" value={editLoveLanguage} onChange={(e) => setEditLoveLanguage(e.target.value)} placeholder="e.g., Words of Affirmation" />
          <div className="firstmate-profile__actions">
            <Button variant="primary" onClick={async () => {
              setSaving(true);
              await onUpdateSpouse({
                name: editName.trim() || spouse.name,
                age: editAge ? parseInt(editAge, 10) : null,
                personality_summary: editPersonality.trim() || null,
                love_language: editLoveLanguage.trim() || null,
              });
              setSaving(false);
              setEditing(false);
            }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="firstmate-profile">
      <div className="firstmate-profile__header">
        <h2 className="firstmate-profile__name">{spouse.name}</h2>
        <button className="firstmate-profile__edit-btn" onClick={() => {
          setEditName(spouse.name);
          setEditAge(spouse.age?.toString() || '');
          setEditPersonality(spouse.personality_summary || '');
          setEditLoveLanguage(spouse.love_language || '');
          setEditing(true);
        }}>Edit</button>
      </div>
      {spouse.personality_summary && (
        <p className="firstmate-profile__personality">{spouse.personality_summary}</p>
      )}
      <div className="firstmate-profile__details">
        {spouse.age && <span className="firstmate-profile__detail">Age {spouse.age}</span>}
        {spouse.love_language && <span className="firstmate-profile__detail">Love Language: {spouse.love_language}</span>}
      </div>
      {spouse.important_dates && spouse.important_dates.length > 0 && (
        <div className="firstmate-profile__dates">
          <span className="firstmate-profile__dates-label">Important Dates:</span>
          {spouse.important_dates.map((d: ImportantDate, i: number) => (
            <span key={i} className="firstmate-profile__date-item">
              {d.label}: {d.date}{d.recurring ? ' (yearly)' : ''}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
