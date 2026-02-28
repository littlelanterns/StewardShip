import { BookOpen, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../shared/Card';
import './CrowsNestCards.css';

interface JournalSnapshotCardProps {
  thisWeekCount: number;
  lastDate: string | null;
  lastPreview: string | null;
}

export function JournalSnapshotCard({ thisWeekCount, lastDate, lastPreview }: JournalSnapshotCardProps) {
  const navigate = useNavigate();

  if (thisWeekCount === 0 && !lastPreview) return null;

  return (
    <Card className="cn-card" onClick={() => navigate('/journal')}>
      <div className="cn-card__header">
        <h3 className="cn-card__title">
          <BookOpen size={16} /> Journal
        </h3>
        <ArrowRight size={16} className="cn-card__arrow" />
      </div>
      {thisWeekCount > 0 && (
        <p className="cn-card__subtitle">{thisWeekCount} {thisWeekCount === 1 ? 'entry' : 'entries'} this week</p>
      )}
      {lastPreview && (
        <div className="cn-journal-preview">
          {lastDate && (
            <span className="cn-journal-preview__date">
              {new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <p className="cn-journal-preview__text">{lastPreview}</p>
        </div>
      )}
    </Card>
  );
}
