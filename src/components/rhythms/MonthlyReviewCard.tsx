import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRhythmCards, getPeriodKey } from '../../hooks/useRhythmCards';
import type { MonthlyReviewData } from '../../hooks/useRhythmCards';
import './Rhythms.css';

interface MonthlyReviewCardProps {
  onDismiss: () => void;
}

export function MonthlyReviewCard({ onDismiss }: MonthlyReviewCardProps) {
  const navigate = useNavigate();
  const { fetchMonthlyReviewData, dismissRhythm } = useRhythmCards();
  const [data, setData] = useState<MonthlyReviewData | null>(null);

  useEffect(() => {
    fetchMonthlyReviewData().then(setData);
  }, [fetchMonthlyReviewData]);

  const handleDismiss = useCallback(async () => {
    await dismissRhythm('monthly_review', getPeriodKey('monthly_review'));
    onDismiss();
  }, [dismissRhythm, onDismiss]);

  const handleStartReview = useCallback(() => {
    handleDismiss();
    navigate('/meetings');
  }, [handleDismiss, navigate]);

  if (!data) return null;

  return (
    <div className="rhythm-inline-card">
      <div className="rhythm-inline-card__content">
        <div className="rhythm-inline-card__title">
          It's a new month, {data.name}. Time for your monthly review?
        </div>
        <div className="rhythm-inline-card__stats">
          {data.tasksCompleted} tasks completed, {data.victoriesCount} victories, {data.logEntriesCount} Log entries last month
        </div>
      </div>
      <div className="rhythm-inline-card__actions">
        <button
          type="button"
          className="rhythm-actions__secondary"
          onClick={handleStartReview}
        >
          Start Monthly Review
        </button>
        <button
          type="button"
          className="rhythm-inline-card__dismiss"
          onClick={handleDismiss}
        >
          Not today
        </button>
      </div>
    </div>
  );
}
