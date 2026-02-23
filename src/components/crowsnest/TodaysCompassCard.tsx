import { CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CompassTask } from '../../lib/types';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface TodaysCompassCardProps {
  total: number;
  completed: number;
  pending: CompassTask[];
}

export function TodaysCompassCard({ total, completed, pending }: TodaysCompassCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="cn-card" onClick={() => navigate('/compass')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">Today's Tasks</h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <div className="cn-compass-stats">
        <div className="cn-compass-stat">
          <CheckCircle size={16} className="cn-compass-stat__icon cn-compass-stat__icon--done" />
          <span className="cn-compass-stat__value">{completed}</span>
          <span className="cn-compass-stat__label">done</span>
        </div>
        <div className="cn-compass-stat">
          <Circle size={16} className="cn-compass-stat__icon" />
          <span className="cn-compass-stat__value">{total - completed}</span>
          <span className="cn-compass-stat__label">remaining</span>
        </div>
      </div>
      {pending.length > 0 && (
        <ul className="cn-compass-list">
          {pending.map((t) => (
            <li key={t.id} className="cn-compass-item">{t.title}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
