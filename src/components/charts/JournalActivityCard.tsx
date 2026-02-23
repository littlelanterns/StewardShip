import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useCharts, type ChartsPeriod } from '../../hooks/useCharts';
import { Card } from '../shared/Card';
import './ChartCards.css';

interface JournalActivityCardProps {
  period: ChartsPeriod;
  onTap?: () => void;
}

export function JournalActivityCard({ period, onTap }: JournalActivityCardProps) {
  const { getJournalActivity } = useCharts();
  const [data, setData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    getJournalActivity(period).then(setData);
  }, [getJournalActivity, period]);

  if (data.length === 0) return null;

  const totalEntries = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="chart-card" onClick={onTap}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">Journal Activity</h3>
        <BookOpen size={18} className="chart-card__icon" />
      </div>
      <p className="chart-card__summary">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} this period</p>
      <div className="heatmap">
        {data.map((d) => {
          const intensity = d.count / maxCount;
          const opacity = 0.15 + intensity * 0.85;
          return (
            <div key={d.date} className="heatmap__cell" title={`${d.date}: ${d.count} entries`}>
              <div
                className="heatmap__fill"
                style={{ opacity }}
              />
              <span className="heatmap__label">
                {new Date(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
