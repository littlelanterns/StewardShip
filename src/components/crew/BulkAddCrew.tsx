import { useState } from 'react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared';
import { useAuthContext } from '../../contexts/AuthContext';
import { parseBulkCrew, type ParsedCrewMember } from '../../lib/bulkCrewParse';
import { RELATIONSHIP_TYPE_LABELS } from '../../lib/types';
import type { RelationshipType } from '../../lib/types';
import './BulkAddCrew.css';

const RELATIONSHIP_TYPES: RelationshipType[] = ['child', 'parent', 'sibling', 'coworker', 'friend', 'mentor', 'other'];

const CATEGORY_LABELS: Record<string, string> = {
  immediate_family: 'Immediate Family',
  extended_family: 'Extended Family',
  professional: 'Professional',
  social: 'Social',
  church_community: 'Church/Community',
  custom: 'Custom',
};

interface BulkAddCrewProps {
  existingNames: string[];
  onSave: (members: ParsedCrewMember[]) => Promise<void>;
  onClose: () => void;
}

export function BulkAddCrew({ existingNames, onSave, onClose }: BulkAddCrewProps) {
  const { user } = useAuthContext();
  const [inputText, setInputText] = useState('');
  const [members, setMembers] = useState<(ParsedCrewMember & { selected: boolean })[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!inputText.trim() || !user) return;
    setParsing(true);
    setError(null);
    try {
      const result = await parseBulkCrew(inputText, existingNames, user.id);
      if (result.newMembers.length === 0 && result.duplicates.length === 0) {
        setError('No new people found in your description. Try listing names with relationships, like "my friend Jake, my coworker Sarah."');
        return;
      }
      setMembers(
        result.newMembers.map((m) => ({
          ...m,
          selected: !m.isSpouse, // Spouse defaults to unchecked
        })),
      );
      setDuplicates(result.duplicates);
      setStep('preview');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleToggle = (index: number) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m)),
    );
  };

  const handleNameChange = (index: number, name: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, name } : m)),
    );
  };

  const handleTypeChange = (index: number, relationship_type: RelationshipType) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, relationship_type } : m)),
    );
  };

  const handleAgeChange = (index: number, val: string) => {
    const age = val ? parseInt(val, 10) : null;
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, age: age && age > 0 ? age : null } : m)),
    );
  };

  const selectedCount = members.filter((m) => m.selected).length;

  const handleSave = async () => {
    const toSave = members.filter((m) => m.selected && m.name.trim().length > 0);
    if (toSave.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(toSave);
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AddEntryModal title="Bulk Add Crew" onClose={onClose}>
      <div className="bulk-crew">
        {step === 'input' && (
          <div className="bulk-crew__input-step">
            <p className="bulk-crew__hint">
              Describe the people in your life. Use natural language or a simple list — the AI will figure out the rest.
            </p>
            <textarea
              className="bulk-crew__textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"e.g., My kids are Jake (12) and Emma (8). My boss Sarah at work. Best friends Mike and Dave from church. My mom Linda, and my brother Tom..."}
              rows={6}
              autoFocus
            />
            {error && <p className="bulk-crew__hint" style={{ color: 'var(--color-cognac)' }}>{error}</p>}
            <div className="bulk-crew__actions">
              <Button onClick={handleParse} disabled={!inputText.trim() || parsing}>
                {parsing ? 'Processing...' : 'Process with AI'}
              </Button>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="bulk-crew__preview-step">
            <p className="bulk-crew__hint">
              {members.length} {members.length === 1 ? 'person' : 'people'} found. Review and adjust before adding.
            </p>

            {duplicates.length > 0 && (
              <p className="bulk-crew__info-banner">
                Skipped {duplicates.length} already in your Crew: {duplicates.join(', ')}
              </p>
            )}

            {members.length === 0 ? (
              <p className="bulk-crew__empty">
                No new people found. All names matched existing Crew members.
              </p>
            ) : (
              <div className="bulk-crew__preview-list">
                {members.map((member, index) => (
                  <div
                    key={index}
                    className={`bulk-crew__preview-card${!member.selected ? ' bulk-crew__preview-card--excluded' : ''}${member.isSpouse ? ' bulk-crew__preview-card--spouse' : ''}`}
                  >
                    <div className="bulk-crew__card-header">
                      <input
                        type="checkbox"
                        className="bulk-crew__checkbox"
                        checked={member.selected}
                        onChange={() => handleToggle(index)}
                      />
                      <input
                        type="text"
                        className="bulk-crew__name-input"
                        value={member.name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                      />
                    </div>

                    <div className="bulk-crew__field-row">
                      <div className="bulk-crew__field">
                        <span className="bulk-crew__field-label">Type:</span>
                        <select
                          className="bulk-crew__select"
                          value={member.relationship_type}
                          onChange={(e) => handleTypeChange(index, e.target.value as RelationshipType)}
                        >
                          {RELATIONSHIP_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {RELATIONSHIP_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="bulk-crew__field">
                        <span className="bulk-crew__field-label">Age:</span>
                        <input
                          type="number"
                          className="bulk-crew__age-input"
                          value={member.age ?? ''}
                          onChange={(e) => handleAgeChange(index, e.target.value)}
                          placeholder="—"
                          min={0}
                          max={150}
                        />
                      </div>
                    </div>

                    {member.categories.length > 0 && (
                      <div className="bulk-crew__category-chips">
                        {member.categories.map((cat) => (
                          <span key={cat} className="bulk-crew__category-chip">
                            {CATEGORY_LABELS[cat] || cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {member.isSpouse && (
                      <div className="bulk-crew__notes-row">
                        <p className="bulk-crew__notes-text bulk-crew__notes-text--spouse">
                          Partner/spouse — should be set up as First Mate instead
                        </p>
                      </div>
                    )}

                    {member.notes && !member.isSpouse && (
                      <div className="bulk-crew__notes-row">
                        <p className="bulk-crew__notes-text">{member.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="bulk-crew__hint" style={{ color: 'var(--color-cognac)' }}>{error}</p>}

            <div className="bulk-crew__actions">
              <Button onClick={handleSave} disabled={selectedCount === 0 || saving}>
                {saving ? 'Adding...' : `Add Selected (${selectedCount})`}
              </Button>
              <Button variant="secondary" onClick={() => { setStep('input'); setError(null); }}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </AddEntryModal>
  );
}
