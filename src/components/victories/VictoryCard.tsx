import { Award } from 'lucide-react';
import type { Victory } from '../../lib/types';
import { LIFE_AREA_LABELS, VICTORY_SOURCE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './VictoryCard.css';

interface VictoryCardProps {
  victory: Victory;
  onClick: (victory: Victory) => void;
}

export function VictoryCard({ victory, onClick }: VictoryCardProps) {
  const date = new Date(victory.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="victory-card" onClick={() => onClick(victory)}>
      <div className="victory-card__content">
        <p className="victory-card__description">{victory.description}</p>

        {victory.celebration_text && (
          <p className="victory-card__celebration">{victory.celebration_text}</p>
        )}

        <div className="victory-card__meta">
          {victory.life_area_tag && (
            <span className="victory-card__tag">
              {LIFE_AREA_LABELS[victory.life_area_tag] || victory.life_area_tag}
            </span>
          )}

          {victory.source !== 'manual' && (
            <span className="victory-card__source">
              <Award size={12} />
              {VICTORY_SOURCE_LABELS[victory.source]}
            </span>
          )}

          <span className="victory-card__date">{date}</span>
        </div>
      </div>
    </Card>
  );
}
