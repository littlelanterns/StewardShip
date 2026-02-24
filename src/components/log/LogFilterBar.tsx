import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { LogFilters, LogEntryType } from '../../lib/types';
import { LIFE_AREA_LABELS } from '../../lib/types';
import './LogFilterBar.css';

interface LinkedOption {
  id: string;
  label: string;
}

interface LogFilterBarProps {
  filters: LogFilters;
  onFiltersChange: (filters: LogFilters) => void;
  linkedWheels?: LinkedOption[];
  linkedPlans?: LinkedOption[];
}

const DATE_RANGES: { value: LogFilters['dateRange']; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

const ENTRY_TYPES: { value: LogEntryType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'journal', label: 'Journal' },
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'quick_note', label: 'Quick Note' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'helm_conversation', label: 'Helm' },
];

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export default function LogFilterBar({ filters, onFiltersChange, linkedWheels, linkedPlans }: LogFilterBarProps) {
  const [searchOpen, setSearchOpen] = useState(!!filters.searchQuery);

  const update = (partial: Partial<LogFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div className="log-filter-bar">
      {/* Search toggle / input */}
      {searchOpen ? (
        <div className="log-filter-bar__search">
          <input
            type="text"
            className="log-filter-bar__search-input"
            placeholder="Search entries..."
            value={filters.searchQuery}
            onChange={(e) => update({ searchQuery: e.target.value })}
            autoFocus
          />
          <button
            type="button"
            className="log-filter-bar__search-clear"
            onClick={() => {
              update({ searchQuery: '' });
              setSearchOpen(false);
            }}
            aria-label="Close search"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="log-filter-bar__search-toggle"
          onClick={() => setSearchOpen(true)}
          aria-label="Search entries"
        >
          <Search size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* Scrollable filter chips */}
      <div className="log-filter-bar__chips">
        {/* Date range chips */}
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            type="button"
            className={`log-filter-bar__chip ${filters.dateRange === dr.value ? 'log-filter-bar__chip--active' : ''}`}
            onClick={() => update({ dateRange: dr.value })}
          >
            {dr.label}
          </button>
        ))}

        <span className="log-filter-bar__divider" />

        {/* Entry type chips */}
        {ENTRY_TYPES.map((et) => (
          <button
            key={et.value || 'all'}
            type="button"
            className={`log-filter-bar__chip ${
              (et.value === '' && !filters.entryType) || filters.entryType === et.value
                ? 'log-filter-bar__chip--active'
                : ''
            }`}
            onClick={() => update({ entryType: (et.value || null) as LogEntryType | null })}
          >
            {et.label}
          </button>
        ))}

        <span className="log-filter-bar__divider" />

        {/* Life area chips */}
        <button
          type="button"
          className={`log-filter-bar__chip ${!filters.lifeAreaTag ? 'log-filter-bar__chip--active' : ''}`}
          onClick={() => update({ lifeAreaTag: null })}
        >
          All Areas
        </button>
        {LIFE_AREAS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`log-filter-bar__chip ${filters.lifeAreaTag === value ? 'log-filter-bar__chip--active' : ''}`}
            onClick={() => update({ lifeAreaTag: value })}
          >
            {label}
          </button>
        ))}

        {/* Linked filters */}
        {linkedWheels && linkedWheels.length > 0 && (
          <>
            <span className="log-filter-bar__divider" />
            <select
              className="log-filter-bar__linked-select"
              value={filters.relatedWheelId || ''}
              onChange={(e) => update({ relatedWheelId: e.target.value || null })}
            >
              <option value="">All Wheels</option>
              {linkedWheels.map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </>
        )}

        {linkedPlans && linkedPlans.length > 0 && (
          <>
            <span className="log-filter-bar__divider" />
            <select
              className="log-filter-bar__linked-select"
              value={filters.relatedRiggingPlanId || ''}
              onChange={(e) => update({ relatedRiggingPlanId: e.target.value || null })}
            >
              <option value="">All Plans</option>
              {linkedPlans.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
