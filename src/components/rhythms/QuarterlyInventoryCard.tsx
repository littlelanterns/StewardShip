import { useEffect, useState, useCallback } from 'react';
import { useRhythmCards, getPeriodKey } from '../../hooks/useRhythmCards';
import { useHelmContext } from '../../contexts/HelmContext';
import type { QuarterlyInventoryData } from '../../hooks/useRhythmCards';
import './Rhythms.css';

interface QuarterlyInventoryCardProps {
  onDismiss: () => void;
}

export function QuarterlyInventoryCard({ onDismiss }: QuarterlyInventoryCardProps) {
  const { startGuidedConversation } = useHelmContext();
  const { fetchQuarterlyInventoryData, dismissRhythm } = useRhythmCards();
  const [data, setData] = useState<QuarterlyInventoryData | null>(null);

  useEffect(() => {
    fetchQuarterlyInventoryData().then(setData);
  }, [fetchQuarterlyInventoryData]);

  const handleDismiss = useCallback(async () => {
    await dismissRhythm('quarterly_inventory', getPeriodKey('quarterly_inventory'));
    onDismiss();
  }, [dismissRhythm, onDismiss]);

  const handleStart = useCallback(() => {
    handleDismiss();
    startGuidedConversation('life_inventory');
  }, [handleDismiss, startGuidedConversation]);

  if (!data) return null;

  return (
    <div className="rhythm-inline-card">
      <div className="rhythm-inline-card__content">
        <div className="rhythm-inline-card__title">
          It's been about {data.monthsSinceLastUpdate} month{data.monthsSinceLastUpdate !== 1 ? 's' : ''} since
          you last updated your Life Inventory. Some things may have shifted. Want to take a fresh look?
        </div>
      </div>
      <div className="rhythm-inline-card__actions">
        <button
          type="button"
          className="rhythm-actions__secondary"
          onClick={handleStart}
        >
          Start Life Inventory
        </button>
        <button
          type="button"
          className="rhythm-inline-card__dismiss"
          onClick={handleDismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
