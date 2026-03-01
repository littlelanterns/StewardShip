import { Anchor, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface CurrentCommitmentsCardProps {
  commitments: { id: string; title: string }[];
}

export function CurrentCommitmentsCard({ commitments }: CurrentCommitmentsCardProps) {
  const navigate = useNavigate();

  if (commitments.length === 0) return null;

  return (
    <Card className="cn-card" onClick={() => navigate('/rigging')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Anchor size={16} /> Current Commitments
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <ul className="cn-commitments">
        {commitments.map((c) => (
          <li key={c.id} className="cn-commitments__item">{c.title}</li>
        ))}
      </ul>
    </Card>
  );
}
