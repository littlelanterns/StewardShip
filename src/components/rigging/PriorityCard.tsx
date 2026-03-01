import { Link2 } from 'lucide-react';
import type { Priority } from '../../lib/types';
import { PRIORITY_TIER_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './PriorityCard.css';

interface PriorityCardProps {
  priority: Priority;
  onClick: (priority: Priority) => void;
  showTier?: boolean;
}

export function PriorityCard({ priority, onClick, showTier = false }: PriorityCardProps) {
  const date = new Date(priority.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const hasLink = priority.linked_plan_id || priority.linked_goal_id || priority.linked_wheel_id;

  return (
    <Card className={`priority-card priority-card--${priority.tier}`} onClick={() => onClick(priority)}>
      <div className="priority-card__content">
        <p className="priority-card__title">{priority.title}</p>

        {priority.description && (
          <p className="priority-card__description">
            {priority.description.length > 120 ? priority.description.slice(0, 117) + '...' : priority.description}
          </p>
        )}

        <div className="priority-card__meta">
          {showTier && (
            <span className={`priority-card__tier priority-card__tier--${priority.tier}`}>
              {PRIORITY_TIER_LABELS[priority.tier]}
            </span>
          )}

          {hasLink && (
            <span className="priority-card__link">
              <Link2 size={12} /> Linked
            </span>
          )}

          <span className="priority-card__date">{date}</span>
        </div>
      </div>
    </Card>
  );
}
