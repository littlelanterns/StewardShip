import type { RiggingPlan } from '../../lib/types';
import { PLANNING_FRAMEWORK_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './PlanCard.css';

interface PlanCardProps {
  plan: RiggingPlan;
  onClick: (plan: RiggingPlan) => void;
}

export function PlanCard({ plan, onClick }: PlanCardProps) {
  const date = new Date(plan.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="plan-card" onClick={() => onClick(plan)}>
      <div className="plan-card__content">
        <p className="plan-card__title">{plan.title}</p>

        {plan.description && (
          <p className="plan-card__description">
            {plan.description.length > 120 ? plan.description.slice(0, 117) + '...' : plan.description}
          </p>
        )}

        <div className="plan-card__meta">
          {plan.planning_framework && (
            <span className="plan-card__framework">
              {PLANNING_FRAMEWORK_LABELS[plan.planning_framework]}
            </span>
          )}

          <span className={`plan-card__status plan-card__status--${plan.status}`}>
            {plan.status}
          </span>

          <span className="plan-card__date">{date}</span>
        </div>
      </div>
    </Card>
  );
}
