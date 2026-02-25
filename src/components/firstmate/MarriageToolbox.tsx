import { useCallback } from 'react';
import { Heart, Gift, Eye, MessageCircle, Sparkles, Feather } from 'lucide-react';
import { Card } from '../shared';
import { useHelmContext } from '../../contexts/HelmContext';
import type { GuidedSubtype } from '../../lib/types';

interface MarriageToolboxProps {
  spouseId: string;
  isMarried: boolean; // true = "Marriage Toolbox", false = "Relationship Toolbox"
}

const TOOLBOX_MODES: { subtype: GuidedSubtype; label: string; desc: string; icon: typeof Heart }[] = [
  { subtype: 'quality_time', label: 'Quality Time', desc: 'Plan meaningful time together', icon: Heart },
  { subtype: 'gifts', label: 'Gifts', desc: 'Thoughtful gift ideas', icon: Gift },
  { subtype: 'observe_serve', label: 'Observe and Serve', desc: 'Notice and meet needs', icon: Eye },
  { subtype: 'words_of_affirmation', label: 'Words of Affirmation', desc: 'See and say what matters', icon: MessageCircle },
  { subtype: 'gratitude', label: 'Gratitude', desc: 'Go deeper in thankfulness', icon: Sparkles },
  { subtype: 'cyrano', label: 'Cyrano Me', desc: 'Help me say what I feel', icon: Feather },
];

export function MarriageToolbox({ spouseId, isMarried }: MarriageToolboxProps) {
  const { startGuidedConversation } = useHelmContext();

  const handleMode = useCallback(async (subtype: GuidedSubtype) => {
    await startGuidedConversation('first_mate_action', subtype, spouseId);
  }, [startGuidedConversation, spouseId]);

  return (
    <Card className="marriage-toolbox">
      <h3 className="marriage-toolbox__title">
        {isMarried ? 'Marriage Toolbox' : 'Relationship Toolbox'}
      </h3>
      <div className="marriage-toolbox__grid">
        {TOOLBOX_MODES.map(({ subtype, label, desc, icon: Icon }) => (
          <button key={subtype} className="marriage-toolbox__item" onClick={() => handleMode(subtype)}>
            <Icon size={20} className="marriage-toolbox__icon" />
            <div className="marriage-toolbox__item-label">{label}</div>
            <div className="marriage-toolbox__item-desc">{desc}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
