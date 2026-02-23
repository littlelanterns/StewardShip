import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useVictories } from '../../hooks/useVictories';
import { LIFE_AREA_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import type { ChartsPeriod } from '../../hooks/useCharts';
import './ChartCards.css';

interface VictorySummaryCardProps {
  period: ChartsPeriod;
  onTap?: () => void;
}

const PERIOD_TO_VICTORY: Record<ChartsPeriod, 'all' | 'this_month' | 'this_week' | 'today'> = {
  year: 'all',
  month: 'this_month',
  week: 'this_week',
  day: 'today',
};

export function VictorySummaryCard({ period, onTap }: VictorySummaryCardProps) {
  const { victories, fetchVictories, getVictoriesByArea } = useVictories();
  const [byArea, setByArea] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchVictories(PERIOD_TO_VICTORY[period]);
  }, [fetchVictories, period]);

  useEffect(() => {
    getVictoriesByArea().then(setByArea);
  }, [getVictoriesByArea]);

  if (victories.length === 0) return null;

  const areaEntries = Object.entries(byArea)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card className="chart-card chart-card--victory" onClick={onTap}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">Victories</h3>
        <Award size={18} className="chart-card__icon chart-card__icon--gold" />
      </div>
      <p className="chart-card__stat-large">{victories.length}</p>
      {areaEntries.length > 0 && (
        <div className="victory-breakdown">
          {areaEntries.slice(0, 5).map(([area, count]) => (
            <div key={area} className="victory-breakdown__row">
              <span className="victory-breakdown__label">{LIFE_AREA_LABELS[area] || area}</span>
              <div className="victory-breakdown__bar-track">
                <div
                  className="victory-breakdown__bar-fill"
                  style={{ width: `${Math.round((count / victories.length) * 100)}%` }}
                />
              </div>
              <span className="victory-breakdown__count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
