import type { WheelInstance } from '../../lib/types';
import { SPOKE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './WheelProgressCard.css';

interface WheelProgressCardProps {
  wheels: WheelInstance[];
  onWheelClick?: (wheel: WheelInstance) => void;
}

export function WheelProgressCard({ wheels, onWheelClick }: WheelProgressCardProps) {
  if (wheels.length === 0) return null;

  return (
    <div className="wheel-progress-cards">
      {wheels.map((wheel) => (
        <Card
          key={wheel.id}
          className="wheel-progress-card"
          onClick={onWheelClick ? () => onWheelClick(wheel) : undefined}
        >
          <p className="wheel-progress-card__hub">{wheel.hub_text}</p>
          <div className="wheel-progress-card__dots">
            {[0, 1, 2, 3, 4, 5].map((spoke) => (
              <span
                key={spoke}
                className={`wheel-progress-card__dot${
                  spoke < wheel.current_spoke
                    ? ' wheel-progress-card__dot--done'
                    : spoke === wheel.current_spoke
                      ? ' wheel-progress-card__dot--current'
                      : ''
                }`}
                title={SPOKE_LABELS[spoke]}
              />
            ))}
          </div>
          <div className="wheel-progress-card__meta">
            <span>{wheel.current_spoke >= 6 ? 'Spokes complete' : SPOKE_LABELS[wheel.current_spoke]}</span>
            {wheel.rim_count > 0 && (
              <span>{wheel.rim_count} Rim{wheel.rim_count > 1 ? 's' : ''}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
