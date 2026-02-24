import { useEffect, useState, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useLog } from '../hooks/useLog';
import type { LogFilters, LogEntryType, LogEntry } from '../lib/types';
import { FloatingActionButton, LoadingSpinner, EmptyState, Button } from '../components/shared';
import LogFilterBar from '../components/log/LogFilterBar';
import LogEntryCard from '../components/log/LogEntryCard';
import CreateEntry from '../components/log/CreateEntry';
import EntryDetail from '../components/log/EntryDetail';
import LogArchivedView from '../components/log/LogArchivedView';
import './Log.css';

type LogView = 'list' | 'create' | 'detail' | 'archived';

const DEFAULT_FILTERS: LogFilters = {
  entryType: null,
  lifeAreaTag: null,
  dateRange: 'all',
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  relatedWheelId: null,
  relatedRiggingPlanId: null,
};

export default function Log() {
  usePageContext({ page: 'log' });

  const {
    entries,
    archivedEntries,
    selectedEntry,
    loading,
    archiveLoading,
    hasMore,
    fetchEntries,
    fetchEntry,
    createEntry,
    updateEntry,
    archiveEntry,
    restoreEntry,
    fetchArchivedEntries,
    updateRouting,
    setSelectedEntry,
  } = useLog();

  const [view, setView] = useState<LogView>('list');
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [createType, setCreateType] = useState<LogEntryType | undefined>(undefined);

  // Load entries on mount and when filters change
  useEffect(() => {
    fetchEntries(filters, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    fetchEntries(filters, entries.length);
  }, [fetchEntries, filters, entries.length]);

  const handleEntryClick = useCallback(async (entry: LogEntry) => {
    await fetchEntry(entry.id);
    setView('detail');
  }, [fetchEntry]);

  const handleCreate = useCallback(() => {
    setCreateType(undefined);
    setView('create');
  }, []);

  const handleSave = useCallback(async (text: string, type: LogEntryType, tags: string[]) => {
    return await createEntry(text, type, tags);
  }, [createEntry]);

  const handleRouted = useCallback(async (entryId: string, target: string, referenceId: string) => {
    await updateRouting(entryId, target, referenceId);
  }, [updateRouting]);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedEntry(null);
    fetchEntries(filters, 0);
  }, [setSelectedEntry, fetchEntries, filters]);

  if (view === 'create') {
    return (
      <div className="page log-page">
        <CreateEntry
          initialType={createType}
          onSave={handleSave}
          onRouted={handleRouted}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  if (view === 'detail' && selectedEntry) {
    return (
      <div className="page log-page">
        <EntryDetail
          entry={selectedEntry}
          onUpdate={updateEntry}
          onArchive={archiveEntry}
          onRouted={handleRouted}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  if (view === 'archived') {
    return (
      <div className="page log-page">
        <LogArchivedView
          entries={archivedEntries}
          loading={archiveLoading}
          onRestore={restoreEntry}
          onLoad={fetchArchivedEntries}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="page log-page">
      <div className="log-page__header">
        <h1 className="log-page__title">The Log</h1>
        <p className="log-page__subtitle">A record of the voyage.</p>
      </div>

      <LogFilterBar filters={filters} onFiltersChange={setFilters} />

      {loading && entries.length === 0 ? (
        <div className="log-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          heading="Your Log is empty"
          message="Start capturing your journey. Thoughts, observations, gratitude, reflections — anything worth recording."
        />
      ) : (
        <div className="log-page__entries">
          {entries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              entry={entry}
              onClick={() => handleEntryClick(entry)}
            />
          ))}

          {hasMore && (
            <div className="log-page__load-more">
              <Button variant="text" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="log-page__footer">
        <button
          type="button"
          className="log-page__archived-link"
          onClick={() => setView('archived')}
        >
          View Archived
        </button>
      </div>

      <FloatingActionButton onClick={handleCreate} aria-label="New Entry">+</FloatingActionButton>
    </div>
  );
}
