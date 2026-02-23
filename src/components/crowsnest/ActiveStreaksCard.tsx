import { Flame, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StreakInfo } from '../../lib/types';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface ActiveStreaksCardProps {
  streaks: StreakInfo[];
}

export function ActiveStreaksCard({ streaks }: ActiveStreaksCardProps) {
  const navigate = useNavigate();

  if (streaks.length === 0) return null;

  return (
    <Card className="cn-card" onClick={() => navigate('/charts')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Flame size={16} /> Active Streaks
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <div className="cn-streaks">
        {streaks.map((s) => (
          <div key={s.taskId + s.taskTitle} className={`cn-streak ${s.isAtMilestone ? 'cn-streak--milestone' : ''}`}>
            <span className="cn-streak__title">{s.taskTitle}</span>
            <span className={`cn-streak__count ${s.isAtMilestone ? 'cn-streak__count--gold' : ''}`}>
              {s.currentStreak}d
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
