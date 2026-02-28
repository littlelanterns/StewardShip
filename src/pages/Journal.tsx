import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useJournal } from '../hooks/useJournal';
import type { JournalFilters, JournalEntryType, JournalEntry } from '../lib/types';
import { FloatingActionButton, LoadingSpinner, EmptyState, Button, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import JournalFilterBar from '../components/journal/JournalFilterBar';
import JournalEntryCard from '../components/journal/JournalEntryCard';
import CreateEntry from '../components/journal/CreateEntry';
import EntryDetail from '../components/journal/EntryDetail';
import JournalArchivedView from '../components/journal/JournalArchivedView';
import JournalExportModal from '../components/journal/JournalExportModal';
import './Journal.css';

type JournalView = 'list' | 'create' | 'detail' | 'archived';

const DEFAULT_FILTERS: JournalFilters = {
  entryType: null,
  lifeAreaTag: null,
  dateRange: 'all',
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  relatedWheelId: null,
  relatedRiggingPlanId: null,
};

export default function Journal() {
  usePageContext({ page: 'journal' });

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
    permanentlyDelete,
    fetchArchivedEntries,
    updateRouting,
    setSelectedEntry,
  } = useJournal();

  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<JournalView>('list');
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_FILTERS);
  const [createType, setCreateType] = useState<JournalEntryType | undefined>(undefined);
  const [showExportModal, setShowExportModal] = useState(false);

  // Auto-open export modal from deep link (?export=true)
  useEffect(() => {
    if (searchParams.get('export') === 'true') {
      setShowExportModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load entries on mount and when filters change
  useEffect(() => {
    fetchEntries(filters, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    fetchEntries(filters, entries.length);
  }, [fetchEntries, filters, entries.length]);

  const handleEntryClick = useCallback(async (entry: JournalEntry) => {
    await fetchEntry(entry.id);
    setView('detail');
  }, [fetchEntry]);

  const handleCreate = useCallback(() => {
    setCreateType(undefined);
    setView('create');
  }, []);

  const handleSave = useCallback(async (text: string, type: JournalEntryType, tags: string[]) => {
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
      <div className="page journal-page">
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
      <div className="page journal-page">
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
      <div className="page journal-page">
        <JournalArchivedView
          entries={archivedEntries}
          loading={archiveLoading}
          onRestore={restoreEntry}
          onDelete={permanentlyDelete}
          onLoad={fetchArchivedEntries}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="page journal-page">
      <div className="journal-page__header">
        <div className="journal-page__header-row">
          <div>
            <h1 className="journal-page__title">The Journal</h1>
            <p className="journal-page__subtitle">Your personal writings and collected wisdom.</p>
          </div>
          <button
            type="button"
            className="journal-page__export-btn"
            onClick={() => setShowExportModal(true)}
            aria-label="Export journal as PDF"
            title="Export as PDF"
          >
            <Download size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.journal} />

      <JournalFilterBar filters={filters} onFiltersChange={setFilters} />

      {loading && entries.length === 0 ? (
        <div className="journal-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          heading="Your Journal is empty"
          message="Start capturing your journey. Thoughts, observations, gratitude, reflections — anything worth recording."
        />
      ) : (
        <div className="journal-page__entries">
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onClick={() => handleEntryClick(entry)}
            />
          ))}

          {hasMore && (
            <div className="journal-page__load-more">
              <Button variant="text" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="journal-page__footer">
        <button
          type="button"
          className="journal-page__archived-link"
          onClick={() => setView('archived')}
        >
          View Archived
        </button>
      </div>

      <FloatingActionButton onClick={handleCreate} aria-label="New Entry">
        <Plus size={24} />
      </FloatingActionButton>

      <JournalExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
