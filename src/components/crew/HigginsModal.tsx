import { useCallback } from 'react';
import { useHelmContext } from '../../contexts/HelmContext';
import type { GuidedSubtype } from '../../lib/types';
import './HigginsModal.css';

interface HigginsModalProps {
  personName: string;
  personId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function HigginsModal({ personName, personId, isOpen, onClose }: HigginsModalProps) {
  const { startGuidedConversation } = useHelmContext();

  const handleSelect = useCallback(async (subtype: GuidedSubtype) => {
    onClose();
    await startGuidedConversation('crew_action', subtype, personId);
  }, [startGuidedConversation, personId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="higgins-modal__backdrop" onClick={onClose}>
      <div className="higgins-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="higgins-modal__title">Higgins</h2>
        <p className="higgins-modal__subtitle">Communication coach for {personName}</p>

        <div className="higgins-modal__options">
          <button
            className="higgins-modal__option"
            onClick={() => handleSelect('higgins_say')}
          >
            <span className="higgins-modal__option-label">Help me say something</span>
            <span className="higgins-modal__option-desc">
              You have a thought or message and need help expressing it well.
            </span>
          </button>

          <button
            className="higgins-modal__option"
            onClick={() => handleSelect('higgins_navigate')}
          >
            <span className="higgins-modal__option-label">Help me navigate a situation</span>
            <span className="higgins-modal__option-desc">
              You're in a relational challenge and need help processing it.
            </span>
          </button>
        </div>

        <button className="higgins-modal__cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
