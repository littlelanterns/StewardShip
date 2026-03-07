import { useState, useCallback, useEffect, useRef } from 'react';
import { GripVertical, Plus, Trash2, RefreshCw, Download } from 'lucide-react';
import { Button, LoadingSpinner } from '../shared';
import type { AIFramework } from '../../lib/types';
import type { SectionInfo, FrameworkExtractionResult } from '../../hooks/useFrameworks';
import { exportAsMarkdown, exportAsTxt, exportAsDocx } from '../../lib/exportFramework';
import './FrameworkPrinciples.css';

interface EditablePrinciple {
  text: string;
  sort_order: number;
  is_user_added: boolean;
  is_included: boolean;
  id?: string;
}

type Phase = 'idle' | 'discovering' | 'selecting' | 'extracting' | 'done';

interface FrameworkPrinciplesProps {
  manifestItemId: string;
  manifestItemTitle: string;
  framework: AIFramework | undefined;
  extracting: boolean;
  onExtract: (itemId: string) => Promise<FrameworkExtractionResult | null>;
  onCheckDocumentLength: (itemId: string) => Promise<boolean>;
  onDiscoverSections: (itemId: string) => Promise<{ sections: SectionInfo[]; total_chars: number } | null>;
  onExtractSection: (itemId: string, start: number, end: number, title: string) => Promise<FrameworkExtractionResult | null>;
  onSave: (
    manifestItemId: string,
    name: string,
    principles: Array<{ text: string; sort_order: number; is_user_added?: boolean; is_included?: boolean }>,
    isActive: boolean,
  ) => Promise<AIFramework | null>;
  onToggle: (frameworkId: string, isActive: boolean) => Promise<void>;
  onUpdateTags?: (frameworkId: string, tags: string[]) => Promise<boolean>;
  onBack: () => void;
}

