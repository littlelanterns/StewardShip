import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, StickyNote, MessageSquare, Loader } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { useFrameworks } from '../hooks/useFrameworks';
import { useMast } from '../hooks/useMast';
import { useKeel } from '../hooks/useKeel';
import { useHelmContext } from '../contexts/HelmContext';
import type { ManifestItem, ManifestFileType, ManifestUsageDesignation, MastEntryType, KeelCategory } from '../lib/types';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { ManifestFilterBar } from '../components/manifest/ManifestFilterBar';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { IntakeFlow } from '../components/manifest/IntakeFlow';
import { TextNoteModal } from '../components/manifest/TextNoteModal';
import FrameworkPrinciples from '../components/manifest/FrameworkPrinciples';
import MastExtractionReview from '../components/manifest/MastExtractionReview';
import KeelExtractionReview from '../components/manifest/KeelExtractionReview';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { EmptyState, LoadingSpinner } from '../components/shared';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload' | 'intake' | 'framework' | 'mast_extract' | 'keel_extract';

export default function Manifest() {
  usePageContext({ page: 'manifest' });
  const { startGuidedConversation } = useHelmContext();
  const {
    items,
    loading,
    fetchItems,
    uploadFile,
    createTextNote,
    updateItem,
    reprocessItem,
    archiveItem,
    deleteItem,
    pollProcessingStatus,
    runIntake,
    applyIntake,
    getUniqueTags,
    getUniqueFolders,
    fetchItemDetail,
    checkDuplicate,
  } = useManifest();

  const {
    extracting,
    extractFramework,
    extractMast,
    extractKeel,
    saveFramework,
    toggleFramework,
    getFrameworkForItem,
    fetchFrameworks,
  } = useFrameworks();

  const mast = useMast();
  const keel = useKeel();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [intakeItemId, setIntakeItemId] = useState<string | null>(null);
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Extraction state
  const [mastExtractionResults, setMastExtractionResults] = useState<Array<{ text: string; entry_type: string }> | null>(null);
  const [keelExtractionResults, setKeelExtractionResults] = useState<Array<{ category: string; text: string }> | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<ManifestFileType | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<ManifestUsageDesignation | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    fetchFrameworks();
  }, [fetchItems, fetchFrameworks]);

  // Poll for processing items
  useEffect(() => {
    const processingItems = items.filter(
      (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
    );
    processingItems.forEach((item) => {
      pollProcessingStatus(item.id);
    });
  }, [items, pollProcessingStatus]);

  // Check if any items just completed processing and need intake
  useEffect(() => {
    const needsIntake = items.find(
      (i) => i.processing_status === 'completed' && !i.intake_completed && i.id === intakeItemId,
    );
    if (needsIntake && viewMode === 'list') {
      setSelectedItem(needsIntake);
      setViewMode('intake');
    }
  }, [items, intakeItemId, viewMode]);

  const handleSelectItem = useCallback(async (item: ManifestItem) => {
    const detail = await fetchItemDetail(item.id);
    setSelectedItem(detail || item);
    setViewMode('detail');
  }, [fetchItemDetail]);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setMastExtractionResults(null);
    setKeelExtractionResults(null);
    setViewMode('list');
    fetchItems();
  }, [fetchItems]);

  const handleBackToDetail = useCallback(() => {
    setMastExtractionResults(null);
    setKeelExtractionResults(null);
    setViewMode('detail');
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const item = await uploadFile(file);
    if (item) {
      setIntakeItemId(item.id);
      pollProcessingStatus(item.id);
    }
    return item;
  }, [uploadFile, pollProcessingStatus]);

  const handleTextNote = useCallback(async (title: string, content: string) => {
    const item = await createTextNote(title, content);
    if (item) {
      setIntakeItemId(item.id);
      pollProcessingStatus(item.id);
    }
    return item;
  }, [createTextNote, pollProcessingStatus]);

  const handleIntakeApply = useCallback(async (
    itemId: string,
    intake: { tags: string[]; folder_group: string; usage_designations: ManifestUsageDesignation[] },
  ) => {
    const result = await applyIntake(itemId, intake);
    if (result) {
      setIntakeItemId(null);
      setViewMode('list');
      setSelectedItem(null);
      fetchItems();
    }
    return result;
  }, [applyIntake, fetchItems]);

  const handleIntakeSkip = useCallback(() => {
    if (intakeItemId) {
      updateItem(intakeItemId, { intake_completed: true });
    }
    setIntakeItemId(null);
    setViewMode('list');
    setSelectedItem(null);
  }, [intakeItemId, updateItem]);

  const handleAskLibrary = useCallback(() => {
    setFabExpanded(false);
    startGuidedConversation('manifest_discuss');
  }, [startGuidedConversation]);

  // Extraction handlers
  const handleExtractFramework = useCallback(() => {
    if (selectedItem) {
      setViewMode('framework');
    }
  }, [selectedItem]);

  const handleExtractMast = useCallback(async () => {
    if (!selectedItem) return;
    setViewMode('mast_extract');
    const results = await extractMast(selectedItem.id);
    setMastExtractionResults(results);
  }, [selectedItem, extractMast]);

  const handleExtractKeel = useCallback(async () => {
    if (!selectedItem) return;
    setViewMode('keel_extract');
    const results = await extractKeel(selectedItem.id);
    setKeelExtractionResults(results);
  }, [selectedItem, extractKeel]);

  const handleSaveMastEntries = useCallback(async (
    entries: Array<{ type: MastEntryType; text: string; source: 'manifest_extraction' }>,
  ) => {
    for (const entry of entries) {
      await mast.createEntry({
        type: entry.type,
        text: entry.text,
        source: 'manifest_extraction',
      });
    }
    handleBackToDetail();
  }, [mast, handleBackToDetail]);

  const handleSaveKeelEntries = useCallback(async (
    entries: Array<{ category: KeelCategory; text: string; source: string; source_type: 'manifest_extraction' }>,
  ) => {
    for (const entry of entries) {
      await keel.createEntry({
        category: entry.category,
        text: entry.text,
        source: entry.source,
        source_type: 'manifest_extraction',
      });
    }
    handleBackToDetail();
  }, [keel, handleBackToDetail]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.file_type !== typeFilter) return false;
      if (usageFilter !== 'all' && !item.usage_designations.includes(usageFilter)) return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, typeFilter, usageFilter, tagFilter]);

  // Group by folder
  const folderGroups = useMemo(() => {
    const groups: Record<string, ManifestItem[]> = {};
    for (const item of filteredItems) {
      const folder = item.folder_group || 'Uncategorized';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const uniqueTags = useMemo(() => getUniqueTags(), [getUniqueTags]);
  const uniqueFolders = useMemo(() => getUniqueFolders(), [getUniqueFolders]);

  const hasCompletedItems = items.some((i) => i.processing_status === 'completed');
  const hasProcessingItems = items.some(
    (i) => i.processing_status === 'pending' || i.processing_status === 'processing',
  );

  // Upload view
  if (viewMode === 'upload') {
    return (
      <div className="page manifest-page">
        <UploadFlow
          onUpload={handleUpload}
          onCheckDuplicate={checkDuplicate}
          onClose={handleBack}
        />
      </div>
    );
  }

  // Intake view
  if (viewMode === 'intake' && selectedItem) {
    return (
      <div className="page manifest-page">
        <IntakeFlow
          item={selectedItem}
          onRunIntake={runIntake}
          onApplyIntake={handleIntakeApply}
          onSkip={handleIntakeSkip}
          existingFolders={uniqueFolders}
        />
      </div>
    );
  }

  // Framework extraction view
  if (viewMode === 'framework' && selectedItem) {
    return (
      <div className="page manifest-page">
        <FrameworkPrinciples
          manifestItemId={selectedItem.id}
          manifestItemTitle={selectedItem.title}
          framework={getFrameworkForItem(selectedItem.id)}
          extracting={extracting}
          onExtract={extractFramework}
          onSave={saveFramework}
          onToggle={toggleFramework}
          onBack={handleBackToDetail}
        />
      </div>
    );
  }

  // Mast extraction review
  if (viewMode === 'mast_extract' && selectedItem) {
    return (
      <div className="page manifest-page">
        <MastExtractionReview
          sourceTitle={selectedItem.title}
          entries={mastExtractionResults}
          extracting={extracting}
          onSave={handleSaveMastEntries}
          onCancel={handleBackToDetail}
        />
      </div>
    );
  }

  // Keel extraction review
  if (viewMode === 'keel_extract' && selectedItem) {
    return (
      <div className="page manifest-page">
        <KeelExtractionReview
          sourceTitle={selectedItem.title}
          entries={keelExtractionResults}
          extracting={extracting}
          onSave={handleSaveKeelEntries}
          onCancel={handleBackToDetail}
        />
      </div>
    );
  }

  // Detail view
  if (viewMode === 'detail' && selectedItem) {
    return (
      <div className="page manifest-page">
        <ManifestItemDetail
          item={selectedItem}
          onBack={handleBack}
          onUpdateItem={updateItem}
          onReprocess={reprocessItem}
          onArchive={archiveItem}
          onDelete={deleteItem}
          onExtractFramework={handleExtractFramework}
          onExtractMast={handleExtractMast}
          onExtractKeel={handleExtractKeel}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="page manifest-page">
      <div className="manifest-page__header">
        <h1 className="manifest-page__title">The Manifest</h1>
        <p className="manifest-page__subtitle">Your personal knowledge base</p>
      </div>

      {/* Action buttons */}
      <div className="manifest-page__actions">
        <button
          type="button"
          className="manifest-page__action-btn manifest-page__action-btn--primary"
          onClick={() => setViewMode('upload')}
        >
          <Upload size={16} />
          Upload
        </button>
        <button
          type="button"
          className="manifest-page__action-btn"
          onClick={() => setShowTextNoteModal(true)}
        >
          <StickyNote size={16} />
          Add Note
        </button>
        {hasCompletedItems && (
          <button
            type="button"
            className="manifest-page__action-btn"
            onClick={handleAskLibrary}
          >
            <MessageSquare size={16} />
            Ask Your Library
          </button>
        )}
      </div>

      {/* Processing indicator */}
      {hasProcessingItems && (
        <div className="manifest-page__processing">
          <Loader size={14} className="manifest-page__processing-spin" />
          <span>Processing items...</span>
        </div>
      )}

      {/* Filter bar */}
      {items.length > 0 && (
        <ManifestFilterBar
          typeFilter={typeFilter}
          usageFilter={usageFilter}
          tagFilter={tagFilter}
          uniqueTags={uniqueTags}
          onTypeChange={setTypeFilter}
          onUsageChange={setUsageFilter}
          onTagChange={setTagFilter}
        />
      )}

      {/* Content */}
      {loading && items.length === 0 ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          heading="Your library is empty"
          message="Upload books, articles, notes, and transcripts. The AI draws from your library to give you advice grounded in the wisdom you trust."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          heading="No matching items"
          message="Try adjusting your filters to see more items."
        />
      ) : folderGroups.length === 1 ? (
        <div className="manifest-page__item-list">
          {folderGroups[0][1].map((item) => (
            <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} />
          ))}
        </div>
      ) : (
        folderGroups.map(([folder, folderItems]) => (
          <CollapsibleGroup
            key={folder}
            label={folder}
            count={folderItems.length}
            defaultExpanded
          >
            <div className="manifest-page__item-list">
              {folderItems.map((item) => (
                <ManifestItemCard key={item.id} item={item} onClick={handleSelectItem} />
              ))}
            </div>
          </CollapsibleGroup>
        ))
      )}

      {/* FAB */}
      <div className="manifest-page__fab-area">
        {fabExpanded && (
          <div className="manifest-page__fab-options">
            <button
              type="button"
              className="manifest-page__fab-option"
              onClick={() => { setFabExpanded(false); setViewMode('upload'); }}
            >
              Upload File
            </button>
            <button
              type="button"
              className="manifest-page__fab-option"
              onClick={() => { setFabExpanded(false); setShowTextNoteModal(true); }}
            >
              Add Text Note
            </button>
          </div>
        )}
        <FloatingActionButton onClick={() => setFabExpanded(!fabExpanded)}>
          {fabExpanded ? 'Close' : '+'}
        </FloatingActionButton>
      </div>

      {/* Text Note Modal */}
      {showTextNoteModal && (
        <TextNoteModal
          onSave={handleTextNote}
          onClose={() => setShowTextNoteModal(false)}
        />
      )}
    </div>
  );
}
