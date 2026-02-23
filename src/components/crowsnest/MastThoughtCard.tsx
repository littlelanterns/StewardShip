import { Anchor, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MastEntry } from '../../lib/types';
import { MAST_TYPE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface MastThoughtCardProps {
  entry: MastEntry;
}

export function MastThoughtCard({ entry }: MastThoughtCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="cn-card cn-card--mast" onClick={() => navigate('/mast')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <Anchor size={16} /> From Your Mast
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      <p className="cn-mast__text">
        {entry.text.length > 200 ? entry.text.slice(0, 197) + '...' : entry.text}
      </p>
      <span className="cn-mast__type">{MAST_TYPE_LABELS[entry.type]}</span>
    </Card>
  );
}