export default function FrameworkPrinciples({
  manifestItemId,
  manifestItemTitle,
  framework,
  extracting,
  onExtract,
  onCheckDocumentLength,
  onDiscoverSections,
  onExtractSection,
  onSave,
  onToggle,
  onUpdateTags,
  onBack,
}: FrameworkPrinciplesProps) {
  const [name, setName] = useState(framework?.name || manifestItemTitle);
  const [principles, setPrinciples] = useState<EditablePrinciple[]>(
    framework?.principles?.map((p) => ({
      text: p.text,
      sort_order: p.sort_order,
      is_user_added: p.is_user_added,
      is_included: p.is_included ?? true,
      id: p.id,
    })).sort((a, b) => a.sort_order - b.sort_order) || [],
  );
  const [isActive, setIsActive] = useState(framework?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [newPrincipleText, setNewPrincipleText] = useState('');

  // Tag state
  const [tags, setTags] = useState<string[]>(framework?.tags || []);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Sync tags when framework prop changes
  useEffect(() => {
    setTags(framework?.tags || []);
  }, [framework?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput('');
      setAddingTag(false);
      return;
    }
    const newTags = [...tags, trimmed];
    setTags(newTags);
    setTagInput('');
    setAddingTag(false);
    if (framework?.id && onUpdateTags) {
      onUpdateTags(framework.id, newTags).catch(console.error);
    }
  }, [tagInput, tags, framework?.id, onUpdateTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    if (framework?.id && onUpdateTags) {
      onUpdateTags(framework.id, newTags).catch(console.error);
    }
  }, [tags, framework?.id, onUpdateTags]);

  // Export state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportWrapperRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async (format: 'md' | 'txt' | 'docx') => {
    setExportMenuOpen(false);
    const exportData = {
      frameworkName: name,
      sourceTitle: manifestItemTitle,
      principles,
    };
    if (format === 'md') {
      exportAsMarkdown(exportData);
    } else if (format === 'txt') {
      exportAsTxt(exportData);
    } else {
      setExporting(true);
      try {
        await exportAsDocx(exportData);
      } finally {
        setExporting(false);
      }
    }
  }, [name, manifestItemTitle, principles]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportWrapperRef.current && !exportWrapperRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportMenuOpen]);

  // Section-based extraction state
  const [phase, setPhase] = useState<Phase>('idle');
  const [sections, setSections] = useState<SectionInfo[] | null>(null);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number | null>(null);
  const [totalSectionsToExtract, setTotalSectionsToExtract] = useState(0);

  // Single-pass extraction (short documents or fallback)
  const handleExtract = useCallback(async () => {
    const result = await onExtract(manifestItemId);
    if (result) {
      if (!name || name === manifestItemTitle) {
        setName(result.framework_name);
      }
      const userAdded = principles.filter((p) => p.is_user_added);
      const newPrinciples = result.principles.map((p, i) => ({
        text: p.text,
        sort_order: userAdded.length + i,
        is_user_added: false,
        is_included: true,
      }));
      setPrinciples([...userAdded, ...newPrinciples]);
    }
  }, [manifestItemId, manifestItemTitle, name, principles, onExtract]);

  // Entry point: check document length and decide flow
  const handleStartExtraction = useCallback(async () => {
    const needsSections = await onCheckDocumentLength(manifestItemId);

    if (needsSections) {
      setPhase('discovering');
      const result = await onDiscoverSections(manifestItemId);

      if (result?.sections && result.sections.length > 0) {
        setSections(result.sections);
        setSelectedSections(getDefaultSelectedSections(result.sections));
        setPhase('selecting');
      } else {
        // Fallback: single-pass extraction if section discovery fails
        setPhase('idle');
        handleExtract();
      }
    } else {
      handleExtract();
    }
  }, [manifestItemId, onCheckDocumentLength, onDiscoverSections, handleExtract]);

  // Extract from selected sections sequentially
  const handleExtractSelected = useCallback(async () => {
    if (!sections || selectedSections.length === 0) return;

    setPhase('extracting');
    setTotalSectionsToExtract(selectedSections.length);
    const allPrinciples: EditablePrinciple[] = [];
    let frameworkName = name || manifestItemTitle;

    for (let i = 0; i < selectedSections.length; i++) {
      setCurrentSectionIndex(i);
      const section = sections[selectedSections[i]];

      const result = await onExtractSection(
        manifestItemId,
        section.start_char,
        section.end_char,
        section.title,
      );

      if (result?.principles) {
        if (i === 0 && result.framework_name && frameworkName === manifestItemTitle) {
          frameworkName = result.framework_name;
          setName(frameworkName);
        }

        const newPrinciples = result.principles.map((p, j) => ({
          text: p.text,
          sort_order: allPrinciples.length + j,
          is_user_added: false,
          is_included: true,
        }));
        allPrinciples.push(...newPrinciples);

        // Update UI progressively — user sees principles accumulate
        setPrinciples([...allPrinciples]);
      }
    }

    setPhase('done');
    setCurrentSectionIndex(null);
  }, [sections, selectedSections, manifestItemId, name, manifestItemTitle, onExtractSection]);

  const handleSave = useCallback(async (activate: boolean) => {
    setSaving(true);
    try {
      const activeState = activate || isActive;
      const saved = await onSave(manifestItemId, name, principles, activeState);
      // If this was a new framework and user added tags before saving,
      // persist them now that we have a framework ID
      if (saved?.id && tags.length > 0 && onUpdateTags) {
        onUpdateTags(saved.id, tags).catch(console.error);
      }
      if (activate) setIsActive(true);
      onBack();
    } finally {
      setSaving(false);
    }
  }, [manifestItemId, name, principles, isActive, tags, onSave, onUpdateTags, onBack]);

  const updatePrinciple = useCallback((index: number, text: string) => {
    setPrinciples((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  }, []);

  const removePrinciple = useCallback((index: number) => {
    setPrinciples((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((p, i) => ({ ...p, sort_order: i }));
    });
  }, []);

  const movePrinciple = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    setPrinciples((prev) => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
      return updated.map((p, i) => ({ ...p, sort_order: i }));
    });
  }, []);

  const togglePrincipleIncluded = useCallback((index: number) => {
    setPrinciples((prev) => prev.map((p, i) =>
      i === index ? { ...p, is_included: !p.is_included } : p
    ));
  }, []);

  const addPrinciple = useCallback(() => {
    if (!newPrincipleText.trim()) return;
    setPrinciples((prev) => [
      ...prev,
      {
        text: newPrincipleText.trim(),
        sort_order: prev.length,
        is_user_added: true,
        is_included: true,
      },
    ]);
    setNewPrincipleText('');
  }, [newPrincipleText]);

  // Auto-resize textarea to fit content
  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // Auto-resize all textareas when principles change
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('.framework-principles__text');
    textareas.forEach((ta) => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }, [principles]);

  // Auto-deselect non-content sections (AI-tagged [NON-CONTENT] + regex fallback)
  const getDefaultSelectedSections = useCallback((sectionList: SectionInfo[]): number[] => {
    const skipPatterns = /^(table of contents|contents|bibliography|references|appendix|appendices|index|about the author|author bio|acknowledgments|acknowledgements|copyright|title page|also by|other books|endnotes|footnotes|glossary)$/i;
    return sectionList
      .map((s, i) => ({ index: i, title: s.title }))
      .filter(({ title }) => {
        // AI-tagged non-content sections
        if (title.startsWith('[NON-CONTENT]')) return false;
        // Regex fallback for sections the AI didn't tag
        const cleanTitle = title.replace(/^\[NON-CONTENT\]\s*/i, '').trim();
        return !skipPatterns.test(cleanTitle);
      })
      .map(({ index }) => index);
  }, []);

  const toggleSectionSelection = useCallback((index: number) => {
    setSelectedSections((prev) =>
      prev.includes(index) ? prev.filter((s) => s !== index) : [...prev, index].sort((a, b) => a - b),
    );
  }, []);

  const toggleAllSections = useCallback(() => {
    if (!sections) return;
    if (selectedSections.length === sections.length) {
      setSelectedSections([]);
    } else {
      setSelectedSections(sections.map((_, i) => i));
    }
  }, [sections, selectedSections.length]);

  // --- Section Discovery Phase ---
  if (phase === 'discovering') {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Analyzing Document</h3>
        </div>
        <div className="framework-principles__loading">
          <LoadingSpinner />
          <p>Analyzing document structure...</p>
          <p className="framework-principles__loading-note">Identifying chapters and sections for targeted extraction.</p>
        </div>
      </div>
    );
  }

  // --- Section Selection Phase ---
  if (phase === 'selecting' && sections) {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extract Framework</h3>
        </div>

        <div className="framework-principles__sections">
          <h4 className="framework-principles__subtitle">Select Sections to Extract From</h4>
          <p className="framework-principles__section-intro">
            This document has {sections.length} sections.
            {selectedSections.length < sections.length
              ? ` Non-content sections (table of contents, bibliography, etc.) have been auto-skipped. You can re-select them if needed.`
              : ` All are selected — deselect any you want to skip.`
            }
          </p>

          {sections.map((section, i) => {
            const displayTitle = section.title.replace(/^\[NON-CONTENT\]\s*/i, '');
            return (
            <label key={i} className="framework-principles__section-item">
              <input
                type="checkbox"
                checked={selectedSections.includes(i)}
                onChange={() => toggleSectionSelection(i)}
              />
              <div className="framework-principles__section-content">
                <strong>{displayTitle}</strong>
                <p className="framework-principles__section-desc">{section.description}</p>
                <span className="framework-principles__section-size">
                  ~{Math.round((section.end_char - section.start_char) / 5 / 100) / 10}K words
                </span>
              </div>
            </label>
            );
          })}

          <div className="framework-principles__section-actions">
            <button
              type="button"
              className="framework-principles__select-toggle"
              onClick={toggleAllSections}
            >
              {selectedSections.length === sections.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="framework-principles__actions">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <Button
              onClick={handleExtractSelected}
              disabled={selectedSections.length === 0}
            >
              Extract from {selectedSections.length} Section{selectedSections.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Extraction Progress Phase ---
  if (phase === 'extracting' && currentSectionIndex !== null && sections) {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extracting Principles</h3>
        </div>
        <div className="framework-principles__progress">
          <LoadingSpinner />
          <p>
            Extracting principles — section {currentSectionIndex + 1} of {totalSectionsToExtract}
          </p>
          <p className="framework-principles__progress-section">
            &ldquo;{sections[selectedSections[currentSectionIndex]]?.title}&rdquo;
          </p>
          {principles.length > 0 && (
            <p className="framework-principles__progress-count">
              {principles.length} principle{principles.length !== 1 ? 's' : ''} found so far
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Initial extraction needed (no principles yet, idle phase) ---
  if (principles.length === 0 && !extracting && phase === 'idle') {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extract Framework</h3>
        </div>
        <div className="framework-principles__empty">
          <p>Extract actionable principles from this content to use as an AI framework.</p>
          <p className="framework-principles__source">Source: {manifestItemTitle}</p>
          <Button onClick={handleStartExtraction} variant="primary">
            Extract Principles
          </Button>
        </div>
      </div>
    );
  }

  // --- Legacy extracting state (single-pass, no section flow) ---
  if (extracting && phase === 'idle') {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extracting Framework</h3>
        </div>
        <div className="framework-principles__loading">
          <LoadingSpinner />
          <p>Analyzing content and extracting principles...</p>
          <p className="framework-principles__loading-note">This may take a moment for longer content.</p>
        </div>
      </div>
    );
  }

  // --- Review/Edit Phase (principles available — either from section extraction or single-pass) ---
  return (
    <div className="framework-principles">
      <div className="framework-principles__header">
        <button className="framework-principles__back" onClick={onBack}>Back</button>
        <h3 className="framework-principles__title">Framework Principles</h3>
      </div>

      <div className="framework-principles__name-row">
        <label className="framework-principles__label">Framework Name</label>
        <input
          className="framework-principles__name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Framework name"
        />
      </div>

      <div className="framework-principles__tags-row">
        <span className="framework-principles__label">Topics</span>
        <div className="framework-principles__tags-list">
          {tags.map((tag) => (
            <span key={tag} className="framework-principles__tag">
              {tag}
              <button
                type="button"
                className="framework-principles__tag-remove"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                &times;
              </button>
            </span>
          ))}
          {addingTag ? (
            <input
              type="text"
              className="framework-principles__tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') { setTagInput(''); setAddingTag(false); }
              }}
              placeholder="Add topic..."
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="framework-principles__tag-add"
              onClick={() => setAddingTag(true)}
            >
              + Add Topic
            </button>
          )}
        </div>
      </div>

      <div className="framework-principles__source-row">
        <span className="framework-principles__source-label">Source:</span>
        <span className="framework-principles__source-value">{manifestItemTitle}</span>
      </div>

      <div className="framework-principles__status-row">
        <span className="framework-principles__label">Status</span>
        <button
          className={`framework-principles__toggle ${isActive ? 'framework-principles__toggle--active' : ''}`}
          onClick={() => {
            setIsActive(!isActive);
            if (framework) {
              onToggle(framework.id, !isActive);
            }
          }}
        >
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="framework-principles__list">
        <label className="framework-principles__label">
          Principles ({principles.length})
        </label>
        <div className="seasonal-focus__bar">
          <span className="seasonal-focus__count">
            {principles.filter((p) => p.is_included).length} of {principles.length} included in AI context
          </span>
          <button
            type="button"
            className="seasonal-focus__toggle-all"
            onClick={() => {
              const allIncluded = principles.every((p) => p.is_included);
              setPrinciples((prev) => prev.map((p) => ({ ...p, is_included: !allIncluded })));
            }}
          >
            {principles.every((p) => p.is_included) ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {principles.map((principle, index) => (
          <div key={index} className={`framework-principles__item${!principle.is_included ? ' seasonal-focus--excluded' : ''}`}>
            <input
              type="checkbox"
              className="seasonal-focus__checkbox"
              checked={principle.is_included}
              onChange={() => togglePrincipleIncluded(index)}
              title={principle.is_included
                ? 'Included in AI conversations. Uncheck to exclude.'
                : 'Excluded from AI conversations. Check to include.'}
            />
            <div className="framework-principles__drag-handles">
              <button
                className="framework-principles__move-btn"
                onClick={() => movePrinciple(index, 'up')}
                disabled={index === 0}
                title="Move up"
              >
                <GripVertical size={14} />
              </button>
            </div>
            <textarea
              ref={autoResizeTextarea}
              className="framework-principles__text"
              value={principle.text}
              onChange={(e) => {
                updatePrinciple(index, e.target.value);
                autoResizeTextarea(e.target as HTMLTextAreaElement);
              }}
              rows={1}
            />
            <div className="framework-principles__item-actions">
              {principle.is_user_added && (
                <span className="framework-principles__manual-badge">Manual</span>
              )}
              <button
                className="framework-principles__delete-btn"
                onClick={() => removePrinciple(index)}
                title="Remove principle"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="framework-principles__add-row">
        <input
          className="framework-principles__add-input"
          value={newPrincipleText}
          onChange={(e) => setNewPrincipleText(e.target.value)}
          placeholder="Add a principle manually..."
          onKeyDown={(e) => e.key === 'Enter' && addPrinciple()}
        />
        <button
          className="framework-principles__add-btn"
          onClick={addPrinciple}
          disabled={!newPrincipleText.trim()}
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        className="framework-principles__extract-more"
        onClick={handleStartExtraction}
        disabled={extracting}
      >
        <RefreshCw size={14} />
        Extract More Principles
      </button>

      <div className="framework-principles__actions">
        <div className="framework-principles__export-wrapper" ref={exportWrapperRef}>
          <button
            type="button"
            className="framework-principles__export-btn"
            onClick={() => setExportMenuOpen((v) => !v)}
            disabled={principles.length === 0 || exporting}
            title="Export framework principles"
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          {exportMenuOpen && (
            <div className="framework-principles__export-menu">
              <button type="button" onClick={() => handleExport('md')}>Markdown (.md)</button>
              <button type="button" onClick={() => handleExport('docx')}>Word Doc (.docx)</button>
              <button type="button" onClick={() => handleExport('txt')}>Plain Text (.txt)</button>
            </div>
          )}
        </div>
        <Button onClick={onBack} variant="secondary">Cancel</Button>
        <Button
          onClick={() => handleSave(false)}
          variant="secondary"
          disabled={saving || principles.length === 0}
          title="Store these principles without loading them into AI conversations. You can activate them later from the Frameworks manager."
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={() => handleSave(true)}
          variant="primary"
          disabled={saving || principles.length === 0}
          title="Store these principles AND include them in every AI conversation going forward. The AI will reference these principles when giving advice."
        >
          {saving ? 'Saving...' : 'Save and Activate'}
        </Button>
      </div>
    </div>
  );
}
