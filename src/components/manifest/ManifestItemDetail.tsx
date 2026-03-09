import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, FileText, FileCode, Mic, Image, StickyNote, RefreshCw, BookOpen, Wand2, MessageSquare, Target, HelpCircle, CheckSquare, BarChart3, Users } from 'lucide-react';
import type { ManifestItem, ManifestSummary, ManifestDeclaration, ManifestActionStep, AIFrameworkPrinciple, BookGenre, DiscussionType } from '../../lib/types';
import { MANIFEST_FILE_TYPE_LABELS, MANIFEST_STATUS_LABELS } from '../../lib/types';
import type { SectionInfo } from '../../hooks/useManifestExtraction';
import { supabase } from '../../lib/supabase';
import { Button, LoadingSpinner } from '../shared';
import { GenrePicker } from './GenrePicker';
import { ExtractionTabs } from './ExtractionTabs';
import './ManifestItemDetail.css';

type ExtractionPhase = 'idle' | 'discovering' | 'selecting' | 'extracting';

interface ManifestItemDetailProps {
  item: ManifestItem;
  onBack: () => void;
  onUpdateItem: (id: string, updates: Partial<Pick<ManifestItem, 'title' | 'tags' | 'usage_designations' | 'folder_group' | 'text_content' | 'intake_completed'>>) => Promise<boolean>;
  onReprocess: (id: string) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onEnrichItem?: (itemId: string, regenerateTags?: boolean) => Promise<{ summary: string; tags?: string[] } | null>;
  // Extraction
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps: ManifestActionStep[];
  principles: AIFrameworkPrinciple[];
  extracting: boolean;
  extractingTab: string | null;
  hasFramework: boolean;
  onExtractAll: (genres: BookGenre[]) => Promise<boolean>;
  onExtractAllSections: (genres: BookGenre[], sectionIndices: number[]) => Promise<boolean>;
  onUpdateGenres: (itemId: string, genres: BookGenre[]) => Promise<boolean>;
  onFetchSummaries: (itemId: string) => void;
  onFetchDeclarations: (itemId: string) => void;
  onFetchActionSteps: (itemId: string) => void;
  // Section discovery
  onDiscoverSections: (itemId: string) => Promise<SectionInfo[] | null>;
  sections: SectionInfo[];
  selectedSectionIndices: number[];
  onSetSelectedSectionIndices: (indices: number[]) => void;
  discoveringSections: boolean;
  extractionProgress: { current: number; total: number; currentType: 'summary' | 'framework' | 'mast_content' | 'action_steps' } | null;
  onClearExtractions: (itemId: string) => Promise<void>;
  // Summary actions
  onToggleSummaryHeart: (id: string) => void;
  onDeleteSummary: (id: string) => void;
  onUpdateSummaryText: (id: string, text: string) => void;
  onSummaryGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onSummaryReRun: (sectionTitle?: string) => void;
  // Framework actions
  onTogglePrincipleHeart: (id: string) => void;
  onDeletePrinciple: (id: string) => void;
  // Declaration actions
  onToggleDeclarationHeart: (id: string) => void;
  onDeleteDeclaration: (id: string) => void;
  onUpdateDeclaration: (id: string, updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>) => void;
  onSendDeclarationToMast: (id: string) => void;
  onDeclarationGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onDeclarationReRun: (sectionTitle?: string) => void;
  // Action Step actions
  onToggleActionStepHeart: (id: string) => void;
  onDeleteActionStep: (id: string) => void;
  onUpdateActionStepText: (id: string, text: string) => void;
  onSendActionStepToCompass: (id: string) => void;
  onActionStepGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onActionStepReRun: (sectionTitle?: string) => void;
  // Discussion
  onOpenDiscussion?: (type: DiscussionType) => void;
}

