import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Check } from 'lucide-react';
import type { CustomTracker, TrackerEntry } from '../../lib/types';
import { useCharts, type ChartsPeriod } from '../../hooks/useCharts';
import { Card } from '../shared/Card';
import './ChartCards.css';

interface CustomTrackerCardProps {
  tracker: CustomTracker;
  period: ChartsPeriod;
  onLog?: (trackerId: string) => void;
  onTap?: (trackerId: string) => void;
}

export function CustomTrackerCard({ tracker, period, onLog, onTap }: CustomTrackerCardProps) {
  const { fetchTrackerEntries, trackerEntries } = useCharts();
  const [entries, setEntries] = useState<TrackerEntry[]>([]);

  useEffect(() => {
    fetchTrackerEntries(tracker.id, period);
  }, [fetchTrackerEntries, tracker.id, period]);

  useEffect(() => {
    setEntries(trackerEntries.filter((e) => e.tracker_id === tracker.id));
  }, [trackerEntries, tracker.id]);

  const chartData = entries.map((e) => ({
    date: new Date(e.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: tracker.tracking_type === 'yes_no' ? (e.value_boolean ? 1 : 0) : (e.value_numeric ?? 0),
  }));

  const todayStr = new Date().toISOString().split('T')[0];
  const loggedToday = entries.some((e) => e.entry_date === todayStr);

  return (
    <Card className="chart-card" onClick={() => onTap?.(tracker.id)}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">{tracker.name}</h3>
        <Activity size={18} className="chart-card__icon" />
      </div>

      {chartData.length > 0 && tracker.visualization === 'line_graph' && (
        <div className="chart-card__chart">
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-mid-teal)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length > 0 && tracker.visualization === 'bar_chart' && (
        <div className="chart-card__chart">
          <div className="mini-bar-chart">
            {chartData.map((d, i) => (
              <div key={i} className="mini-bar-chart__col">
                <div
                  className="mini-bar-chart__bar"
                  style={{ height: `${Math.max(((d.value / (tracker.target_value || Math.max(...chartData.map(c => c.value), 1))) * 100), 4)}%` }}
                />
                <span className="mini-bar-chart__label">{d.date.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartData.length > 0 && tracker.visualization === 'streak_calendar' && (
        <div className="streak-calendar">
          {chartData.map((d, i) => (
            <div
              key={i}
              className={`streak-calendar__day ${d.value > 0 ? 'streak-calendar__day--filled' : ''}`}
              title={`${d.date}: ${d.value}`}
            />
          ))}
        </div>
      )}

      {chartData.length === 0 && (
        <p className="chart-card__empty">No entries yet this period</p>
      )}

      <button
        type="button"
        className={`tracker-log-btn ${loggedToday ? 'tracker-log-btn--done' : ''}`}
        onClick={(e) => { e.stopPropagation(); if (!loggedToday) onLog?.(tracker.id); }}
        disabled={loggedToday}
      >
        {loggedToday ? <><Check size={14} /> Logged today</> : 'Log today'}
      </button>
    </Card>
  );
}
