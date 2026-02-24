import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, StickyNote, MessageSquare, Loader } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { useHelmContext } from '../contexts/HelmContext';
import type { ManifestItem, ManifestFileType, ManifestUsageDesignation } from '../lib/types';
import { ManifestItemCard } from '../components/manifest/ManifestItemCard';
import { ManifestItemDetail } from '../components/manifest/ManifestItemDetail';
import { ManifestFilterBar } from '../components/manifest/ManifestFilterBar';
import { UploadFlow } from '../components/manifest/UploadFlow';
import { IntakeFlow } from '../components/manifest/IntakeFlow';
import { TextNoteModal } from '../components/manifest/TextNoteModal';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { EmptyState, LoadingSpinner } from '../components/shared';
import './Manifest.css';

type ViewMode = 'list' | 'detail' | 'upload' | 'intake';

export default function Manifest() {
  usePageContext({ page: 'manifest' });
  const navigate = useNavigate();
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

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedItem, setSelectedItem] = useState<ManifestItem | null>(null);
  const [intakeItemId, setIntakeItemId] = useState<string | null>(null);
  const [showTextNoteModal, setShowTextNoteModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<ManifestFileType | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<ManifestUsageDesignation | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
    setViewMode('list');
    fetchItems();
  }, [fetchItems]);

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
    navigate('/helm');
  }, [startGuidedConversation, navigate]);

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