const FILE_TYPE_ICONS = {
  pdf: FileText,
  epub: BookOpen,
  docx: FileText,
  txt: FileText,
  md: FileCode,
  audio: Mic,
  image: Image,
  text_note: StickyNote,
} as const;

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ManifestItemDetail({
  item,
  onBack,
  onUpdateItem,
  onReprocess,
  onArchive,
  onDelete,
  onEnrichItem,
  summaries,
  declarations,
  actionSteps,
  principles,
  extracting,
  extractingTab,
  hasFramework,
  onExtractAll: _onExtractAll,
  onExtractAllSections,
  onUpdateGenres,
  onFetchSummaries,
  onFetchDeclarations,
  onFetchActionSteps,
  onDiscoverSections,
  sections,
  selectedSectionIndices,
  onSetSelectedSectionIndices,
  discoveringSections,
  extractionProgress,
  onClearExtractions,
  onToggleSummaryHeart,
  onDeleteSummary,
  onUpdateSummaryText,
  onSummaryGoDeeper,
  onSummaryReRun,
  onTogglePrincipleHeart,
  onDeletePrinciple,
  onToggleDeclarationHeart,
  onDeleteDeclaration,
  onUpdateDeclaration,
  onSendDeclarationToMast,
  onDeclarationGoDeeper,
  onDeclarationReRun,
  onToggleActionStepHeart,
  onDeleteActionStep,
  onUpdateActionStepText,
  onSendActionStepToCompass,
  onActionStepGoDeeper,
  onActionStepReRun,
  onOpenDiscussion,
}: ManifestItemDetailProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(item.text_content || '');
  const [contentExpanded, setContentExpanded] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Genre state — local copy synced to item
  const [selectedGenres, setSelectedGenres] = useState<BookGenre[]>(item.genres || []);
  const [showGenrePicker, setShowGenrePicker] = useState(false);

  // Extraction phase state
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>('idle');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushDone, setPushDone] = useState(false);
  const [confirmPush, setConfirmPush] = useState(false);

  const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
  const isProcessed = item.processing_status === 'completed';
  const hasExtraction = item.extraction_status !== 'none' || summaries.length > 0 || declarations.length > 0 || actionSteps.length > 0 || principles.length > 0;

  // Fetch existing extractions on mount
  useEffect(() => {
    if (isProcessed) {
      onFetchSummaries(item.id);
      onFetchDeclarations(item.id);
      onFetchActionSteps(item.id);
    }
  }, [item.id, isProcessed, onFetchSummaries, onFetchDeclarations, onFetchActionSteps]);

  const saveTitle = useCallback(() => {
    if (titleDraft.trim() && titleDraft.trim() !== item.title) {
      onUpdateItem(item.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }, [titleDraft, item.id, item.title, onUpdateItem]);

  const saveContent = useCallback(() => {
    if (contentDraft !== item.text_content) {
      onUpdateItem(item.id, { text_content: contentDraft });
    }
    setEditingContent(false);
  }, [contentDraft, item.id, item.text_content, onUpdateItem]);

  const handleRemoveTag = useCallback((tag: string) => {
    onUpdateItem(item.id, { tags: item.tags.filter((t) => t !== tag) });
  }, [item.id, item.tags, onUpdateItem]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag && !item.tags.includes(tag)) {
      onUpdateItem(item.id, { tags: [...item.tags, tag] });
    }
    setTagInput('');
    setAddingTag(false);
  }, [tagInput, item.id, item.tags, onUpdateItem]);

  const handleReprocess = useCallback(async () => {
    setReprocessing(true);
    await onReprocess(item.id);
    setReprocessing(false);
  }, [item.id, onReprocess]);

  const handleDelete = useCallback(async () => {
    await onDelete(item.id);
    onBack();
  }, [item.id, onDelete, onBack]);

  const handleArchive = useCallback(async () => {
    await onArchive(item.id);
    onBack();
  }, [item.id, onArchive, onBack]);

  const handleRegenerate = useCallback(async () => {
    if (!onEnrichItem || enriching) return;
    setEnriching(true);
    try {
      await onEnrichItem(item.id, true);
    } finally {
      setEnriching(false);
    }
  }, [onEnrichItem, item.id, enriching]);

  const handleGenreChange = useCallback((genres: BookGenre[]) => {
    setSelectedGenres(genres);
    onUpdateGenres(item.id, genres);
  }, [item.id, onUpdateGenres]);

  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (selectedGenres.length === 0) {
      setShowGenrePicker(true);
      return;
    }
    // Discover sections first — never fall back to whole-document silently
    setExtractionPhase('discovering');
    setDiscoveryError(null);
    const discovered = await onDiscoverSections(item.id);
    if (discovered && discovered.length > 0) {
      setExtractionPhase('selecting');
    } else {
      // Discovery failed — show error, don't silently fall back
      setExtractionPhase('idle');
      setDiscoveryError('Section discovery failed. Please try again.');
    }
  }, [selectedGenres, item.id, onDiscoverSections]);

  const handleExtractSelected = useCallback(async () => {
    setExtractionPhase('extracting');
    await onExtractAllSections(selectedGenres, selectedSectionIndices);
    setExtractionPhase('idle');
  }, [selectedGenres, selectedSectionIndices, onExtractAllSections]);

  const handleToggleSection = useCallback((index: number) => {
    onSetSelectedSectionIndices(
      selectedSectionIndices.includes(index)
        ? selectedSectionIndices.filter((i) => i !== index)
        : [...selectedSectionIndices, index].sort((a, b) => a - b),
    );
  }, [selectedSectionIndices, onSetSelectedSectionIndices]);

  const handleToggleAllSections = useCallback(() => {
    if (selectedSectionIndices.length === sections.length) {
      onSetSelectedSectionIndices([]);
    } else {
      onSetSelectedSectionIndices(sections.map((_, i) => i));
    }
  }, [selectedSectionIndices.length, sections, onSetSelectedSectionIndices]);

  const handleClearExtractions = useCallback(async () => {
    setClearing(true);
    await onClearExtractions(item.id);
    setClearing(false);
    setConfirmClear(false);
    setExtractionPhase('idle');
    setDiscoveryError(null);
  }, [item.id, onClearExtractions]);

  const handlePushToFamily = useCallback(async () => {
    setPushing(true);
    setConfirmPush(false);
    try {
      const { error: invokeErr } = await supabase.functions.invoke('manifest-clone', {
        body: {
          manifest_item_id: item.id,
          clone_extractions: true,
          force_update: true,
        },
      });
      if (invokeErr) throw invokeErr;
      setPushDone(true);
      setTimeout(() => setPushDone(false), 3000);
    } catch (err) {
      console.error('Push to family failed:', err);
    } finally {
      setPushing(false);
    }
  }, [item.id]);

  return (
    <div className="manifest-detail">
      <button type="button" className="manifest-detail__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="manifest-detail__header">
        <div className="manifest-detail__icon-wrap">
          <Icon size={24} />
        </div>
        <div className="manifest-detail__header-info">
          {editingTitle ? (
            <input
              type="text"
              className="manifest-detail__title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleDraft(item.title); setEditingTitle(false); }
              }}
              autoFocus
            />
          ) : (
            <h2
              className="manifest-detail__title"
              onClick={() => setEditingTitle(true)}
              title="Click to edit"
            >
              {item.title}
            </h2>
          )}

          <div className="manifest-detail__meta">
            <span>{MANIFEST_FILE_TYPE_LABELS[item.file_type]}</span>
            {item.file_size_bytes && <span>{formatFileSize(item.file_size_bytes)}</span>}
            <span>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className={`manifest-detail__status manifest-detail__status--${item.processing_status}`}>
              {MANIFEST_STATUS_LABELS[item.processing_status]}
            </span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <section className="manifest-detail__section">
        <h3 className="manifest-detail__section-title">Tags</h3>
        <div className="manifest-detail__tags">
          {item.tags.map((tag) => (
            <span key={tag} className="manifest-detail__tag">
              {tag.replace(/_/g, ' ')}
              <button
                type="button"
                className="manifest-detail__tag-remove"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                x
              </button>
            </span>
          ))}
          {addingTag ? (
            <input
              type="text"
              className="manifest-detail__tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') { setTagInput(''); setAddingTag(false); }
              }}
              placeholder="Tag name..."
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="manifest-detail__tag manifest-detail__tag--add"
              onClick={() => setAddingTag(true)}
            >
              + Add Tag
            </button>
          )}
        </div>
      </section>

      {/* Content — editable for text-based file types */}
      {(item.file_type === 'text_note' || item.file_type === 'txt' || item.file_type === 'md') && (
        <section className="manifest-detail__section">
          <h3 className="manifest-detail__section-title">Content</h3>
          {editingContent ? (
            <div className="manifest-detail__content-edit">
              <textarea
                className="manifest-detail__content-textarea"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                rows={10}
                autoFocus
              />
              <div className="manifest-detail__content-actions">
                <Button size="sm" onClick={saveContent}>Save</Button>
                <Button size="sm" variant="text" onClick={() => { setContentDraft(item.text_content || ''); setEditingContent(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div
                className="manifest-detail__content-preview manifest-detail__content-preview--editable"
                onClick={() => { setContentDraft(item.text_content || ''); setEditingContent(true); }}
                title="Click to edit"
              >
                {!item.text_content
                  ? 'No content yet. Click to add.'
                  : item.text_content.length > 500 && !contentExpanded
                    ? item.text_content.substring(0, 500) + '...'
                    : item.text_content}
              </div>
              {item.text_content && item.text_content.length > 500 && (
                <button
                  type="button"
                  className="manifest-detail__content-toggle"
                  onClick={() => setContentExpanded(!contentExpanded)}
                >
                  {contentExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* About This Book — shown for completed items (except text notes) */}
      {item.processing_status === 'completed' && item.file_type !== 'text_note' && (
        <section className="manifest-detail__section">
          <div className="manifest-detail__section-header">
            <h3 className="manifest-detail__section-title">About This Book</h3>
            {onEnrichItem && (
              <button
                type="button"
                className="manifest-detail__enrich-btn"
                onClick={handleRegenerate}
                disabled={enriching}
                title="Regenerate summary and suggest tags"
              >
                {enriching ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}
          </div>

          {item.ai_summary ? (
            <p className="manifest-detail__summary">{item.ai_summary}</p>
          ) : (
            <div className="manifest-detail__summary-empty">
              <p>No summary yet.</p>
              {onEnrichItem && (
                <button
                  type="button"
                  className="manifest-detail__enrich-btn manifest-detail__enrich-btn--primary"
                  onClick={handleRegenerate}
                  disabled={enriching}
                >
                  {enriching ? 'Generating...' : 'Generate Summary & Suggest Tags'}
                </button>
              )}
            </div>
          )}

          {item.toc && item.toc.length > 0 && (
            <div className="manifest-detail__toc">
              <h4 className="manifest-detail__toc-title">Contents</h4>
              <ol className="manifest-detail__toc-list">
                {item.toc
                  .filter((entry: { level: number; title: string }) => entry.level <= 2)
                  .map((entry: { level: number; title: string }, i: number) => (
                    <li
                      key={i}
                      className={`manifest-detail__toc-entry manifest-detail__toc-entry--level-${entry.level}`}
                    >
                      {entry.title}
                    </li>
                  ))}
              </ol>
            </div>
          )}

          {item.chunk_count > 0 && (
            <p className="manifest-detail__chunk-info">{item.chunk_count} chunks indexed</p>
          )}
        </section>
      )}

      {/* Extract Section — genre picker + section discovery + extract */}
      {isProcessed && (
        <section className="manifest-detail__section">
          <div className="manifest-detail__section-header">
            <h3 className="manifest-detail__section-title">Extract</h3>
          </div>

          {/* Genre chips — always show if genres are set, or on demand */}
          {(selectedGenres.length > 0 || showGenrePicker) && extractionPhase !== 'selecting' && (
            <GenrePicker
              selected={selectedGenres}
              onChange={handleGenreChange}
              disabled={extracting || extractionPhase === 'discovering'}
            />
          )}

          {/* Extract button — idle phase */}
          {extractionPhase === 'idle' && !hasExtraction && !extracting && (
            <Button onClick={handleExtract} disabled={extracting}>
              <Wand2 size={14} />
              {selectedGenres.length === 0 ? 'Select Genres & Extract' : 'Extract'}
            </Button>
          )}

          {/* Re-extract button for items that already have extractions */}
          {extractionPhase === 'idle' && hasExtraction && !extracting && selectedGenres.length > 0 && (
            <Button size="sm" variant="secondary" onClick={handleExtract} disabled={extracting}>
              <Wand2 size={14} />
              Re-extract All
            </Button>
          )}

          {/* Show genre picker toggle if genres not yet set */}
          {extractionPhase === 'idle' && selectedGenres.length === 0 && !showGenrePicker && hasExtraction && (
            <button type="button" className="manifest-detail__enrich-btn" onClick={() => setShowGenrePicker(true)}>
              Set genres for better extraction
            </button>
          )}

          {/* Discovering sections phase */}
          {(extractionPhase === 'discovering' || discoveringSections) && (
            <div className="manifest-detail__discovering">
              <LoadingSpinner />
              <p>Analyzing document structure...</p>
            </div>
          )}

          {/* Discovery error */}
          {discoveryError && extractionPhase === 'idle' && (
            <div className="manifest-detail__discovery-error">
              <p>{discoveryError}</p>
              <Button size="sm" onClick={handleExtract}>Try Again</Button>
            </div>
          )}

          {/* Section checklist phase */}
          {extractionPhase === 'selecting' && sections.length > 0 && (
            <div className="manifest-detail__section-checklist">
              <div className="manifest-detail__section-checklist-header">
                <span className="manifest-detail__section-count">
                  {selectedSectionIndices.length} of {sections.length} sections selected
                </span>
                <button
                  type="button"
                  className="manifest-detail__section-toggle"
                  onClick={handleToggleAllSections}
                >
                  {selectedSectionIndices.length === sections.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="manifest-detail__section-list">
                {sections.map((section, i) => {
                  const isNonContent = section.title.startsWith('[NON-CONTENT]');
                  const displayTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');
                  const wordEstimate = Math.round((section.end_char - section.start_char) / 5);
                  return (
                    <label
                      key={i}
                      className={`manifest-detail__section-item${isNonContent ? ' manifest-detail__section-item--non-content' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectionIndices.includes(i)}
                        onChange={() => handleToggleSection(i)}
                      />
                      <div className="manifest-detail__section-item-info">
                        <span className="manifest-detail__section-item-title">{displayTitle}</span>
                        <span className="manifest-detail__section-item-desc">{section.description}</span>
                        <span className="manifest-detail__section-item-size">~{wordEstimate.toLocaleString()} words</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="manifest-detail__section-actions">
                <Button variant="secondary" onClick={() => setExtractionPhase('idle')}>Cancel</Button>
                <Button onClick={handleExtractSelected} disabled={selectedSectionIndices.length === 0}>
                  Extract from {selectedSectionIndices.length} Section{selectedSectionIndices.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Extracting phase with progress */}
          {(extractionPhase === 'extracting' || extracting) && (
            <div className="manifest-detail__extracting-status">
              <RefreshCw size={14} className="manifest-detail__spin" />
              {extractionProgress
                ? `Extracting section ${extractionProgress.current + 1} of ${extractionProgress.total}...`
                : 'Extracting content...'}
            </div>
          )}

          {/* Clear Extractions */}
          {hasExtraction && !extracting && extractionPhase === 'idle' && (
            <div className="manifest-detail__clear-section">
              {!confirmClear ? (
                <button type="button" className="manifest-detail__enrich-btn" onClick={() => setConfirmClear(true)}>
                  Clear Extractions
                </button>
              ) : (
                <div className="manifest-detail__delete-confirm">
                  <span>Clear all extracted content? This cannot be undone.</span>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</Button>
                  <Button size="sm" onClick={handleClearExtractions} disabled={clearing}>
                    {clearing ? 'Clearing...' : 'Confirm Clear'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Extraction Tabs — shown when extractions exist or extracting */}
      {isProcessed && (hasExtraction || extracting) && (
        <section className="manifest-detail__section">
          <ExtractionTabs
            manifestItemId={item.id}
            genres={selectedGenres}
            summaries={summaries}
            declarations={declarations}
            actionSteps={actionSteps}
            principles={principles}
            extractingTab={extractingTab}
            hasFramework={hasFramework}
            onToggleSummaryHeart={onToggleSummaryHeart}
            onDeleteSummary={onDeleteSummary}
            onUpdateSummaryText={onUpdateSummaryText}
            onSummaryGoDeeper={onSummaryGoDeeper}
            onSummaryReRun={onSummaryReRun}
            onTogglePrincipleHeart={onTogglePrincipleHeart}
            onDeletePrinciple={onDeletePrinciple}
            onToggleDeclarationHeart={onToggleDeclarationHeart}
            onDeleteDeclaration={onDeleteDeclaration}
            onUpdateDeclaration={onUpdateDeclaration}
            onSendDeclarationToMast={onSendDeclarationToMast}
            onDeclarationGoDeeper={onDeclarationGoDeeper}
            onDeclarationReRun={onDeclarationReRun}
            onToggleActionStepHeart={onToggleActionStepHeart}
            onDeleteActionStep={onDeleteActionStep}
            onUpdateActionStepText={onUpdateActionStepText}
            onSendActionStepToCompass={onSendActionStepToCompass}
            onActionStepGoDeeper={onActionStepGoDeeper}
            onActionStepReRun={onActionStepReRun}
            extractionProgress={extractionProgress}
          />
        </section>
      )}

      {/* Apply Section — shown when extractions exist */}
      {isProcessed && hasExtraction && !extracting && (
        <section className="manifest-detail__section">
          <div className="apply-section">
            <h3 className="apply-section__title">Apply This</h3>
            <div className="apply-section__buttons">
              <button
                type="button"
                className="apply-section__btn"
                onClick={() => onOpenDiscussion?.('discuss')}
                disabled={!onOpenDiscussion}
              >
                <MessageSquare size={14} />
                Discuss Book
              </button>
              <button
                type="button"
                className="apply-section__btn"
                onClick={() => onOpenDiscussion?.('generate_goals')}
                disabled={!onOpenDiscussion}
              >
                <Target size={14} />
                Generate Goals
              </button>
              <button
                type="button"
                className="apply-section__btn"
                onClick={() => onOpenDiscussion?.('generate_questions')}
                disabled={!onOpenDiscussion}
              >
                <HelpCircle size={14} />
                Generate Questions
              </button>
              <button
                type="button"
                className="apply-section__btn"
                onClick={() => onOpenDiscussion?.('generate_tasks')}
                disabled={!onOpenDiscussion}
              >
                <CheckSquare size={14} />
                Generate Tasks
              </button>
              <button
                type="button"
                className="apply-section__btn"
                onClick={() => onOpenDiscussion?.('generate_tracker')}
                disabled={!onOpenDiscussion}
              >
                <BarChart3 size={14} />
                Generate Tracker
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Floating Discuss Button — shown when extractions exist */}
      {isProcessed && hasExtraction && !extracting && onOpenDiscussion && (
        <button
          type="button"
          className="manifest-detail__discuss-fab"
          onClick={() => onOpenDiscussion('discuss')}
          title="Discuss this book"
        >
          <MessageSquare size={20} />
        </button>
      )}

      {/* Actions */}
      <section className="manifest-detail__section">
        <div className="manifest-detail__actions">
          {item.source_manifest_item_id === null && item.extraction_status === 'completed' && item.processing_status === 'completed' && (
            <>
              {!confirmPush ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmPush(true)}
                  disabled={pushing}
                >
                  <Users size={14} />
                  {pushing ? 'Pushing updates...' : pushDone ? 'Updates pushed!' : 'Push Updates to Family'}
                </Button>
              ) : (
                <div className="manifest-detail__delete-confirm">
                  <span>Update extractions for all family members? Their hearted items will be preserved.</span>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmPush(false)}>Cancel</Button>
                  <Button size="sm" onClick={handlePushToFamily}>Push Updates</Button>
                </div>
              )}
            </>
          )}

          {(item.processing_status === 'completed' || item.processing_status === 'failed') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReprocess}
              disabled={reprocessing}
            >
              <RefreshCw size={14} className={reprocessing ? 'manifest-detail__spin' : ''} />
              Re-process
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={handleArchive}>
            Archive
          </Button>

          {confirmDelete ? (
            <div className="manifest-detail__delete-confirm">
              <span>Are you sure?</span>
              <Button size="sm" variant="text" onClick={handleDelete}>Yes, delete</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="text" onClick={() => setConfirmDelete(true)}>
              Delete Permanently
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
