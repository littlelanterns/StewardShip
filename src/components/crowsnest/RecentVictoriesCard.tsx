import { Award, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Victory } from '../../lib/types';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface RecentVictoriesCardProps {
  victories: Victory[];
  weekCount: number;
}

export function RecentVictoriesCard({ victories, weekCount }: RecentVictoriesCardProps) {
  const navigate = useNavigate();

  if (victories.length === 0) return null;

  return (
    <Card className="cn-card cn-card--victory" onClick={() => navigate('/victories')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Award size={16} /> Victories
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <p className="cn-card__subtitle">{weekCount} this week</p>
      <div className="cn-victories">
        {victories.map((v) => (
          <div key={v.id} className="cn-victory">
            <p className="cn-victory__desc">
              {v.description.length > 80 ? v.description.slice(0, 77) + '...' : v.description}
            </p>
            <span className="cn-victory__date">
              {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
