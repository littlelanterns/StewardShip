import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Heart, Trash2, ChevronDown, ChevronRight, Anchor, Compass, RefreshCw, Sparkles, LayoutList, BookOpen, StickyNote, Lightbulb, Quote, Eye, Wrench, Users, CheckCircle, type LucideIcon } from 'lucide-react';
import { ChapterJumpOverlay } from './ChapterJumpOverlay';
import type {
  ManifestSummary,
  ManifestDeclaration,
  ManifestActionStep,
  ManifestQuestion,
  AIFrameworkPrinciple,
  BookGenre,
} from '../../lib/types';
import { DECLARATION_STYLE_LABELS, ACTION_STEP_CONTENT_TYPE_LABELS, QUESTION_CONTENT_TYPE_LABELS } from '../../lib/types';
import type { ActionStepContentType, QuestionContentType } from '../../lib/types';
import { Button, LoadingSpinner } from '../shared';
import './ExtractionTabs.css';

type TabType = 'summary' | 'frameworks' | 'action_steps' | 'mast_content' | 'questions';
type FilterMode = 'all' | 'hearted';
type ViewMode = 'tabs' | 'chapters' | 'notes';

// Content type → icon mapping for visual differentiation (Phase 4A)
const CONTENT_TYPE_ICON: Record<string, LucideIcon> = {
  key_concept: Lightbulb, insight: Lightbulb, theme: Lightbulb,
  story: BookOpen, metaphor: BookOpen, character_insight: BookOpen,
  lesson: Compass, principle: Compass, exercise: CheckCircle,
  quote: Quote,
  reflection: Eye, self_examination: Eye, recognition: Eye,
  implementation: Wrench, scenario: Wrench, project: Wrench,
  discussion: Users, conversation_starter: Users,
  practice: CheckCircle, habit: CheckCircle, daily_action: CheckCircle, weekly_practice: CheckCircle,
  // Declarations use Anchor (already imported)
  declaration: Anchor,
  // Frameworks use Compass
  framework: Compass,
};

function getTypeIcon(contentType: string): LucideIcon | null {
  return CONTENT_TYPE_ICON[contentType] || null;
}

/** Build extraction-item className with content type and hearted state */
function itemClass(contentType: string, isDeeper: boolean, isDeleting: boolean, isHearted: boolean): string {
  let cls = `extraction-item extraction-item--type-${contentType}`;
  if (isDeeper) cls += ' extraction-item--deeper';
  if (isDeleting) cls += ' extraction-item--deleting';
  if (isHearted) cls += ' extraction-item--hearted';
  return cls;
}

/** Render type badge with icon */
function TypeBadge({ contentType, label }: { contentType: string; label: string }) {
  const Icon = getTypeIcon(contentType);
  return (
    <div className="extraction-item__type-badge">
      {Icon && <Icon size={12} className="extraction-item__type-icon" />}
      {label}
    </div>
  );
}

/** Render tag chips on an extraction item */
function ItemTags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="extraction-item__tags">
      {tags.map((tag) => (
        <span key={tag} className="extraction-item__tag">{tag}</span>
      ))}
    </div>
  );
}

// --- Summary Tab ---

interface ExtractionProgressInfo {
  current: number;
  total: number;
  currentType: 'summary' | 'framework' | 'mast_content' | 'action_steps' | 'questions';
}

interface SummaryTabProps {
  summaries: ManifestSummary[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: (sectionTitle?: string) => void;
  filterMode: FilterMode;
  extractionProgress?: ExtractionProgressInfo | null;
}

function SummaryTab({
  summaries,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdateText,
  onUpdateNote,
  onGoDeeper,
  onReRun,
  filterMode,
  extractionProgress,
}: SummaryTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleAnimatedDelete = useCallback((id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onDelete(id);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }, [onDelete]);

  const visible = useMemo(() => {
    let items = summaries.filter((s) => !s.is_deleted);
    if (filterMode === 'hearted') items = items.filter((s) => s.is_hearted);
    return items;
  }, [summaries, filterMode]);

  const sections = useMemo(() => {
    const map = new Map<string, ManifestSummary[]>();
    for (const s of visible) {
      const key = s.section_title || '__full_book__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aIdx = a[1][0]?.section_index ?? 0;
      const bIdx = b[1][0]?.section_index ?? 0;
      return aIdx - bIdx;
    });
  }, [visible]);

