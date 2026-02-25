import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Button, LoadingSpinner } from '../shared';
import { useJournalExport, type ExportFilters } from '../../hooks/useJournalExport';
import { useAuthContext } from '../../contexts/AuthContext';
import { LOG_ENTRY_TYPE_LABELS, LIFE_AREA_LABELS } from '../../lib/types';
import type { LogEntryType } from '../../lib/types';
import './JournalExportModal.css';

const ALL_ENTRY_TYPES: LogEntryType[] = [
  'journal', 'gratitude', 'reflection', 'quick_note',
  'meeting_notes', 'transcript', 'helm_conversation', 'brain_dump', 'custom',
];

const ALL_LIFE_AREAS = Object.keys(LIFE_AREA_LABELS);

type DatePreset = 'last_month' | 'last_3_months' | 'this_year' | 'all_time' | 'custom';

function getPresetDateRange(preset: DatePreset): { start: string; end: string } | null {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const end = endOfDay.toISOString();

  switch (preset) {
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { start: start.toISOString(), end };
    }
    case 'last_3_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return { start: start.toISOString(), end };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: start.toISOString(), end };
    }
    case 'all_time':
      return null;
    case 'custom':
      return null;
    default:
      return null;
  }
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface JournalExportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function JournalExportModal({ open, onClose }: JournalExportModalProps) {
  const { profile } = useAuthContext();
  const { loading, counting, matchCount, error, countMatchingEntries, generateExport } = useJournalExport();

  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...ALL_ENTRY_TYPES]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [includeRouting, setIncludeRouting] = useState(true);
  const [includeSource, setIncludeSource] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildFilters = useCallback((): ExportFilters => {
    let dateRange: ExportFilters['dateRange'] = null;

    if (datePreset === 'custom' && customStart && customEnd) {
      dateRange = {
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd + 'T23:59:59').toISOString(),
      };
    } else if (datePreset !== 'custom' && datePreset !== 'all_time') {
      dateRange = getPresetDateRange(datePreset);
    }

    return {
      dateRange,
      entryTypes: selectedTypes,
      lifeAreas: selectedAreas,
      includeRouting,
      includeSource,
    };
  }, [datePreset, customStart, customEnd, selectedTypes, selectedAreas, includeRouting, includeSource]);

  // Debounced count update when filters change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      countMatchingEntries(buildFilters());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, buildFilters, countMatchingEntries]);

  const handleTypeToggle = useCallback((type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const handleAreaToggle = useCallback((area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    const userName = profile?.display_name || 'Steward';
    await generateExport(buildFilters(), userName);
  }, [buildFilters, generateExport, profile?.display_name]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="journal-export-overlay" onClick={handleBackdropClick}>
      <div className="journal-export-modal">
        {/* Header */}
        <div className="journal-export-modal__header">
          <h2 className="journal-export-modal__title">Export Journal</h2>
          <button
            type="button"
            className="journal-export-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="journal-export-modal__body">
          {/* Date Range */}
          <div className="journal-export-section">
            <p className="journal-export-section__label">Date Range</p>
            <div className="journal-export-presets">
              {([
                ['last_month', 'Last Month'],
                ['last_3_months', 'Last 3 Months'],
                ['this_year', 'This Year'],
                ['all_time', 'All Time'],
                ['custom', 'Custom'],
              ] as [DatePreset, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`journal-export-preset${datePreset === key ? ' journal-export-preset--active' : ''}`}
                  onClick={() => setDatePreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="journal-export-dates">
                <input
                  type="date"
                  className="journal-export-dates__input"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  max={customEnd || toDateInputValue(new Date())}
                />
                <span className="journal-export-dates__sep">to</span>
                <input
                  type="date"
                  className="journal-export-dates__input"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  min={customStart}
                  max={toDateInputValue(new Date())}
                />
              </div>
            )}
          </div>

          {/* Entry Types */}
          <div className="journal-export-section">
            <p className="journal-export-section__label">Entry Types</p>
            <div className="journal-export-checks">
              {ALL_ENTRY_TYPES.map(type => (
                <label key={type} className="journal-export-check">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => handleTypeToggle(type)}
                  />
                  {LOG_ENTRY_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          {/* Life Areas */}
          <div className="journal-export-section">
            <p className="journal-export-section__label">Life Areas (leave empty for all)</p>
            <div className="journal-export-checks">
              {ALL_LIFE_AREAS.map(area => (
                <label key={area} className="journal-export-check">
                  <input
                    type="checkbox"
                    checked={selectedAreas.includes(area)}
                    onChange={() => handleAreaToggle(area)}
                  />
                  {LIFE_AREA_LABELS[area]}
                </label>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="journal-export-section">
            <p className="journal-export-section__label">Options</p>
            <div className="journal-export-toggles">
              <label className="journal-export-check">
                <input
                  type="checkbox"
                  checked={includeRouting}
                  onChange={() => setIncludeRouting(v => !v)}
                />
                Include routing information
              </label>
              <label className="journal-export-check">
                <input
                  type="checkbox"
                  checked={includeSource}
                  onChange={() => setIncludeSource(v => !v)}
                />
                Include source labels
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="journal-export-modal__footer">
          <div className={`journal-export-match-count${counting ? ' journal-export-match-count--loading' : ''}`}>
            {counting
              ? 'Counting...'
              : matchCount !== null
                ? `${matchCount} ${matchCount === 1 ? 'entry' : 'entries'} match your filters`
                : ''}
          </div>

          {error && <div className="journal-export-error">{error}</div>}

          <Button
            onClick={handleGenerate}
            disabled={loading || matchCount === 0}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                Generating PDF...
              </>
            ) : (
              'Generate PDF'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
