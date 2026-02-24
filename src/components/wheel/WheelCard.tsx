import type { WheelInstance } from '../../lib/types';
import { SPOKE_LABELS, WHEEL_STATUS_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './WheelCard.css';

interface WheelCardProps {
  wheel: WheelInstance;
  onClick: (wheel: WheelInstance) => void;
}

export function WheelCard({ wheel, onClick }: WheelCardProps) {
  const date = new Date(wheel.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="wheel-card" onClick={() => onClick(wheel)}>
      <div className="wheel-card__content">
        <p className="wheel-card__hub">{wheel.hub_text}</p>

        <div className="wheel-card__spoke-progress">
          {[0, 1, 2, 3, 4, 5].map((spoke) => (
            <span
              key={spoke}
              className={`wheel-card__spoke-dot${
                spoke < wheel.current_spoke
                  ? ' wheel-card__spoke-dot--completed'
                  : spoke === wheel.current_spoke
                    ? ' wheel-card__spoke-dot--current'
                    : ''
              }`}
              title={SPOKE_LABELS[spoke]}
            />
          ))}
          <span className="wheel-card__spoke-label">
            {wheel.current_spoke >= 6
              ? 'All spokes complete'
              : SPOKE_LABELS[wheel.current_spoke]}
          </span>
        </div>

        <div className="wheel-card__meta">
          <span
            className={`wheel-card__status${
              wheel.status === 'active' ? ' wheel-card__status--active' : ''
            }`}
          >
            {WHEEL_STATUS_LABELS[wheel.status]}
          </span>

          {wheel.life_area_tag && (
            <span className="wheel-card__tag">{wheel.life_area_tag}</span>
          )}

          {wheel.rim_count > 0 && (
            <span className="wheel-card__rim">
              {wheel.rim_count} Rim{wheel.rim_count > 1 ? 's' : ''}
            </span>
          )}

          {wheel.next_rim_date && wheel.status === 'active' && (
            <span className="wheel-card__rim">
              Next: {wheel.next_rim_date}
            </span>
          )}

          <span className="wheel-card__date">{date}</span>
        </div>
      </div>
    </Card>
  );
}
