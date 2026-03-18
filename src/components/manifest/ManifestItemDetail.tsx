import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, FileText, FileCode, Mic, Image, StickyNote, RefreshCw, BookOpen, Wand2, MessageSquare, Target, HelpCircle, CheckSquare, BarChart3, Users, ChevronRight, AlertTriangle, Tags } from 'lucide-react';
import type { ManifestItem, ManifestSummary, ManifestDeclaration, ManifestActionStep, ManifestQuestion, AIFrameworkPrinciple, BookGenre, DiscussionType } from '../../lib/types';
import { MANIFEST_FILE_TYPE_LABELS, MANIFEST_STATUS_LABELS } from '../../lib/types';
import type { SectionInfo } from '../../hooks/useManifestExtraction';
import type { MergeStats } from '../../lib/mergeSections';
import { supabase } from '../../lib/supabase';
import { Button, LoadingSpinner } from '../shared';
import { GenrePicker } from './GenrePicker';
import { ExtractionTabs } from './ExtractionTabs';
import './ManifestItemDetail.css';

type ExtractionPhase = 'idle' | 'discovering' | 'selecting' | 'extracting';

interface ManifestItemDetailProps {
  item: ManifestItem;
  onBack: () => void;
  onUpdateItem: (id: string, updates: Partial<Pick<ManifestItem, 'title' | 'tags' | 'usage_designations' | 'folder_group' | 'text_content' | 'intake_completed' | 'author' | 'isbn'>>) => Promise<boolean>;
  onReprocess: (id: string) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onEnrichItem?: (itemId: string, forceAll?: boolean) => Promise<{ summary: string; tags?: string[] } | null>;
  // Parts (split books)
  childParts?: ManifestItem[];
  parentItem?: ManifestItem | null;
  onSelectPart?: (part: ManifestItem) => void;
  onBackToParent?: () => void;
  onProcessParts?: (parentId: string, parts: ManifestItem[]) => void;
  // Multi-part extraction
  onDiscoverSectionsRaw?: (itemId: string) => Promise<SectionInfo[] | null>;
  onExtractSectionsForPart?: (
    itemId: string,
    genres: BookGenre[],
    partSections: SectionInfo[],
    sectionIndices: number[],
    onFrameworkResult?: (result: unknown, sectionTitle: string, sectionIndex: number) => Promise<void>,
    onProgress?: (current: number, total: number) => void,
  ) => Promise<boolean>;
  onSaveFrameworkForPart?: (
    partId: string,
    frameworkName: string,
    principles: Array<{ text: string; sort_order: number; section_title?: string }>,
  ) => Promise<void>;
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
  onUpdateSectionTitle?: (index: number, title: string) => void;
  discoveringSections: boolean;
  extractionProgress: { current: number; total: number; currentType: 'summary' | 'framework' | 'mast_content' | 'action_steps' } | null;
  failedSections: Array<{ sectionIndex: number; title: string; retrying?: boolean }>;
  onRetrySection: (sectionIndex: number) => Promise<boolean>;
  onClearExtractions: (itemId: string) => Promise<void>;
  // Merge sections
  isMergeActive?: boolean;
  mergeStats?: MergeStats;
  onToggleMerge?: () => void;
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
  // Question actions
  questions: ManifestQuestion[];
  onFetchQuestions: (manifestItemId: string) => Promise<void>;
  onToggleQuestionHeart: (id: string) => void;
  onDeleteQuestion: (id: string) => void;
  onUpdateQuestionText: (id: string, text: string) => void;
  onUpdateQuestionNote: (id: string, note: string | null) => void;
  onSendQuestionToPrompts: (id: string) => void;
  onQuestionGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onQuestionReRun: (sectionTitle?: string) => void;
  // Notes
  onUpdateSummaryNote?: (id: string, note: string | null) => void;
  onUpdatePrincipleNote?: (id: string, note: string | null) => void;
  onUpdateActionStepNote?: (id: string, note: string | null) => void;
  onUpdateDeclarationNote?: (id: string, note: string | null) => void;
  // Framework Re-run
  onFrameworkReRun?: () => Promise<void>;
  // Discussion
  onOpenDiscussion?: (type: DiscussionType) => void;
  // Generate Tags
  onGenerateTags?: () => Promise<void>;
  generatingTags?: boolean;
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
  onUpdateSectionTitle,
  discoveringSections,
  extractionProgress,
  failedSections,
  onRetrySection,
  onClearExtractions,
  isMergeActive,
  mergeStats,
  onToggleMerge,
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
  questions,
  onFetchQuestions,
  onToggleQuestionHeart,
  onDeleteQuestion,
  onUpdateQuestionText,
  onUpdateQuestionNote,
  onSendQuestionToPrompts,
  onQuestionGoDeeper,
  onQuestionReRun,
  onUpdateSummaryNote,
  onUpdatePrincipleNote,
  onUpdateActionStepNote,
  onUpdateDeclarationNote,
  onFrameworkReRun,
  onOpenDiscussion,
  onGenerateTags,
  generatingTags,
  childParts,
  parentItem,
  onSelectPart,
  onBackToParent,
  onProcessParts,
  onDiscoverSectionsRaw,
  onExtractSectionsForPart,
  onSaveFrameworkForPart,
}: ManifestItemDetailProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorDraft, setAuthorDraft] = useState(item.author || '');
  const [editingISBN, setEditingISBN] = useState(false);
  const [isbnDraft, setIsbnDraft] = useState(item.isbn || '');
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

  // Multi-part extraction state
  type MultiPartPhase = 'idle' | 'discovering' | 'selecting' | 'extracting';
  const [multiPartPhase, setMultiPartPhase] = useState<MultiPartPhase>('idle');
  const [multiPartData, setMultiPartData] = useState<Array<{
    part: ManifestItem;
    sections: SectionInfo[];
    selectedIndices: number[];
  }>>([]);
  const [multiPartProgress, setMultiPartProgress] = useState<string>('');

  const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
  const isProcessed = item.processing_status === 'completed';
  const hasExtraction = item.extraction_status !== 'none' || summaries.length > 0 || declarations.length > 0 || actionSteps.length > 0 || principles.length > 0;
  const isParentWithParts = (item.part_count ?? 0) > 0;
  const isPart = !!item.parent_manifest_item_id;

  // Fetch existing extractions on mount
  useEffect(() => {
    if (isProcessed) {
      onFetchSummaries(item.id);
      onFetchDeclarations(item.id);
      onFetchActionSteps(item.id);
      onFetchQuestions(item.id);
    }
  }, [item.id, isProcessed, onFetchSummaries, onFetchDeclarations, onFetchActionSteps, onFetchQuestions]);

  const saveTitle = useCallback(() => {
    if (titleDraft.trim() && titleDraft.trim() !== item.title) {
      onUpdateItem(item.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }, [titleDraft, item.id, item.title, onUpdateItem]);

  const saveAuthor = useCallback(() => {
    const trimmed = authorDraft.trim();
    if (trimmed !== (item.author || '')) {
      onUpdateItem(item.id, { author: trimmed || null });
    }
    setEditingAuthor(false);
  }, [authorDraft, item.id, item.author, onUpdateItem]);

  const saveISBN = useCallback(() => {
    const trimmed = isbnDraft.trim();
    if (trimmed !== (item.isbn || '')) {
      onUpdateItem(item.id, { isbn: trimmed || null });
    }
    setEditingISBN(false);
  }, [isbnDraft, item.id, item.isbn, onUpdateItem]);

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
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState('');

  // Compute which section titles already have extracted content
  const extractedSectionTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const s of summaries) if (s.section_title) titles.add(s.section_title);
    for (const p of principles) if (p.section_title) titles.add(p.section_title);
    for (const a of actionSteps) if (a.section_title) titles.add(a.section_title);
    for (const d of declarations) if (d.section_title) titles.add(d.section_title);
    return titles;
  }, [summaries, principles, actionSteps, declarations]);

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

  // Continue extraction — discover sections, auto-select only missing ones
  const handleContinueExtraction = useCallback(async () => {
    if (selectedGenres.length === 0) {
      setShowGenrePicker(true);
      return;
    }
    setExtractionPhase('discovering');
    setDiscoveryError(null);
    const discovered = await onDiscoverSections(item.id);
    if (discovered && discovered.length > 0) {
      // Pre-select only sections that don't have extracted content yet
      const missingIndices = discovered
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => {
          const cleanTitle = s.title.replace(/^\[NON-CONTENT\]\s*/i, '');
          return !extractedSectionTitles.has(cleanTitle);
        })
        .map(({ i }) => i);
      onSetSelectedSectionIndices(missingIndices);
      setExtractionPhase('selecting');
    } else {
      setExtractionPhase('idle');
      setDiscoveryError('Section discovery failed. Please try again.');
    }
  }, [selectedGenres, item.id, onDiscoverSections, extractedSectionTitles, onSetSelectedSectionIndices]);

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

  // --- Multi-part extraction handlers ---

  const handleExtractAllParts = useCallback(async () => {
    if (!childParts || childParts.length === 0 || !onDiscoverSectionsRaw || !onExtractSectionsForPart) return;
    if (selectedGenres.length === 0) {
      setShowGenrePicker(true);
      return;
    }

    // Only extract parts that are processed
    const processedParts = childParts.filter((p) => p.processing_status === 'completed');
    if (processedParts.length === 0) return;

    // Phase 1: Discover sections for all parts
    setMultiPartPhase('discovering');
    const discovered: typeof multiPartData = [];

    for (let i = 0; i < processedParts.length; i++) {
      const part = processedParts[i];
      setMultiPartProgress(`Analyzing Part ${i + 1} of ${processedParts.length}...`);
      const sections = await onDiscoverSectionsRaw(part.id);
      if (sections && sections.length > 0) {
        const contentIndices = sections
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => !s.title.startsWith('[NON-CONTENT]'))
          .map(({ idx }) => idx);
        discovered.push({ part, sections, selectedIndices: contentIndices });
      }
    }

    if (discovered.length === 0) {
      setMultiPartPhase('idle');
      setMultiPartProgress('');
      return;
    }

    setMultiPartData(discovered);
    setMultiPartPhase('selecting');
    setMultiPartProgress('');
  }, [childParts, selectedGenres, onDiscoverSectionsRaw, onExtractSectionsForPart, multiPartData]);

  const handleMultiPartToggleSection = useCallback((partIndex: number, sectionIndex: number) => {
    setMultiPartData((prev) => prev.map((d, i) => {
      if (i !== partIndex) return d;
      const has = d.selectedIndices.includes(sectionIndex);
      return {
        ...d,
        selectedIndices: has
          ? d.selectedIndices.filter((idx) => idx !== sectionIndex)
          : [...d.selectedIndices, sectionIndex].sort((a, b) => a - b),
      };
    }));
  }, []);

  const handleMultiPartTogglePart = useCallback((partIndex: number) => {
    setMultiPartData((prev) => prev.map((d, i) => {
      if (i !== partIndex) return d;
      const allSelected = d.selectedIndices.length === d.sections.length;
      return { ...d, selectedIndices: allSelected ? [] : d.sections.map((_, idx) => idx) };
    }));
  }, []);

  const handleMultiPartExtract = useCallback(async () => {
    if (!onExtractSectionsForPart) return;
    setMultiPartPhase('extracting');

    for (let pi = 0; pi < multiPartData.length; pi++) {
      const { part, sections: partSections, selectedIndices } = multiPartData[pi];
      if (selectedIndices.length === 0) continue;

      await onExtractSectionsForPart(
        part.id,
        selectedGenres,
        partSections,
        selectedIndices,
        onSaveFrameworkForPart
          ? async (result: unknown, sectionTitle: string, _sectionIndex: number) => {
              const r = result as { framework_name?: string; principles?: Array<{ text: string; sort_order: number }> };
              if (r?.framework_name && r.principles?.length) {
                const principles = r.principles.map((p, idx) => ({
                  text: p.text,
                  sort_order: idx,
                  section_title: sectionTitle,
                }));
                await onSaveFrameworkForPart(part.id, r.framework_name, principles);
              }
            }
          : undefined,
        (current, total) => {
          setMultiPartProgress(`Part ${pi + 1} of ${multiPartData.length} — Section ${current + 1} of ${total}`);
        },
      );
    }

    // Update parent's extraction_status to 'completed' so push-all and UI recognize it
    await supabase
      .from('manifest_items')
      .update({ extraction_status: 'completed' })
      .eq('id', item.id);

    setMultiPartPhase('idle');
    setMultiPartData([]);
    setMultiPartProgress('');
  }, [multiPartData, selectedGenres, onExtractSectionsForPart, onSaveFrameworkForPart, item.id]);

  const multiPartTotalSelected = useMemo(
    () => multiPartData.reduce((sum, d) => sum + d.selectedIndices.length, 0),
    [multiPartData],
  );

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
      <button type="button" className="manifest-detail__back" onClick={isPart && onBackToParent ? onBackToParent : onBack}>
        <ChevronLeft size={16} />
        {isPart && parentItem ? `Back to ${parentItem.title}` : 'Back'}
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

          {/* Author — inline editable */}
          {editingAuthor ? (
            <input
              type="text"
              className="manifest-detail__author-input"
              value={authorDraft}
              onChange={(e) => setAuthorDraft(e.target.value)}
              onBlur={saveAuthor}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveAuthor();
                if (e.key === 'Escape') { setAuthorDraft(item.author || ''); setEditingAuthor(false); }
              }}
              placeholder="Author name..."
              autoFocus
            />
          ) : item.author ? (
            <p
              className="manifest-detail__author"
              onClick={() => { setAuthorDraft(item.author || ''); setEditingAuthor(true); }}
              title="Click to edit"
            >
              {item.author}
            </p>
          ) : (
            <button
              type="button"
              className="manifest-detail__add-meta-btn"
              onClick={() => { setAuthorDraft(''); setEditingAuthor(true); }}
            >
              + Add author
            </button>
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
            <div className="manifest-detail__section-actions">
              {onGenerateTags && (
                <button
                  type="button"
                  className="manifest-detail__enrich-btn"
                  onClick={onGenerateTags}
                  disabled={generatingTags}
                  title="Generate topic tags for this book's framework"
                >
                  <Tags size={12} />
                  {generatingTags ? 'Tagging...' : 'Generate Tags'}
                </button>
              )}
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

          {/* ISBN — inline editable */}
          <div className="manifest-detail__isbn-row">
            {editingISBN ? (
              <input
                type="text"
                className="manifest-detail__isbn-input"
                value={isbnDraft}
                onChange={(e) => setIsbnDraft(e.target.value)}
                onBlur={saveISBN}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveISBN();
                  if (e.key === 'Escape') { setIsbnDraft(item.isbn || ''); setEditingISBN(false); }
                }}
                placeholder="ISBN..."
                autoFocus
              />
            ) : item.isbn ? (
              <span
                className="manifest-detail__isbn"
                onClick={() => { setIsbnDraft(item.isbn || ''); setEditingISBN(true); }}
                title="Click to edit"
              >
                ISBN: {item.isbn}
              </span>
            ) : (
              <button
                type="button"
                className="manifest-detail__add-meta-btn"
                onClick={() => { setIsbnDraft(''); setEditingISBN(true); }}
              >
                + Add ISBN
              </button>
            )}
          </div>

          {item.chunk_count > 0 && (
            <p className="manifest-detail__chunk-info">{item.chunk_count} chunks indexed</p>
          )}
        </section>
      )}

      {/* Parts Section — shown for parent items that have been split */}
      {isParentWithParts && childParts && childParts.length > 0 && (() => {
        const stuckParts = childParts.filter((p) => p.processing_status !== 'completed');
        const processingParts = childParts.filter((p) => p.processing_status === 'processing');
        const hasStuckParts = stuckParts.length > 0;
        const isProcessingParts = processingParts.length > 0;
        return (
          <section className="manifest-detail__section">
            <div className="manifest-detail__section-header">
              <h3 className="manifest-detail__section-title">Parts ({childParts.length})</h3>
              {hasStuckParts && onProcessParts && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onProcessParts(item.id, childParts)}
                  disabled={isProcessingParts}
                >
                  <RefreshCw size={14} className={isProcessingParts ? 'spin' : ''} />
                  {isProcessingParts
                    ? `Processing ${processingParts.length}/${childParts.length}...`
                    : `Process ${stuckParts.length} Part${stuckParts.length > 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
            <p className="manifest-detail__parts-info">
              This book has been split into {childParts.length} parts for extraction. Select a part to view or extract.
            </p>
            <div className="manifest-detail__parts-list">
              {childParts.map((part) => {
                const partProcessing = part.processing_status === 'pending' || part.processing_status === 'processing';
                const partFailed = part.processing_status === 'failed';
                const partExtracted = part.extraction_status === 'completed' || part.extraction_status === 'failed';
                return (
                  <button
                    key={part.id}
                    type="button"
                    className="manifest-detail__part-card"
                    onClick={() => onSelectPart?.(part)}
                  >
                    <div className="manifest-detail__part-info">
                      <span className="manifest-detail__part-title">
                        {part.part_number ? `Part ${part.part_number}: ` : ''}
                        {part.title.replace(`${item.title} — `, '')}
                      </span>
                      {part.chunk_count > 0 && (
                        <span className="manifest-detail__part-meta">
                          {part.chunk_count} chunks indexed
                        </span>
                      )}
                    </div>
                    <div className="manifest-detail__part-status">
                      {partProcessing && (
                        <span className="manifest-detail__part-badge manifest-detail__part-badge--processing">
                          {part.processing_detail || 'Processing'}
                        </span>
                      )}
                      {partFailed && <span className="manifest-detail__part-badge manifest-detail__part-badge--failed">Failed</span>}
                      {partExtracted && <span className="manifest-detail__part-badge manifest-detail__part-badge--extracted">Extracted</span>}
                      {part.processing_status === 'completed' && !partExtracted && (
                        <span className="manifest-detail__part-badge manifest-detail__part-badge--ready">Ready</span>
                      )}
                    </div>
                    <ChevronRight size={16} className="manifest-detail__part-chevron" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Multi-part Extraction — shown on parent items with processed parts */}
      {isParentWithParts && childParts && childParts.some((p) => p.processing_status === 'completed') && onDiscoverSectionsRaw && onExtractSectionsForPart && (
        <section className="manifest-detail__section">
          <div className="manifest-detail__section-header">
            <h3 className="manifest-detail__section-title">Extract All Parts</h3>
          </div>

          {/* Genre picker */}
          {(selectedGenres.length > 0 || showGenrePicker) && multiPartPhase !== 'selecting' && (
            <GenrePicker
              selected={selectedGenres}
              onChange={handleGenreChange}
              disabled={multiPartPhase !== 'idle'}
            />
          )}

          {/* Idle — show extract button */}
          {multiPartPhase === 'idle' && (
            <Button onClick={handleExtractAllParts}>
              <Wand2 size={14} />
              {selectedGenres.length === 0 ? 'Select Genres & Extract All Parts' : 'Extract All Parts'}
            </Button>
          )}

          {/* Discovering — show progress */}
          {multiPartPhase === 'discovering' && (
            <div className="manifest-detail__discovering">
              <LoadingSpinner />
              <p>{multiPartProgress}</p>
            </div>
          )}

          {/* Selecting — combined section checklist grouped by part */}
          {multiPartPhase === 'selecting' && multiPartData.length > 0 && (
            <div className="manifest-detail__section-checklist">
              {multiPartData.map((partData, pi) => (
                <div key={partData.part.id} className="manifest-detail__multipart-group">
                  <div className="manifest-detail__multipart-header">
                    <strong>
                      {partData.part.part_number ? `Part ${partData.part.part_number}` : partData.part.title.replace(`${item.title} — `, '')}
                    </strong>
                    <span className="manifest-detail__section-count">
                      {partData.selectedIndices.length}/{partData.sections.length}
                    </span>
                    <button
                      type="button"
                      className="manifest-detail__section-toggle"
                      onClick={() => handleMultiPartTogglePart(pi)}
                    >
                      {partData.selectedIndices.length === partData.sections.length ? 'Deselect' : 'Select All'}
                    </button>
                  </div>
                  <div className="manifest-detail__section-list">
                    {partData.sections.map((section, si) => {
                      const isNonContent = section.title.startsWith('[NON-CONTENT]');
                      const displayTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');
                      return (
                        <label
                          key={si}
                          className={`manifest-detail__section-item${isNonContent ? ' manifest-detail__section-item--non-content' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={partData.selectedIndices.includes(si)}
                            onChange={() => handleMultiPartToggleSection(pi, si)}
                          />
                          <span className="manifest-detail__section-item-title">{displayTitle}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="manifest-detail__section-actions">
                <Button variant="secondary" onClick={() => { setMultiPartPhase('idle'); setMultiPartData([]); }}>Cancel</Button>
                <Button onClick={handleMultiPartExtract} disabled={multiPartTotalSelected === 0}>
                  Extract {multiPartTotalSelected} Section{multiPartTotalSelected !== 1 ? 's' : ''} across {multiPartData.filter((d) => d.selectedIndices.length > 0).length} Part{multiPartData.filter((d) => d.selectedIndices.length > 0).length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Extracting — show progress */}
          {multiPartPhase === 'extracting' && (
            <div className="manifest-detail__extracting-status">
              <RefreshCw size={14} className="manifest-detail__spin" />
              {multiPartProgress || 'Extracting...'}
            </div>
          )}
        </section>
      )}

      {/* Extract Section — genre picker + section discovery + extract */}
      {isProcessed && !isParentWithParts && (
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

          {/* Continue / Re-extract buttons for items that already have extractions */}
          {extractionPhase === 'idle' && hasExtraction && !extracting && selectedGenres.length > 0 && (
            <div className="manifest-detail__extract-actions">
              <Button size="sm" onClick={handleContinueExtraction} disabled={extracting}>
                <Wand2 size={14} />
                Continue Extraction
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExtract} disabled={extracting}>
                Re-extract All
              </Button>
            </div>
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
                <div className="manifest-detail__section-header-actions">
                  {mergeStats?.suggestMerge && onToggleMerge && (
                    <button
                      type="button"
                      className={`manifest-detail__section-merge-toggle${isMergeActive ? ' manifest-detail__section-merge-toggle--active' : ''}`}
                      onClick={onToggleMerge}
                    >
                      {isMergeActive ? 'Show All Sections' : 'Merge Short Sections'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="manifest-detail__section-toggle"
                    onClick={handleToggleAllSections}
                  >
                    {selectedSectionIndices.length === sections.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="manifest-detail__section-list">
                {sections.map((section, i) => {
                  const isNonContent = section.title.startsWith('[NON-CONTENT]');
                  const displayTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');
                  const wordEstimate = Math.round((section.end_char - section.start_char) / 5);
                  const isEditingThis = editingSectionIndex === i;
                  const alreadyExtracted = extractedSectionTitles.has(displayTitle);
                  const isMergedSection = isMergeActive && section.description.includes('sections merged');
                  return (
                    <label
                      key={i}
                      className={`manifest-detail__section-item${isNonContent ? ' manifest-detail__section-item--non-content' : ''}${alreadyExtracted ? ' manifest-detail__section-item--extracted' : ''}${isMergedSection ? ' manifest-detail__section-item--merged' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectionIndices.includes(i)}
                        onChange={() => handleToggleSection(i)}
                      />
                      <div className="manifest-detail__section-item-info">
                        {isEditingThis ? (
                          <input
                            type="text"
                            className="manifest-detail__section-title-input"
                            value={sectionTitleDraft}
                            onChange={(e) => setSectionTitleDraft(e.target.value)}
                            onBlur={() => {
                              if (sectionTitleDraft.trim() && onUpdateSectionTitle) {
                                const prefix = isNonContent ? '[NON-CONTENT] ' : '';
                                onUpdateSectionTitle(i, prefix + sectionTitleDraft.trim());
                              }
                              setEditingSectionIndex(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingSectionIndex(null);
                            }}
                            onClick={(e) => e.preventDefault()}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="manifest-detail__section-item-title manifest-detail__section-item-title--editable"
                            onClick={(e) => {
                              e.preventDefault();
                              setSectionTitleDraft(displayTitle);
                              setEditingSectionIndex(i);
                            }}
                            title="Click to edit title"
                          >
                            {displayTitle}
                          </span>
                        )}
                        <span className="manifest-detail__section-item-desc">{section.description}</span>
                        <span className="manifest-detail__section-item-size">
                          ~{wordEstimate.toLocaleString()} words
                          {alreadyExtracted && <span className="manifest-detail__section-item-done"> (extracted)</span>}
                        </span>
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

      {/* Failed sections banner — shown after extraction completes with partial failures */}
      {isProcessed && !isParentWithParts && failedSections.length > 0 && !extracting && extractionPhase === 'idle' && (
        <section className="manifest-detail__failed-sections">
          <div className="manifest-detail__failed-header">
            <AlertTriangle size={16} />
            <span>{failedSections.length} section{failedSections.length !== 1 ? 's' : ''} failed to extract</span>
          </div>
          <div className="manifest-detail__failed-list">
            {failedSections.map((fs) => (
              <div key={fs.sectionIndex} className="manifest-detail__failed-item">
                <span className="manifest-detail__failed-title">{fs.title}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRetrySection(fs.sectionIndex)}
                  disabled={fs.retrying}
                >
                  {fs.retrying ? (
                    <><RefreshCw size={12} className="manifest-detail__spin" /> Retrying...</>
                  ) : (
                    <><RefreshCw size={12} /> Retry</>
                  )}
                </Button>
              </div>
            ))}
          </div>
          {failedSections.length > 1 && (
            <Button
              size="sm"
              onClick={async () => {
                for (const fs of failedSections) {
                  await onRetrySection(fs.sectionIndex);
                }
              }}
              disabled={failedSections.some((f) => f.retrying)}
            >
              <RefreshCw size={12} />
              Retry All Failed
            </Button>
          )}
        </section>
      )}

      {/* Extraction Tabs — shown when extractions exist or extracting (not for parents with parts) */}
      {isProcessed && !isParentWithParts && (hasExtraction || extracting) && (
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
            onUpdateSummaryNote={onUpdateSummaryNote || (() => {})}
            onUpdatePrincipleNote={onUpdatePrincipleNote || (() => {})}
            onUpdateActionStepNote={onUpdateActionStepNote || (() => {})}
            onUpdateDeclarationNote={onUpdateDeclarationNote || (() => {})}
            questions={questions}
            onToggleQuestionHeart={onToggleQuestionHeart}
            onDeleteQuestion={onDeleteQuestion}
            onUpdateQuestionText={onUpdateQuestionText}
            onUpdateQuestionNote={onUpdateQuestionNote}
            onSendQuestionToPrompts={onSendQuestionToPrompts}
            onQuestionGoDeeper={onQuestionGoDeeper}
            onQuestionReRun={onQuestionReRun}
            extractionProgress={extractionProgress}
            onFrameworkReRun={onFrameworkReRun}
          />
        </section>
      )}

      {/* Apply Section — shown when extractions exist (not for parents with parts) */}
      {isProcessed && !isParentWithParts && hasExtraction && !extracting && (
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

      {/* Floating Discuss Button — shown when extractions exist (not for parents with parts) */}
      {isProcessed && !isParentWithParts && hasExtraction && !extracting && onOpenDiscussion && (
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
