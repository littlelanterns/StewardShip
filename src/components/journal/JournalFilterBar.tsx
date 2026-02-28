import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import type { JournalFilters, JournalEntryType } from '../../lib/types';
import { LIFE_AREA_LABELS } from '../../lib/types';
import './JournalFilterBar.css';

interface LinkedOption {
  id: string;
  label: string;
}

interface JournalFilterBarProps {
  filters: JournalFilters;
  onFiltersChange: (filters: JournalFilters) => void;
  linkedWheels?: LinkedOption[];
  linkedPlans?: LinkedOption[];
}

const DATE_RANGES: { value: JournalFilters['dateRange']; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

const ENTRY_TYPES: { value: JournalEntryType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'journal_entry', label: 'Journal' },
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'quick_note', label: 'Quick Note' },
  { value: 'commonplace', label: 'Commonplace' },
  { value: 'kid_quips', label: 'Kid Quips' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'helm_conversation', label: 'Helm' },
];

const LIFE_AREAS = Object.entries(LIFE_AREA_LABELS);

export default function JournalFilterBar({ filters, onFiltersChange, linkedWheels, linkedPlans }: JournalFilterBarProps) {
  const [searchOpen, setSearchOpen] = useState(!!filters.searchQuery);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (partial: Partial<JournalFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, searchQuery: value });
    }, 300);
  }, [filters, onFiltersChange]);

  return (
    <div className="journal-filter-bar">
      {/* Search toggle / input */}
      {searchOpen ? (
        <div className="journal-filter-bar__search">
          <input
            type="text"
            className="journal-filter-bar__search-input"
            placeholder="Search entries..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="journal-filter-bar__search-clear"
            onClick={() => {
              setLocalSearch('');
              if (debounceRef.current) clearTimeout(debounceRef.current);
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
          className="journal-filter-bar__search-toggle"
          onClick={() => setSearchOpen(true)}
          aria-label="Search entries"
        >
          <Search size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* Scrollable filter chips */}
      <div className="journal-filter-bar__chips">
        {/* Date range chips */}
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            type="button"
            className={`journal-filter-bar__chip ${filters.dateRange === dr.value ? 'journal-filter-bar__chip--active' : ''}`}
            onClick={() => update({ dateRange: dr.value })}
          >
            {dr.label}
          </button>
        ))}

        <span className="journal-filter-bar__divider" />

        {/* Entry type chips */}
        {ENTRY_TYPES.map((et) => (
          <button
            key={et.value || 'all'}
            type="button"
            className={`journal-filter-bar__chip ${
              (et.value === '' && !filters.entryType) || filters.entryType === et.value
                ? 'journal-filter-bar__chip--active'
                : ''
            }`}
            onClick={() => update({ entryType: (et.value || null) as JournalEntryType | null })}
          >
            {et.label}
          </button>
        ))}

        <span className="journal-filter-bar__divider" />

        {/* Life area chips */}
        <button
          type="button"
          className={`journal-filter-bar__chip ${!filters.lifeAreaTag ? 'journal-filter-bar__chip--active' : ''}`}
          onClick={() => update({ lifeAreaTag: null })}
        >
          All Areas
        </button>
        {LIFE_AREAS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`journal-filter-bar__chip ${filters.lifeAreaTag === value ? 'journal-filter-bar__chip--active' : ''}`}
            onClick={() => update({ lifeAreaTag: value })}
          >
            {label}
          </button>
        ))}

        {/* Linked filters */}
        {linkedWheels && linkedWheels.length > 0 && (
          <>
            <span className="journal-filter-bar__divider" />
            <select
              className="journal-filter-bar__linked-select"
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
            <span className="journal-filter-bar__divider" />
            <select
              className="journal-filter-bar__linked-select"
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
