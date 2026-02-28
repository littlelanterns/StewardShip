import type { ActivityLogEventType } from '../../lib/types';
import { ACTIVITY_LOG_EVENT_LABELS } from '../../lib/types';
import type { ActivityLogFilters } from '../../hooks/useActivityLog';
import './ActivityLogFilterBar.css';

interface ActivityLogFilterBarProps {
  filters: ActivityLogFilters;
  onFiltersChange: (filters: ActivityLogFilters) => void;
}

const EVENT_TYPES = Object.keys(ACTIVITY_LOG_EVENT_LABELS) as ActivityLogEventType[];

const DATE_RANGES: { value: ActivityLogFilters['dateRange']; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

export default function ActivityLogFilterBar({ filters, onFiltersChange }: ActivityLogFilterBarProps) {
  return (
    <div className="activity-log-filter-bar">
      <div className="activity-log-filter-bar__row">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`activity-log-filter-bar__chip ${filters.dateRange === r.value ? 'activity-log-filter-bar__chip--active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, dateRange: r.value })}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="activity-log-filter-bar__row">
        <button
          type="button"
          className={`activity-log-filter-bar__chip ${!filters.eventType ? 'activity-log-filter-bar__chip--active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, eventType: null })}
        >
          All Events
        </button>
        {EVENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`activity-log-filter-bar__chip ${filters.eventType === t ? 'activity-log-filter-bar__chip--active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, eventType: t })}
          >
            {ACTIVITY_LOG_EVENT_LABELS[t]}
          </button>
        ))}
      </div>

      <label className="activity-log-filter-bar__toggle">
        <input
          type="checkbox"
          checked={filters.showHidden}
          onChange={(e) => onFiltersChange({ ...filters, showHidden: e.target.checked })}
        />
        <span>Show hidden</span>
      </label>
    </div>
  );
}
