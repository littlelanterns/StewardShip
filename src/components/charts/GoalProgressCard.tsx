import { useEffect } from 'react';
import { Target } from 'lucide-react';
import { useGoals } from '../../hooks/useGoals';
import { Card } from '../shared/Card';
import './ChartCards.css';

interface GoalProgressCardProps {
  onTap?: (goalId: string) => void;
}

export function GoalProgressCard({ onTap }: GoalProgressCardProps) {
  const { goals, fetchGoals } = useGoals();

  useEffect(() => {
    fetchGoals('active');
  }, [fetchGoals]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length === 0) return null;

  return (
    <Card className="chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">Goals</h3>
        <Target size={18} className="chart-card__icon" />
      </div>
      <div className="goals-list">
        {activeGoals.slice(0, 5).map((g) => {
          const pct = g.progress_target
            ? Math.min(Math.round((g.progress_current / g.progress_target) * 100), 100)
            : g.progress_current;
          return (
            <div
              key={g.id}
              className="goal-row"
              onClick={(e) => { e.stopPropagation(); onTap?.(g.id); }}
            >
              <div className="goal-row__top">
                <span className="goal-row__title">{g.title}</span>
                <span className="goal-row__pct">{pct}%</span>
              </div>
              <div className="goal-row__bar">
                <div className="goal-row__fill" style={{ width: `${pct}%` }} />
              </div>
              {g.target_date && (
                <span className="goal-row__date">
                  Target: {new Date(g.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
