import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCharts, type ChartsPeriod } from '../../hooks/useCharts';
import { Card } from '../shared/Card';
import './ChartCards.css';

interface TaskCompletionCardProps {
  period: ChartsPeriod;
  onTap?: () => void;
}

export function TaskCompletionCard({ period, onTap }: TaskCompletionCardProps) {
  const { getTaskCompletionData } = useCharts();
  const [data, setData] = useState<{ completed: number; total: number; daily: { date: string; completed: number; total: number }[] } | null>(null);

  useEffect(() => {
    getTaskCompletionData(period).then(setData);
  }, [getTaskCompletionData, period]);

  if (!data || data.total === 0) return null;

  const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

  const chartData = data.daily.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    completed: d.completed,
    remaining: d.total - d.completed,
  }));

  return (
    <Card className="chart-card" onClick={onTap}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">Task Completion</h3>
        <span className="chart-card__stat">{pct}%</span>
      </div>
      <p className="chart-card__summary">
        {data.completed} of {data.total} tasks completed
      </p>
      {chartData.length > 1 && (
        <div className="chart-card__chart">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={16}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, name: string) => [value, name === 'completed' ? 'Completed' : 'Remaining']) as any}
              />
              <Bar dataKey="completed" stackId="a" radius={[0, 0, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="var(--color-mid-teal)" />
                ))}
              </Bar>
              <Bar dataKey="remaining" stackId="a" radius={[2, 2, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="var(--color-warm-sand)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
