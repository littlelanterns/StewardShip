import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { useCharts } from '../../hooks/useCharts';
import type { StreakInfo } from '../../lib/types';
import { Card } from '../shared/Card';
import './ChartCards.css';

interface ActiveStreaksCardProps {
  onTap?: () => void;
}

export function ActiveStreaksCard({ onTap }: ActiveStreaksCardProps) {
  const { getActiveStreaks } = useCharts();
  const [streaks, setStreaks] = useState<StreakInfo[]>([]);

  useEffect(() => {
    getActiveStreaks().then(setStreaks);
  }, [getActiveStreaks]);

  if (streaks.length === 0) return null;

  return (
    <Card className="chart-card" onClick={onTap}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">Active Streaks</h3>
        <Flame size={18} className="chart-card__icon" />
      </div>
      <div className="streaks-list">
        {streaks.slice(0, 5).map((s) => (
          <div key={s.taskId + s.taskTitle} className={`streak-row ${s.isAtMilestone ? 'streak-row--milestone' : ''}`}>
            <span className="streak-row__title">{s.taskTitle}</span>
            <div className="streak-row__right">
              <span className={`streak-row__count ${s.isAtMilestone ? 'streak-row__count--gold' : ''}`}>
                {s.currentStreak}d
              </span>
              {s.isAtMilestone && <span className="streak-row__badge">Milestone</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
