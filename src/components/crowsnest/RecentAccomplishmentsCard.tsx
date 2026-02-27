import { Award, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Accomplishment } from '../../hooks/useAccomplishments';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface RecentAccomplishmentsCardProps {
  accomplishments: Accomplishment[];
  weekCount: number;
}

export function RecentAccomplishmentsCard({ accomplishments, weekCount }: RecentAccomplishmentsCardProps) {
  const navigate = useNavigate();

  if (accomplishments.length === 0) return null;

  return (
    <Card className="cn-card cn-card--victory" onClick={() => navigate('/victories')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Award size={16} /> Accomplishments
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <p className="cn-card__subtitle">{weekCount} this week</p>
      <div className="cn-victories">
        {accomplishments.map((a) => (
          <div key={a.id} className="cn-victory">
            <p className="cn-victory__desc">
              {a.title.length > 80 ? a.title.slice(0, 77) + '...' : a.title}
            </p>
            <span className="cn-victory__date">
              {new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
