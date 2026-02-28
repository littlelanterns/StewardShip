import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { LoadingSpinner } from '../shared';
import { useHatchContext } from '../../contexts/HatchContext';
import HatchHistoryItem from './HatchHistoryItem';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import type {
  HatchTab,
  HatchTabStatus,
  HatchRoutingDestination,
  HatchHistoryFilters,
} from '../../lib/types';
import './HatchHistory.css';

export default function HatchHistory() {
  const { getHistory, reopenTab, deleteHistoryItem, openHatch } =
    useHatchContext();

  const [items, setItems] = useState<HatchTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HatchTabStatus | 'all'>(
    'all',
  );
  const [destFilter, setDestFilter] = useState<
    HatchRoutingDestination | 'all'
  >('all');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'title'>(
    'updated_at',
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const filters: HatchHistoryFilters = {
        sortBy,
        sortOrder: 'desc',
      };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (destFilter !== 'all') filters.destination = destFilter;
      if (searchQuery.trim()) filters.searchQuery = searchQuery.trim();

      const data = await getHistory(filters);
      setItems(data);
    } catch {
      // Load failure — show empty
    } finally {
      setLoading(false);
    }
  }, [getHistory, statusFilter, destFilter, searchQuery, sortBy]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleReopen = useCallback(
    async (tabId: string) => {
      const newTab = await reopenTab(tabId);
      if (newTab) {
        openHatch();
      }
    },
    [reopenTab, openHatch],
  );

  const handleDelete = useCallback(
    async (tabId: string) => {
      await deleteHistoryItem(tabId);
      setItems((prev) => prev.filter((i) => i.id !== tabId));
    },
    [deleteHistoryItem],
  );

  return (
    <div className="hatch-history">
      <div className="hatch-history__toolbar">
        <div className="hatch-history__search">
          <Search size={14} className="hatch-history__search-icon" />
          <input
            type="text"
            className="hatch-history__search-input"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`hatch-history__filter-toggle${showFilters ? ' hatch-history__filter-toggle--active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {showFilters && (
        <div className="hatch-history__filters">
          <div className="hatch-history__filter-group">
            <label className="hatch-history__filter-label">Status</label>
            <select
              className="hatch-history__filter-select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as HatchTabStatus | 'all')
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="routed">Routed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="hatch-history__filter-group">
            <label className="hatch-history__filter-label">Destination</label>
            <select
              className="hatch-history__filter-select"
              value={destFilter}
              onChange={(e) =>
                setDestFilter(
                  e.target.value as HatchRoutingDestination | 'all',
                )
              }
            >
              <option value="all">All</option>
              {(
                Object.entries(HATCH_DESTINATION_CONFIG) as [
                  HatchRoutingDestination,
                  (typeof HATCH_DESTINATION_CONFIG)[HatchRoutingDestination],
                ][]
              ).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hatch-history__filter-group">
            <label className="hatch-history__filter-label">Sort by</label>
            <select
              className="hatch-history__filter-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'updated_at' | 'created_at' | 'title',
                )
              }
            >
              <option value="updated_at">Last modified</option>
              <option value="created_at">Date created</option>
              <option value="title">Name</option>
            </select>
          </div>
        </div>
      )}

      <div className="hatch-history__list">
        {loading ? (
          <div className="hatch-history__loading">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <p className="hatch-history__empty">
            {searchQuery || statusFilter !== 'all' || destFilter !== 'all'
              ? 'No items match your filters.'
              : 'No history yet. Captured content will appear here.'}
          </p>
        ) : (
          items.map((item) => (
            <HatchHistoryItem
              key={item.id}
              tab={item}
              onReopen={handleReopen}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