  // Default chapters to collapsed when there are multiple sections
  const summaryInitRef = useRef(false);
  useEffect(() => {
    if (!summaryInitRef.current && sections.length > 1) {
      summaryInitRef.current = true;
      setCollapsedSections(new Set(sections.map(([key]) => key)));
    }
  }, [sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEdit = (item: ManifestSummary) => {
    setEditingId(item.id);
    setEditDraft(item.text);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      onUpdateText(editingId, editDraft.trim());
    }
    setEditingId(null);
  };

  const startNote = (item: ManifestSummary) => {
    setNotingId(item.id);
    setNoteDraft(item.user_note || '');
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null);
    }
    setNotingId(null);
  };

  if (extractingTab === 'summary' && visible.length === 0) {
    return (
      <div className="extraction-tab__loading">
        <LoadingSpinner />
        <p>Extracting summaries...</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="extraction-tab__empty">
        <p>No summaries yet. Click Extract above to analyze this book.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab">
      {extractingTab === 'summary' && (
        <div className="extraction-tab__progress">
          <div className="extraction-tab__progress-bar" />
          <span>
            {extractionProgress
              ? `Extracting section ${extractionProgress.current + 1} of ${extractionProgress.total} (Summary)...`
              : 'Extracting...'}
          </span>
        </div>
      )}

      <div className="extraction-tab__toolbar">
        {confirmReRun ? (
          <div className="extraction-tab__confirm">
            <span>Replace all summaries with fresh extraction?</span>
            <Button size="sm" onClick={() => { onReRun(); setConfirmReRun(false); }}>Re-run</Button>
            <Button size="sm" variant="text" onClick={() => setConfirmReRun(false)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(true)}>
            <RefreshCw size={12} /> Re-run
          </button>
        )}
      </div>

      {sections.map(([sectionKey, items]) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;
        return (
          <div key={sectionKey} className="extraction-tab__section">
            <button
              type="button"
              className="extraction-tab__section-header"
              onClick={() => toggleSection(sectionKey)}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="extraction-tab__section-title">{label}</span>
              <span className="extraction-tab__section-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="extraction-tab__section-items">
                {items.map((item) => (
                  <div key={item.id} className={itemClass(item.content_type, !!item.is_from_go_deeper, deletingIds.has(item.id), !!item.is_hearted)}>
                    <TypeBadge contentType={item.content_type} label={item.content_type.replace(/_/g, ' ')} />
                    {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-badge" />}

                    {editingId === item.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        rows={3}
                      />
                    ) : (
                      <p
                        className="extraction-item__text"
                        onClick={() => startEdit(item)}
                        title="Click to edit"
                      >
                        {item.text}
                      </p>
                    )}
                    <ItemTags tags={item.tags} />

                    <div className="extraction-item__actions">
                      <button
                        type="button"
                        className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                        onClick={() => onToggleHeart(item.id)}
                        title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                      >
                        <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === item.id ? saveNote() : startNote(item)}
                        title={item.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      <button
                        type="button"
                        className="extraction-item__delete"
                        onClick={() => handleAnimatedDelete(item.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === item.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={saveNote}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNotingId(null);
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : item.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNote(item)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {item.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  className="extraction-tab__go-deeper"
                  onClick={() => onGoDeeper(
                    sectionKey === '__full_book__' ? undefined : sectionKey,
                    items.map((i) => i.text),
                    items[0]?.section_index,
                  )}
                  disabled={extractingTab === 'summary'}
                >
                  Go Deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Frameworks Tab ---

interface FrameworksTabProps {
  principles: AIFrameworkPrinciple[];
  extractingTab: string | null;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onReRun?: () => Promise<void>;
  filterMode: FilterMode;
  hasFramework: boolean;
}

function FrameworksTab({
  principles,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdateNote,
  onReRun,
  filterMode,
  hasFramework,
}: FrameworksTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmReRun, setConfirmReRun] = useState(false);

  const handleAnimatedDelete = useCallback((id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onDelete(id);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }, [onDelete]);

  const visible = useMemo(() => {
    let items = principles.filter((p) => !p.is_deleted);
    if (filterMode === 'hearted') items = items.filter((p) => p.is_hearted);
    return items;
  }, [principles, filterMode]);

  const sections = useMemo(() => {
    const map = new Map<string, AIFrameworkPrinciple[]>();
    for (const p of visible) {
      const key = p.section_title || '__general__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [visible]);

  // Default chapters to collapsed when there are multiple sections
  const fwInitRef = useRef(false);
  useEffect(() => {
    if (!fwInitRef.current && sections.length > 1) {
      fwInitRef.current = true;
      setCollapsedSections(new Set(sections.map(([key]) => key)));
    }
  }, [sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startNote = (item: AIFrameworkPrinciple) => {
    setNotingId(item.id);
    setNoteDraft(item.user_note || '');
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null);
    }
    setNotingId(null);
  };

  if (extractingTab === 'framework' && visible.length === 0) {
    return (
      <div className="extraction-tab__loading">
        <LoadingSpinner />
        <p>Extracting framework principles...</p>
      </div>
    );
  }

  if (visible.length === 0 && !hasFramework) {
    return (
      <div className="extraction-tab__empty">
        <p>No framework principles extracted yet. Click Extract above to analyze this book.</p>
      </div>
    );
  }

  if (visible.length === 0 && filterMode === 'hearted') {
    return (
      <div className="extraction-tab__empty">
        <p>No hearted framework principles. Switch to "All" to see everything.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab">
      {extractingTab === 'framework' && (
        <div className="extraction-tab__progress">
          <div className="extraction-tab__progress-bar" />
          <span>Extracting...</span>
        </div>
      )}

      {onReRun && (
        <div className="extraction-tab__toolbar">
          {confirmReRun ? (
            <div className="extraction-tab__confirm">
              <span>Replace all frameworks with fresh extraction?</span>
              <Button size="sm" onClick={() => { onReRun(); setConfirmReRun(false); }}>Re-run</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmReRun(false)}>Cancel</Button>
            </div>
          ) : (
            <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(true)}>
              <RefreshCw size={12} /> Re-run
            </button>
          )}
        </div>
      )}

      {sections.map(([sectionKey, items]) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        const label = sectionKey === '__general__' ? 'General' : sectionKey;
        return (
          <div key={sectionKey} className="extraction-tab__section">
            <button
              type="button"
              className="extraction-tab__section-header"
              onClick={() => toggleSection(sectionKey)}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="extraction-tab__section-title">{label}</span>
              <span className="extraction-tab__section-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="extraction-tab__section-items">
                {items.map((item) => (
                  <div key={item.id} className={itemClass('framework', !!item.is_from_go_deeper, deletingIds.has(item.id), !!item.is_hearted)}>
                    <p className="extraction-item__text">
                      {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                      {item.text}
                    </p>
                    <div className="extraction-item__actions">
                      <button
                        type="button"
                        className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                        onClick={() => onToggleHeart(item.id)}
                      >
                        <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === item.id ? saveNote() : startNote(item)}
                        title={item.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      <button type="button" className="extraction-item__delete" onClick={() => handleAnimatedDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === item.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={saveNote}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNotingId(null);
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : item.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNote(item)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {item.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Action Steps Tab ---

interface ActionStepsTabProps {
  actionSteps: ManifestActionStep[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onSendToCompass: (id: string) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: (sectionTitle?: string) => void;
  filterMode: FilterMode;
  extractionProgress?: ExtractionProgressInfo | null;
}

function ActionStepsTab({
  actionSteps,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdateText,
  onUpdateNote,
  onSendToCompass,
  onGoDeeper,
  onReRun,
  filterMode,
  extractionProgress,
}: ActionStepsTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);
  const [sendingToCompass, setSendingToCompass] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleAnimatedDelete = useCallback((id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onDelete(id);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }, [onDelete]);

  const visible = useMemo(() => {
    let items = actionSteps.filter((a) => !a.is_deleted);
    if (filterMode === 'hearted') items = items.filter((a) => a.is_hearted);
    return items;
  }, [actionSteps, filterMode]);

  const sections = useMemo(() => {
    const map = new Map<string, ManifestActionStep[]>();
    for (const a of visible) {
      const key = a.section_title || '__full_book__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aIdx = a[1][0]?.section_index ?? 0;
      const bIdx = b[1][0]?.section_index ?? 0;
      return aIdx - bIdx;
    });
  }, [visible]);

  // Default chapters to collapsed when there are multiple sections
  const asInitRef = useRef(false);
  useEffect(() => {
    if (!asInitRef.current && sections.length > 1) {
      asInitRef.current = true;
      setCollapsedSections(new Set(sections.map(([key]) => key)));
    }
  }, [sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEdit = (item: ManifestActionStep) => {
    setEditingId(item.id);
    setEditDraft(item.text);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      onUpdateText(editingId, editDraft.trim());
    }
    setEditingId(null);
  };

  const startNote = (item: ManifestActionStep) => {
    setNotingId(item.id);
    setNoteDraft(item.user_note || '');
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null);
    }
    setNotingId(null);
  };

  const handleSendToCompass = useCallback(async (id: string) => {
    setSendingToCompass((prev) => new Set(prev).add(id));
    await onSendToCompass(id);
    setSendingToCompass((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onSendToCompass]);

  if (extractingTab === 'action_steps' && visible.length === 0) {
    return (
      <div className="extraction-tab__loading">
        <LoadingSpinner />
        <p>Extracting action steps...</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="extraction-tab__empty">
        <p>No action steps yet. Click Extract above to analyze this book.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab">
      {extractingTab === 'action_steps' && (
        <div className="extraction-tab__progress">
          <div className="extraction-tab__progress-bar" />
          <span>
            {extractionProgress
              ? `Extracting section ${extractionProgress.current + 1} of ${extractionProgress.total} (Action Steps)...`
              : 'Extracting...'}
          </span>
        </div>
      )}

      <div className="extraction-tab__toolbar">
        {confirmReRun ? (
          <div className="extraction-tab__confirm">
            <span>Replace all action steps with fresh extraction?</span>
            <Button size="sm" onClick={() => { onReRun(); setConfirmReRun(false); }}>Re-run</Button>
            <Button size="sm" variant="text" onClick={() => setConfirmReRun(false)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(true)}>
            <RefreshCw size={12} /> Re-run
          </button>
        )}
      </div>

      {sections.map(([sectionKey, items]) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;
        return (
          <div key={sectionKey} className="extraction-tab__section">
            <button
              type="button"
              className="extraction-tab__section-header"
              onClick={() => toggleSection(sectionKey)}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="extraction-tab__section-title">{label}</span>
              <span className="extraction-tab__section-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="extraction-tab__section-items">
                {items.map((item) => (
                  <div key={item.id} className={itemClass(item.content_type || 'framework', !!item.is_from_go_deeper, deletingIds.has(item.id), !!item.is_hearted)}>
                    <div className="extraction-item__type-badge">
                      {ACTION_STEP_CONTENT_TYPE_LABELS[item.content_type as ActionStepContentType] || item.content_type.replace(/_/g, ' ')}
                    </div>

                    {editingId === item.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        rows={3}
                      />
                    ) : (
                      <p
                        className="extraction-item__text"
                        onClick={() => startEdit(item)}
                        title="Click to edit"
                      >
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {item.text}
                      </p>
                    )}

                    <div className="extraction-item__actions">
                      <button
                        type="button"
                        className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                        onClick={() => onToggleHeart(item.id)}
                        title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                      >
                        <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === item.id ? saveNote() : startNote(item)}
                        title={item.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>

                      {item.sent_to_compass ? (
                        <span className="extraction-item__compass-sent">In Compass</span>
                      ) : (
                        <button
                          type="button"
                          className="extraction-item__send-compass"
                          onClick={() => handleSendToCompass(item.id)}
                          disabled={sendingToCompass.has(item.id)}
                          title="Send to Compass"
                        >
                          <Compass size={14} />
                          {sendingToCompass.has(item.id) ? 'Sending...' : 'Send to Compass'}
                        </button>
                      )}

                      <button type="button" className="extraction-item__delete" onClick={() => handleAnimatedDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === item.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={saveNote}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNotingId(null);
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : item.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNote(item)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {item.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  className="extraction-tab__go-deeper"
                  onClick={() => onGoDeeper(
                    sectionKey === '__full_book__' ? undefined : sectionKey,
                    items.map((i) => i.text),
                    items[0]?.section_index,
                  )}
                  disabled={extractingTab === 'action_steps'}
                >
                  Go Deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Mast Content Tab ---

interface MastContentTabProps {
  declarations: ManifestDeclaration[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onSendToMast: (id: string) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: (sectionTitle?: string) => void;
  filterMode: FilterMode;
  extractionProgress?: ExtractionProgressInfo | null;
}

function MastContentTab({
  declarations,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdate,
  onUpdateNote,
  onSendToMast,
  onGoDeeper,
  onReRun,
  filterMode,
  extractionProgress,
}: MastContentTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);
  const [sendingToMast, setSendingToMast] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleAnimatedDelete = useCallback((id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onDelete(id);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }, [onDelete]);

  const visible = useMemo(() => {
    let items = declarations.filter((d) => !d.is_deleted);
    if (filterMode === 'hearted') items = items.filter((d) => d.is_hearted);
    return items;
  }, [declarations, filterMode]);

  const sections = useMemo(() => {
    const map = new Map<string, ManifestDeclaration[]>();
    for (const d of visible) {
      const key = d.section_title || '__full_book__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aIdx = a[1][0]?.section_index ?? 0;
      const bIdx = b[1][0]?.section_index ?? 0;
      return aIdx - bIdx;
    });
  }, [visible]);

  // Default chapters to collapsed when there are multiple sections
  const mastInitRef = useRef(false);
  useEffect(() => {
    if (!mastInitRef.current && sections.length > 1) {
      mastInitRef.current = true;
      setCollapsedSections(new Set(sections.map(([key]) => key)));
    }
  }, [sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEdit = (item: ManifestDeclaration) => {
    setEditingId(item.id);
    setEditDraft(item.declaration_text);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      onUpdate(editingId, { declaration_text: editDraft.trim() });
    }
    setEditingId(null);
  };

  const startNote = (item: ManifestDeclaration) => {
    setNotingId(item.id);
    setNoteDraft(item.user_note || '');
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null);
    }
    setNotingId(null);
  };

  const handleSendToMast = useCallback(async (id: string) => {
    setSendingToMast((prev) => new Set(prev).add(id));
    await onSendToMast(id);
    setSendingToMast((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onSendToMast]);

  if (extractingTab === 'mast_content' && visible.length === 0) {
    return (
      <div className="extraction-tab__loading">
        <LoadingSpinner />
        <p>Extracting declarations...</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="extraction-tab__empty">
        <p>No declarations yet. Click Extract above to analyze this book.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab">
      {extractingTab === 'mast_content' && (
        <div className="extraction-tab__progress">
          <div className="extraction-tab__progress-bar" />
          <span>
            {extractionProgress
              ? `Extracting section ${extractionProgress.current + 1} of ${extractionProgress.total} (Mast Content)...`
              : 'Extracting...'}
          </span>
        </div>
      )}

      <div className="extraction-tab__toolbar">
        {confirmReRun ? (
          <div className="extraction-tab__confirm">
            <span>Replace all declarations with fresh extraction?</span>
            <Button size="sm" onClick={() => { onReRun(); setConfirmReRun(false); }}>Re-run</Button>
            <Button size="sm" variant="text" onClick={() => setConfirmReRun(false)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(true)}>
            <RefreshCw size={12} /> Re-run
          </button>
        )}
      </div>

      {sections.map(([sectionKey, items]) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;
        return (
          <div key={sectionKey} className="extraction-tab__section">
            <button
              type="button"
              className="extraction-tab__section-header"
              onClick={() => toggleSection(sectionKey)}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="extraction-tab__section-title">{label}</span>
              <span className="extraction-tab__section-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="extraction-tab__section-items">
                {items.map((item) => (
                  <div key={item.id} className={itemClass('declaration', !!item.is_from_go_deeper, deletingIds.has(item.id), !!item.is_hearted)}>
                    <div className="extraction-item__declaration-meta">
                      {item.value_name && (
                        <span className="extraction-item__value-name">{item.value_name}</span>
                      )}
                      <span className="extraction-item__style-label">
                        {DECLARATION_STYLE_LABELS[item.declaration_style]}
                      </span>
                    </div>

                    {editingId === item.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        rows={3}
                      />
                    ) : (
                      <p
                        className="extraction-item__text extraction-item__text--declaration"
                        onClick={() => startEdit(item)}
                        title="Click to edit"
                      >
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        &ldquo;{item.declaration_text}&rdquo;
                      </p>
                    )}

                    <div className="extraction-item__actions">
                      <button
                        type="button"
                        className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                        onClick={() => onToggleHeart(item.id)}
                      >
                        <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === item.id ? saveNote() : startNote(item)}
                        title={item.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>

                      {item.sent_to_mast ? (
                        <span className="extraction-item__mast-sent">In Mast</span>
                      ) : (
                        <button
                          type="button"
                          className="extraction-item__send-mast"
                          onClick={() => handleSendToMast(item.id)}
                          disabled={sendingToMast.has(item.id)}
                          title="Send to Mast"
                        >
                          <Anchor size={14} />
                          {sendingToMast.has(item.id) ? 'Sending...' : 'Send to Mast'}
                        </button>
                      )}

                      <button type="button" className="extraction-item__delete" onClick={() => handleAnimatedDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === item.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={saveNote}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNotingId(null);
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : item.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNote(item)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {item.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  className="extraction-tab__go-deeper"
                  onClick={() => onGoDeeper(
                    sectionKey === '__full_book__' ? undefined : sectionKey,
                    items.map((i) => i.declaration_text),
                    items[0]?.section_index,
                  )}
                  disabled={extractingTab === 'mast_content'}
                >
                  Go Deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Questions Tab ---

interface QuestionsTabProps {
  questions: ManifestQuestion[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onSendToPrompts: (id: string) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: (sectionTitle?: string) => void;
  filterMode: FilterMode;
  extractionProgress?: ExtractionProgressInfo | null;
}

function QuestionsTab({
  questions,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdateText,
  onUpdateNote,
  onSendToPrompts,
  onGoDeeper,
  onReRun,
  filterMode,
  extractionProgress,
}: QuestionsTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);
  const [sendingToPrompts, setSendingToPrompts] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleAnimatedDelete = useCallback((id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onDelete(id);
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }, [onDelete]);

  const visible = useMemo(() => {
    let items = questions.filter((q) => !q.is_deleted);
    if (filterMode === 'hearted') items = items.filter((q) => q.is_hearted);
    return items;
  }, [questions, filterMode]);

  const sections = useMemo(() => {
    const map = new Map<string, ManifestQuestion[]>();
    for (const q of visible) {
      const key = q.section_title || '__full_book__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aIdx = a[1][0]?.section_index ?? 0;
      const bIdx = b[1][0]?.section_index ?? 0;
      return aIdx - bIdx;
    });
  }, [visible]);

  // Default chapters to collapsed when there are multiple sections
  const qInitRef = useRef(false);
  useEffect(() => {
    if (!qInitRef.current && sections.length > 1) {
      qInitRef.current = true;
      setCollapsedSections(new Set(sections.map(([key]) => key)));
    }
  }, [sections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEdit = (item: ManifestQuestion) => {
    setEditingId(item.id);
    setEditDraft(item.text);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      onUpdateText(editingId, editDraft.trim());
    }
    setEditingId(null);
  };

  const startNote = (item: ManifestQuestion) => {
    setNotingId(item.id);
    setNoteDraft(item.user_note || '');
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null);
    }
    setNotingId(null);
  };

  const handleSendToPrompts = useCallback(async (id: string) => {
    setSendingToPrompts((prev) => new Set(prev).add(id));
    await onSendToPrompts(id);
    setSendingToPrompts((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onSendToPrompts]);

  if (extractingTab === 'questions' && visible.length === 0) {
    return (
      <div className="extraction-tab__loading">
        <LoadingSpinner />
        <p>Extracting questions...</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="extraction-tab__empty">
        <p>No questions yet. Click Extract above to analyze this book.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab">
      {extractingTab === 'questions' && (
        <div className="extraction-tab__progress">
          <div className="extraction-tab__progress-bar" />
          <span>
            {extractionProgress
              ? `Extracting section ${extractionProgress.current + 1} of ${extractionProgress.total} (Questions)...`
              : 'Extracting...'}
          </span>
        </div>
      )}

      <div className="extraction-tab__toolbar">
        {confirmReRun ? (
          <div className="extraction-tab__confirm">
            <span>Replace all questions with fresh extraction?</span>
            <Button size="sm" onClick={() => { onReRun(); setConfirmReRun(false); }}>Re-run</Button>
            <Button size="sm" variant="text" onClick={() => setConfirmReRun(false)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" className="extraction-tab__rerun-btn" onClick={() => setConfirmReRun(true)}>
            <RefreshCw size={12} /> Re-run
          </button>
        )}
      </div>

      {sections.map(([sectionKey, items]) => {
        const isCollapsed = collapsedSections.has(sectionKey);
        const label = sectionKey === '__full_book__' ? 'Full Book' : sectionKey;
        return (
          <div key={sectionKey} className="extraction-tab__section">
            <button
              type="button"
              className="extraction-tab__section-header"
              onClick={() => toggleSection(sectionKey)}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="extraction-tab__section-title">{label}</span>
              <span className="extraction-tab__section-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="extraction-tab__section-items">
                {items.map((item) => (
                  <div key={item.id} className={itemClass(item.content_type || 'framework', !!item.is_from_go_deeper, deletingIds.has(item.id), !!item.is_hearted)}>
                    <div className="extraction-item__type-badge">
                      {QUESTION_CONTENT_TYPE_LABELS[item.content_type as QuestionContentType] || item.content_type.replace(/_/g, ' ')}
                    </div>

                    {editingId === item.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        rows={3}
                      />
                    ) : (
                      <p
                        className="extraction-item__text"
                        onClick={() => startEdit(item)}
                        title="Click to edit"
                      >
                        {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {item.text}
                      </p>
                    )}

                    <div className="extraction-item__actions">
                      <button
                        type="button"
                        className={`extraction-item__heart${item.is_hearted ? ' extraction-item__heart--active' : ''}`}
                        onClick={() => onToggleHeart(item.id)}
                        title={item.is_hearted ? 'Remove heart' : 'Heart this'}
                      >
                        <Heart size={14} fill={item.is_hearted ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === item.id ? saveNote() : startNote(item)}
                        title={item.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>

                      {item.sent_to_prompts ? (
                        <span className="extraction-item__compass-sent">Added to Prompts</span>
                      ) : (
                        <button
                          type="button"
                          className="extraction-item__send-compass"
                          onClick={() => handleSendToPrompts(item.id)}
                          disabled={sendingToPrompts.has(item.id)}
                          title="Add to Journal Prompts"
                        >
                          <BookOpen size={14} />
                          {sendingToPrompts.has(item.id) ? 'Sending...' : 'Add to Journal Prompts'}
                        </button>
                      )}

                      <button type="button" className="extraction-item__delete" onClick={() => handleAnimatedDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === item.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={saveNote}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setNotingId(null);
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : item.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNote(item)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {item.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  className="extraction-tab__go-deeper"
                  onClick={() => onGoDeeper(
                    sectionKey === '__full_book__' ? undefined : sectionKey,
                    items.map((i) => i.text),
                    items[0]?.section_index,
                  )}
                  disabled={extractingTab === 'questions'}
                >
                  Go Deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Main ExtractionTabs ---

interface ExtractionTabsProps {
  manifestItemId: string;
  genres: BookGenre[];
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps: ManifestActionStep[];
  principles: AIFrameworkPrinciple[];
  extractingTab: string | null;
  hasFramework: boolean;
  extractionProgress?: ExtractionProgressInfo | null;
  // Summary actions
  onToggleSummaryHeart: (id: string) => void;
  onDeleteSummary: (id: string) => void;
  onUpdateSummaryText: (id: string, text: string) => void;
  onUpdateSummaryNote: (id: string, note: string | null) => void;
  onSummaryGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onSummaryReRun: (sectionTitle?: string) => void;
  // Framework actions
  onTogglePrincipleHeart: (id: string) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrincipleNote: (id: string, note: string | null) => void;
  onFrameworkReRun?: () => Promise<void>;
  // Action Step actions
  onToggleActionStepHeart: (id: string) => void;
  onDeleteActionStep: (id: string) => void;
  onUpdateActionStepText: (id: string, text: string) => void;
  onUpdateActionStepNote: (id: string, note: string | null) => void;
  onSendActionStepToCompass: (id: string) => void;
  onActionStepGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onActionStepReRun: (sectionTitle?: string) => void;
  // Declaration actions
  onToggleDeclarationHeart: (id: string) => void;
  onDeleteDeclaration: (id: string) => void;
  onUpdateDeclaration: (id: string, updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>) => void;
  onUpdateDeclarationNote: (id: string, note: string | null) => void;
  onSendDeclarationToMast: (id: string) => void;
  onDeclarationGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onDeclarationReRun: (sectionTitle?: string) => void;
  // Question actions
  questions: ManifestQuestion[];
  onToggleQuestionHeart: (id: string) => void;
  onDeleteQuestion: (id: string) => void;
  onUpdateQuestionText: (id: string, text: string) => void;
  onUpdateQuestionNote: (id: string, note: string | null) => void;
  onSendQuestionToPrompts: (id: string) => void;
  onQuestionGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onQuestionReRun: (sectionTitle?: string) => void;
}

export function ExtractionTabs({
  manifestItemId,
  genres,
  summaries,
  declarations,
  actionSteps,
  principles,
  extractingTab,
  hasFramework,
  extractionProgress,
  onToggleSummaryHeart,
  onDeleteSummary,
  onUpdateSummaryText,
  onUpdateSummaryNote,
  onSummaryGoDeeper,
  onSummaryReRun,
  onTogglePrincipleHeart,
  onDeletePrinciple,
  onUpdatePrincipleNote,
  onFrameworkReRun,
  onToggleActionStepHeart,
  onDeleteActionStep,
  onUpdateActionStepText,
  onUpdateActionStepNote,
  onSendActionStepToCompass,
  onActionStepGoDeeper,
  onActionStepReRun,
  onToggleDeclarationHeart,
  onDeleteDeclaration,
  onUpdateDeclaration,
  onUpdateDeclarationNote,
  onSendDeclarationToMast,
  onDeclarationGoDeeper,
  onDeclarationReRun,
  questions,
  onToggleQuestionHeart,
  onDeleteQuestion,
  onUpdateQuestionText,
  onUpdateQuestionNote,
  onSendQuestionToPrompts,
  onQuestionGoDeeper,
  onQuestionReRun,
}: ExtractionTabsProps) {
  // --- sessionStorage helpers ---
  const ssGet = (key: string): string | null => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const ssSet = (key: string, v: string) => { try { sessionStorage.setItem(key, v); } catch { /* */ } };

  const [activeTab, setActiveTabRaw] = useState<TabType>(() => {
    const stored = ssGet('manifest-active-tab');
    if (stored === 'summary' || stored === 'frameworks' || stored === 'action_steps' || stored === 'mast_content' || stored === 'questions') return stored;
    return 'summary';
  });
  const [filterMode, setFilterModeRaw] = useState<FilterMode>(() => {
    const stored = ssGet('manifest-filter-mode');
    return stored === 'hearted' ? 'hearted' : 'all';
  });
  const [viewMode, setViewModeRaw] = useState<ViewMode>(() => {
    const stored = ssGet('manifest-extraction-view');
    if (stored === 'tabs' || stored === 'chapters' || stored === 'notes') return stored;
    return 'tabs';
  });

  const setActiveTab = useCallback((tab: TabType) => { setActiveTabRaw(tab); ssSet('manifest-active-tab', tab); }, []);
  const setFilterMode = useCallback((updater: FilterMode | ((prev: FilterMode) => FilterMode)) => {
    setFilterModeRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      ssSet('manifest-filter-mode', next);
      return next;
    });
  }, []);
  const setViewMode = useCallback((vm: ViewMode) => { setViewModeRaw(vm); ssSet('manifest-extraction-view', vm); }, []);

  const summaryCount = summaries.filter((s) => !s.is_deleted).length;
  const frameworkCount = principles.filter((p) => !p.is_deleted).length;
  const actionStepCount = actionSteps.filter((a) => !a.is_deleted).length;
  const declarationCount = declarations.filter((d) => !d.is_deleted).length;
  const questionCount = questions.filter((q) => !q.is_deleted).length;

  // --- Scroll position persistence ---
  const scrollKeyRef = useRef(`manifest-scroll-${manifestItemId}-${activeTab}-${viewMode}`);
  scrollKeyRef.current = `manifest-scroll-${manifestItemId}-${activeTab}-${viewMode}`;

  // Save scroll on unmount
  useEffect(() => {
    return () => { ssSet(scrollKeyRef.current, String(window.scrollY)); };
  }, []);

  // Restore scroll after data loads (once per mount)
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    const hasData = summaryCount > 0 || frameworkCount > 0 || actionStepCount > 0 || declarationCount > 0 || questionCount > 0;
    if (!hasData) return;
    scrollRestoredRef.current = true;
    const saved = ssGet(scrollKeyRef.current);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    }
  }, [summaryCount, frameworkCount, actionStepCount, declarationCount, questionCount]);

  // Wrap tab switch to save/restore scroll
  const handleTabSwitch = useCallback((newTab: TabType) => {
    ssSet(`manifest-scroll-${manifestItemId}-${activeTab}-${viewMode}`, String(window.scrollY));
    setActiveTab(newTab);
    requestAnimationFrame(() => {
      const saved = ssGet(`manifest-scroll-${manifestItemId}-${newTab}-${viewMode}`);
      window.scrollTo(0, saved ? parseInt(saved, 10) : 0);
    });
  }, [manifestItemId, activeTab, viewMode, setActiveTab]);

  // Wrap view mode switch to save/restore scroll
  const handleViewModeSwitch = useCallback((newVM: ViewMode) => {
    ssSet(`manifest-scroll-${manifestItemId}-${activeTab}-${viewMode}`, String(window.scrollY));
    setViewMode(newVM);
    requestAnimationFrame(() => {
      const saved = ssGet(`manifest-scroll-${manifestItemId}-${activeTab}-${newVM}`);
      window.scrollTo(0, saved ? parseInt(saved, 10) : 0);
    });
  }, [manifestItemId, activeTab, viewMode, setViewMode]);

  // Compute chapter sections for jump overlay (used in both tabs and chapters view)
  const chapterSections = useMemo(() => {
    const currentItems = activeTab === 'summary' ? summaries.filter((s) => !s.is_deleted)
      : activeTab === 'action_steps' ? actionSteps.filter((a) => !a.is_deleted)
      : activeTab === 'mast_content' ? declarations.filter((d) => !d.is_deleted)
      : activeTab === 'questions' ? questions.filter((q) => !q.is_deleted)
      : [];
    // Group by section_title
    const sectionMap = new Map<string, number>();
    for (const item of currentItems) {
      const key = ('section_title' in item && item.section_title) || '__full_book__';
      sectionMap.set(key, (sectionMap.get(key) || 0) + 1);
    }
    // For frameworks, count principles
    if (activeTab === 'frameworks') {
      const fwItems = principles.filter((p) => !p.is_deleted);
      for (const p of fwItems) {
        const key = p.section_title || '__full_book__';
        sectionMap.set(key, (sectionMap.get(key) || 0) + 1);
      }
    }
    return Array.from(sectionMap.entries()).map(([key, count]) => ({
      key,
      title: key === '__full_book__' ? 'Full Book' : key,
      itemCount: count,
    }));
  }, [activeTab, summaries, actionSteps, declarations, questions, principles]);

  const jumpHeaderSelector = viewMode === 'chapters'
    ? '.chapter-view__chapter-header'
    : '.extraction-tab__section-header';

  return (
    <div className="extraction-tabs">
      {/* Chapter jump overlay */}
      <ChapterJumpOverlay sections={chapterSections} headerSelector={jumpHeaderSelector} />
      {/* Tab bar */}
      <div className="extraction-tabs__bar">
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'summary' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => handleTabSwitch('summary')}
        >
          Summary {summaryCount > 0 && <span className="extraction-tabs__tab-count">{summaryCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'frameworks' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => handleTabSwitch('frameworks')}
        >
          Frameworks {frameworkCount > 0 && <span className="extraction-tabs__tab-count">{frameworkCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'action_steps' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => handleTabSwitch('action_steps')}
        >
          Action Steps {actionStepCount > 0 && <span className="extraction-tabs__tab-count">{actionStepCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'mast_content' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => handleTabSwitch('mast_content')}
        >
          Mast {declarationCount > 0 && <span className="extraction-tabs__tab-count">{declarationCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'questions' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => handleTabSwitch('questions')}
        >
          Questions {questionCount > 0 && <span className="extraction-tabs__tab-count">{questionCount}</span>}
        </button>
      </div>

      {/* Filter + view mode toggle */}
      <div className="extraction-tabs__filter">
        <button
          type="button"
          className={`extraction-tabs__filter-btn${filterMode === 'hearted' ? ' extraction-tabs__filter-btn--active' : ''}`}
          onClick={() => setFilterMode((m) => m === 'hearted' ? 'all' : 'hearted')}
        >
          <Heart size={12} fill={filterMode === 'hearted' ? 'currentColor' : 'none'} />
          {filterMode === 'hearted' ? 'Hearted' : 'All'}
        </button>
        <div className="extraction-tabs__view-toggle">
          <button
            type="button"
            className={`extraction-tabs__view-btn${viewMode === 'tabs' ? ' extraction-tabs__view-btn--active' : ''}`}
            onClick={() => handleViewModeSwitch('tabs')}
            title="View by tab"
          >
            <LayoutList size={14} />
          </button>
          <button
            type="button"
            className={`extraction-tabs__view-btn${viewMode === 'chapters' ? ' extraction-tabs__view-btn--active' : ''}`}
            onClick={() => handleViewModeSwitch('chapters')}
            title="View by chapter"
          >
            <BookOpen size={14} />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="extraction-tabs__content">
        {viewMode === 'tabs' ? (
          <>
            {activeTab === 'summary' && (
              <SummaryTab
                summaries={summaries}
                extractingTab={extractingTab}
                genres={genres}
                manifestItemId={manifestItemId}
                onToggleHeart={onToggleSummaryHeart}
                onDelete={onDeleteSummary}
                onUpdateText={onUpdateSummaryText}
                onUpdateNote={onUpdateSummaryNote}
                onGoDeeper={onSummaryGoDeeper}
                onReRun={onSummaryReRun}
                filterMode={filterMode}
                extractionProgress={extractionProgress}
              />
            )}
            {activeTab === 'frameworks' && (
              <FrameworksTab
                principles={principles}
                extractingTab={extractingTab}
                onToggleHeart={onTogglePrincipleHeart}
                onDelete={onDeletePrinciple}
                onUpdateNote={onUpdatePrincipleNote}
                onReRun={onFrameworkReRun}
                filterMode={filterMode}
                hasFramework={hasFramework}
              />
            )}
            {activeTab === 'action_steps' && (
              <ActionStepsTab
                actionSteps={actionSteps}
                extractingTab={extractingTab}
                genres={genres}
                manifestItemId={manifestItemId}
                onToggleHeart={onToggleActionStepHeart}
                onDelete={onDeleteActionStep}
                onUpdateText={onUpdateActionStepText}
                onUpdateNote={onUpdateActionStepNote}
                onSendToCompass={onSendActionStepToCompass}
                onGoDeeper={onActionStepGoDeeper}
                onReRun={onActionStepReRun}
                filterMode={filterMode}
                extractionProgress={extractionProgress}
              />
            )}
            {activeTab === 'mast_content' && (
              <MastContentTab
                declarations={declarations}
                extractingTab={extractingTab}
                genres={genres}
                manifestItemId={manifestItemId}
                onToggleHeart={onToggleDeclarationHeart}
                onDelete={onDeleteDeclaration}
                onUpdate={onUpdateDeclaration}
                onUpdateNote={onUpdateDeclarationNote}
                onSendToMast={onSendDeclarationToMast}
                onGoDeeper={onDeclarationGoDeeper}
                onReRun={onDeclarationReRun}
                filterMode={filterMode}
                extractionProgress={extractionProgress}
              />
            )}
            {activeTab === 'questions' && (
              <QuestionsTab
                questions={questions}
                extractingTab={extractingTab}
                genres={genres}
                manifestItemId={manifestItemId}
                onToggleHeart={onToggleQuestionHeart}
                onDelete={onDeleteQuestion}
                onUpdateText={onUpdateQuestionText}
                onUpdateNote={onUpdateQuestionNote}
                onSendToPrompts={onSendQuestionToPrompts}
                onGoDeeper={onQuestionGoDeeper}
                onReRun={onQuestionReRun}
                filterMode={filterMode}
                extractionProgress={extractionProgress}
              />
            )}
          </>
        ) : (
          <ChapterView
            summaries={summaries}
            principles={principles}
            actionSteps={actionSteps}
            declarations={declarations}
            questions={questions}
            filterMode={filterMode}
            onUpdateNote={(id, note, type) => {
              if (type === 'summary') onUpdateSummaryNote(id, note);
              else if (type === 'principle') onUpdatePrincipleNote(id, note);
              else if (type === 'action_step') onUpdateActionStepNote(id, note);
              else if (type === 'declaration') onUpdateDeclarationNote(id, note);
              else if (type === 'question') onUpdateQuestionNote(id, note);
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- Chapter View (read-only aggregated view per chapter) ---

interface ChapterViewProps {
  summaries: ManifestSummary[];
  principles: AIFrameworkPrinciple[];
  actionSteps: ManifestActionStep[];
  declarations: ManifestDeclaration[];
  questions: ManifestQuestion[];
  filterMode: FilterMode;
  onUpdateNote: (id: string, note: string | null, type: 'summary' | 'declaration' | 'action_step' | 'principle' | 'question') => void;
}

function ChapterView({ summaries, principles, actionSteps, declarations, questions, filterMode, onUpdateNote }: ChapterViewProps) {
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [notingType, setNotingType] = useState<'summary' | 'declaration' | 'action_step' | 'principle' | 'question'>('summary');

  // Collect all unique section titles and their indexes across all data
  const chapters = useMemo(() => {
    const sectionMap = new Map<string, number>();

    const addItem = (title: string | null, index: number) => {
      const key = title || '__full_book__';
      if (!sectionMap.has(key) || (sectionMap.get(key)! > index)) {
        sectionMap.set(key, index);
      }
    };

    for (const s of summaries) if (!s.is_deleted && (filterMode !== 'hearted' || s.is_hearted)) addItem(s.section_title, s.section_index ?? 0);
    for (const p of principles) if (!p.is_deleted && (filterMode !== 'hearted' || p.is_hearted)) addItem(p.section_title, 0);
    for (const a of actionSteps) if (!a.is_deleted && (filterMode !== 'hearted' || a.is_hearted)) addItem(a.section_title, a.section_index ?? 0);
    for (const d of declarations) if (!d.is_deleted && (filterMode !== 'hearted' || d.is_hearted)) addItem(d.section_title, d.section_index ?? 0);
    for (const q of questions) if (!q.is_deleted && (filterMode !== 'hearted' || q.is_hearted)) addItem(q.section_title, q.section_index ?? 0);

    return Array.from(sectionMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key);
  }, [summaries, principles, actionSteps, declarations, questions, filterMode]);

  // Default chapters to collapsed when there are multiple
  const cvInitRef = useRef(false);
  useEffect(() => {
    if (!cvInitRef.current && chapters.length > 1) {
      cvInitRef.current = true;
      setCollapsedChapters(new Set(chapters));
    }
  }, [chapters]);

  const filterItems = <T extends { is_deleted?: boolean; is_hearted?: boolean }>(items: T[]): T[] => {
    let filtered = items.filter((i) => !i.is_deleted);
    if (filterMode === 'hearted') filtered = filtered.filter((i) => i.is_hearted);
    return filtered;
  };

  const toggleChapter = (key: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startNote = (id: string, currentNote: string | null, type: 'summary' | 'declaration' | 'action_step' | 'principle' | 'question') => {
    setNotingId(id);
    setNoteDraft(currentNote || '');
    setNotingType(type);
  };

  const saveNote = () => {
    if (notingId) {
      onUpdateNote(notingId, noteDraft.trim() || null, notingType);
    }
    setNotingId(null);
  };

  if (chapters.length === 0) {
    return (
      <div className="extraction-tab__empty">
        <p>No extraction content to display.</p>
      </div>
    );
  }

  return (
    <div className="extraction-tab chapter-view">
      {chapters.map((chapterKey) => {
        const isCollapsed = collapsedChapters.has(chapterKey);
        const label = chapterKey === '__full_book__' ? 'Full Book' : chapterKey;
        const matchTitle = chapterKey === '__full_book__' ? null : chapterKey;

        const chSummaries = filterItems(summaries.filter((s) => (s.section_title || null) === matchTitle));
        const chPrinciples = filterItems(principles.filter((p) => (p.section_title || null) === matchTitle));
        const chActionSteps = filterItems(actionSteps.filter((a) => (a.section_title || null) === matchTitle));
        const chDeclarations = filterItems(declarations.filter((d) => (d.section_title || null) === matchTitle));
        const chQuestions = filterItems(questions.filter((q) => (q.section_title || null) === matchTitle));
        const totalCount = chSummaries.length + chPrinciples.length + chActionSteps.length + chDeclarations.length + chQuestions.length;

        if (totalCount === 0) return null;

        return (
          <div key={chapterKey} className="chapter-view__chapter">
            <button
              type="button"
              className="chapter-view__chapter-header"
              onClick={() => toggleChapter(chapterKey)}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <span className="chapter-view__chapter-title">{label}</span>
              <span className="extraction-tab__section-count">{totalCount}</span>
            </button>

            {!isCollapsed && (
              <div className="chapter-view__chapter-content">
                {chSummaries.length > 0 && (
                  <div className="chapter-view__type-group">
                    <div className="chapter-view__type-label">Summary</div>
                    {chSummaries.map((item) => (
                      <div key={item.id} className={itemClass(item.content_type || 'framework', !!item.is_from_go_deeper, false, !!item.is_hearted)}>
                        <div className="extraction-item__type-badge">{item.content_type.replace(/_/g, ' ')}</div>
                        <p className="extraction-item__text">
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                        <div className="extraction-item__actions">
                          {item.is_hearted && <Heart size={12} className="chapter-view__hearted-icon" fill="currentColor" />}
                          <button
                            type="button"
                            className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                            onClick={() => notingId === item.id ? saveNote() : startNote(item.id, item.user_note, 'summary')}
                            title={item.user_note ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {notingId === item.id ? (
                          <textarea
                            className="extraction-item__note-textarea"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={saveNote}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setNotingId(null);
                            }}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                          />
                        ) : item.user_note ? (
                          <div className="extraction-item__note" onClick={() => startNote(item.id, item.user_note, 'summary')}>
                            <span className="extraction-item__note-label">NOTE</span>
                            {item.user_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {chPrinciples.length > 0 && (
                  <div className="chapter-view__type-group">
                    <div className="chapter-view__type-label">Frameworks</div>
                    {chPrinciples.map((item) => (
                      <div key={item.id} className={itemClass('framework', !!item.is_from_go_deeper, false, !!item.is_hearted)}>
                        <p className="extraction-item__text">
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                        <div className="extraction-item__actions">
                          {item.is_hearted && <Heart size={12} className="chapter-view__hearted-icon" fill="currentColor" />}
                          <button
                            type="button"
                            className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                            onClick={() => notingId === item.id ? saveNote() : startNote(item.id, item.user_note, 'principle')}
                            title={item.user_note ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {notingId === item.id ? (
                          <textarea
                            className="extraction-item__note-textarea"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={saveNote}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setNotingId(null);
                            }}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                          />
                        ) : item.user_note ? (
                          <div className="extraction-item__note" onClick={() => startNote(item.id, item.user_note, 'principle')}>
                            <span className="extraction-item__note-label">NOTE</span>
                            {item.user_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {chActionSteps.length > 0 && (
                  <div className="chapter-view__type-group">
                    <div className="chapter-view__type-label">Action Steps</div>
                    {chActionSteps.map((item) => (
                      <div key={item.id} className={itemClass(item.content_type || 'framework', !!item.is_from_go_deeper, false, !!item.is_hearted)}>
                        <div className="extraction-item__type-badge">
                          {ACTION_STEP_CONTENT_TYPE_LABELS[item.content_type as ActionStepContentType] || item.content_type.replace(/_/g, ' ')}
                        </div>
                        <p className="extraction-item__text">
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                        <div className="extraction-item__actions">
                          {item.is_hearted && <Heart size={12} className="chapter-view__hearted-icon" fill="currentColor" />}
                          <button
                            type="button"
                            className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                            onClick={() => notingId === item.id ? saveNote() : startNote(item.id, item.user_note, 'action_step')}
                            title={item.user_note ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {notingId === item.id ? (
                          <textarea
                            className="extraction-item__note-textarea"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={saveNote}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setNotingId(null);
                            }}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                          />
                        ) : item.user_note ? (
                          <div className="extraction-item__note" onClick={() => startNote(item.id, item.user_note, 'action_step')}>
                            <span className="extraction-item__note-label">NOTE</span>
                            {item.user_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {chDeclarations.length > 0 && (
                  <div className="chapter-view__type-group">
                    <div className="chapter-view__type-label">Mast Content</div>
                    {chDeclarations.map((item) => (
                      <div key={item.id} className={itemClass('declaration', !!item.is_from_go_deeper, false, !!item.is_hearted)}>
                        <div className="extraction-item__declaration-meta">
                          {item.value_name && <span className="extraction-item__value-name">{item.value_name}</span>}
                          <span className="extraction-item__style-label">{DECLARATION_STYLE_LABELS[item.declaration_style]}</span>
                        </div>
                        <p className="extraction-item__text extraction-item__text--declaration">
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          &ldquo;{item.declaration_text}&rdquo;
                        </p>
                        <div className="extraction-item__actions">
                          {item.is_hearted && <Heart size={12} className="chapter-view__hearted-icon" fill="currentColor" />}
                          <button
                            type="button"
                            className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                            onClick={() => notingId === item.id ? saveNote() : startNote(item.id, item.user_note, 'declaration')}
                            title={item.user_note ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {notingId === item.id ? (
                          <textarea
                            className="extraction-item__note-textarea"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={saveNote}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setNotingId(null);
                            }}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                          />
                        ) : item.user_note ? (
                          <div className="extraction-item__note" onClick={() => startNote(item.id, item.user_note, 'declaration')}>
                            <span className="extraction-item__note-label">NOTE</span>
                            {item.user_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {chQuestions.length > 0 && (
                  <div className="chapter-view__type-group">
                    <div className="chapter-view__type-label">Questions</div>
                    {chQuestions.map((item) => (
                      <div key={item.id} className={itemClass(item.content_type || 'framework', !!item.is_from_go_deeper, false, !!item.is_hearted)}>
                        <div className="extraction-item__type-badge">
                          {QUESTION_CONTENT_TYPE_LABELS[item.content_type as QuestionContentType] || item.content_type.replace(/_/g, ' ')}
                        </div>
                        <p className="extraction-item__text">
                          {item.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                          {item.text}
                        </p>
                        <div className="extraction-item__actions">
                          {item.is_hearted && <Heart size={12} className="chapter-view__hearted-icon" fill="currentColor" />}
                          <button
                            type="button"
                            className={`extraction-item__note-btn${item.user_note ? ' extraction-item__note-btn--active' : ''}`}
                            onClick={() => notingId === item.id ? saveNote() : startNote(item.id, item.user_note, 'question')}
                            title={item.user_note ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {notingId === item.id ? (
                          <textarea
                            className="extraction-item__note-textarea"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={saveNote}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setNotingId(null);
                            }}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                          />
                        ) : item.user_note ? (
                          <div className="extraction-item__note" onClick={() => startNote(item.id, item.user_note, 'question')}>
                            <span className="extraction-item__note-label">NOTE</span>
                            {item.user_note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
