import { Target, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface GoalsCardProps {
  goals: { id: string; title: string; progress: number; target: number | null }[];
}

export function GoalsCard({ goals }: GoalsCardProps) {
  const navigate = useNavigate();

  if (goals.length === 0) return null;

  return (
    <Card className="cn-card" onClick={() => navigate('/charts')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Target size={16} /> Goals
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <div className="cn-goals">
        {goals.map((g) => {
          const pct = g.target ? Math.min(Math.round((g.progress / g.target) * 100), 100) : g.progress;
          return (
            <div key={g.id} className="cn-goal">
              <div className="cn-goal__top">
                <span className="cn-goal__title">{g.title}</span>
                <span className="cn-goal__pct">{pct}%</span>
              </div>
              <div className="cn-goal__bar">
                <div className="cn-goal__fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
