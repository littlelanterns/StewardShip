import { useState, useCallback } from 'react';
import { useHelmContext } from '../../contexts/HelmContext';
import type { Person, GuidedSubtype } from '../../lib/types';
import { Check } from 'lucide-react';
import './HigginsCrewModal.css';

interface HigginsCrewModalProps {
  people: Person[];
  isOpen: boolean;
  onClose: () => void;
}

export function HigginsCrewModal({ people, isOpen, onClose }: HigginsCrewModalProps) {
  const { startGuidedConversation } = useHelmContext();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hint, setHint] = useState('');

  const togglePerson = useCallback((id: string) => {
    setHint('');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const handleModeSelect = useCallback(async (subtype: GuidedSubtype) => {
    if (selectedIds.length === 0) {
      setHint('Select at least one person, or tap "Just start talking" below');
      return;
    }

    onClose();
    setHint('');

    const primaryId = selectedIds[0];
    const metadata = selectedIds.length > 1
      ? { higgins_people_ids: selectedIds }
      : undefined;

    await startGuidedConversation('crew_action', subtype, primaryId, metadata);
    setSelectedIds([]);
  }, [selectedIds, onClose, startGuidedConversation]);

  const handleJustStart = useCallback(async () => {
    onClose();
    setHint('');
    setSelectedIds([]);
    await startGuidedConversation('crew_action', 'higgins_navigate', undefined);
  }, [onClose, startGuidedConversation]);

  if (!isOpen) return null;

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="higgins-crew-modal__backdrop" onClick={onClose}>
      <div className="higgins-crew-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="higgins-crew-modal__title">Higgins</h2>
        <p className="higgins-crew-modal__subtitle">
          Select who you want to talk about, then choose a mode.
        </p>

        <div className="higgins-crew-modal__people">
          {people.map((person) => {
            const isSelected = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                className={`higgins-crew-modal__chip ${isSelected ? 'higgins-crew-modal__chip--selected' : ''}`}
                onClick={() => togglePerson(person.id)}
                type="button"
              >
                {isSelected && <Check size={14} className="higgins-crew-modal__chip-check" />}
                {person.name}
              </button>
            );
          })}
        </div>

        {hint && (
          <p className="higgins-crew-modal__hint">{hint}</p>
        )}

        <div className="higgins-crew-modal__options">
          <button
            className={`higgins-crew-modal__option ${!hasSelection ? 'higgins-crew-modal__option--dimmed' : ''}`}
            onClick={() => handleModeSelect('higgins_say')}
            type="button"
          >
            <span className="higgins-crew-modal__option-label">Help me say something</span>
            <span className="higgins-crew-modal__option-desc">
              You have a thought or message and need help expressing it well.
            </span>
          </button>

          <button
            className={`higgins-crew-modal__option ${!hasSelection ? 'higgins-crew-modal__option--dimmed' : ''}`}
            onClick={() => handleModeSelect('higgins_navigate')}
            type="button"
          >
            <span className="higgins-crew-modal__option-label">Help me navigate a situation</span>
            <span className="higgins-crew-modal__option-desc">
              You're in a relational challenge and need help processing it.
            </span>
          </button>
        </div>

        <button
          className="higgins-crew-modal__just-start"
          onClick={handleJustStart}
          type="button"
        >
          Just start talking
        </button>

        <button className="higgins-crew-modal__cancel" onClick={onClose} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
