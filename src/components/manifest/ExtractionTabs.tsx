import { useState, useMemo, useCallback } from 'react';
import { Heart, Trash2, ChevronDown, ChevronRight, Anchor, RefreshCw, Sparkles } from 'lucide-react';
import type {
  ManifestSummary,
  ManifestDeclaration,
  AIFrameworkPrinciple,
  BookGenre,
} from '../../lib/types';
import { DECLARATION_STYLE_LABELS } from '../../lib/types';
import { Button, LoadingSpinner } from '../shared';
import './ExtractionTabs.css';

type TabType = 'summary' | 'frameworks' | 'mast_content';
type FilterMode = 'all' | 'hearted';

// --- Summary Tab ---

interface SummaryTabProps {
  summaries: ManifestSummary[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: () => void;
  filterMode: FilterMode;
}

function SummaryTab({
  summaries,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdateText,
  onGoDeeper,
  onReRun,
  filterMode,
}: SummaryTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);

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
          <span>Extracting...</span>
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
                  <div key={item.id} className={`extraction-item${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
                    <div className="extraction-item__type-badge">{item.content_type.replace(/_/g, ' ')}</div>

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
                        className="extraction-item__delete"
                        onClick={() => onDelete(item.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
  onViewFramework: () => void;
  filterMode: FilterMode;
  hasFramework: boolean;
}

function FrameworksTab({
  principles,
  extractingTab,
  onToggleHeart,
  onDelete,
  onViewFramework,
  filterMode,
  hasFramework,
}: FrameworksTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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

      {hasFramework && (
        <div className="extraction-tab__toolbar">
          <button type="button" className="extraction-tab__rerun-btn" onClick={onViewFramework}>
            View full framework editor
          </button>
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
                  <div key={item.id} className={`extraction-item${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
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
                      <button type="button" className="extraction-item__delete" onClick={() => onDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
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

// --- Mast Content Tab ---

interface MastContentTabProps {
  declarations: ManifestDeclaration[];
  extractingTab: string | null;
  genres: BookGenre[];
  manifestItemId: string;
  onToggleHeart: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>) => void;
  onSendToMast: (id: string) => void;
  onGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onReRun: () => void;
  filterMode: FilterMode;
}

function MastContentTab({
  declarations,
  extractingTab,
  onToggleHeart,
  onDelete,
  onUpdate,
  onSendToMast,
  onGoDeeper,
  onReRun,
  filterMode,
}: MastContentTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmReRun, setConfirmReRun] = useState(false);
  const [sendingToMast, setSendingToMast] = useState<Set<string>>(new Set());

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
          <span>Extracting...</span>
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
                  <div key={item.id} className={`extraction-item extraction-item--declaration${item.is_from_go_deeper ? ' extraction-item--deeper' : ''}`}>
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

                      <button type="button" className="extraction-item__delete" onClick={() => onDelete(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
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

// --- Main ExtractionTabs ---

interface ExtractionTabsProps {
  manifestItemId: string;
  genres: BookGenre[];
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  principles: AIFrameworkPrinciple[];
  extractingTab: string | null;
  hasFramework: boolean;
  // Summary actions
  onToggleSummaryHeart: (id: string) => void;
  onDeleteSummary: (id: string) => void;
  onUpdateSummaryText: (id: string, text: string) => void;
  onSummaryGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onSummaryReRun: () => void;
  // Framework actions
  onTogglePrincipleHeart: (id: string) => void;
  onDeletePrinciple: (id: string) => void;
  onViewFramework: () => void;
  // Declaration actions
  onToggleDeclarationHeart: (id: string) => void;
  onDeleteDeclaration: (id: string) => void;
  onUpdateDeclaration: (id: string, updates: Partial<Pick<ManifestDeclaration, 'declaration_text' | 'value_name' | 'declaration_style'>>) => void;
  onSendDeclarationToMast: (id: string) => void;
  onDeclarationGoDeeper: (sectionTitle: string | undefined, existingItems: string[], sectionIndex?: number) => void;
  onDeclarationReRun: () => void;
}

export function ExtractionTabs({
  manifestItemId,
  genres,
  summaries,
  declarations,
  principles,
  extractingTab,
  hasFramework,
  onToggleSummaryHeart,
  onDeleteSummary,
  onUpdateSummaryText,
  onSummaryGoDeeper,
  onSummaryReRun,
  onTogglePrincipleHeart,
  onDeletePrinciple,
  onViewFramework,
  onToggleDeclarationHeart,
  onDeleteDeclaration,
  onUpdateDeclaration,
  onSendDeclarationToMast,
  onDeclarationGoDeeper,
  onDeclarationReRun,
}: ExtractionTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const summaryCount = summaries.filter((s) => !s.is_deleted).length;
  const frameworkCount = principles.filter((p) => !p.is_deleted).length;
  const declarationCount = declarations.filter((d) => !d.is_deleted).length;

  return (
    <div className="extraction-tabs">
      {/* Tab bar */}
      <div className="extraction-tabs__bar">
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'summary' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary {summaryCount > 0 && <span className="extraction-tabs__tab-count">{summaryCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'frameworks' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('frameworks')}
        >
          Frameworks {frameworkCount > 0 && <span className="extraction-tabs__tab-count">{frameworkCount}</span>}
        </button>
        <button
          type="button"
          className={`extraction-tabs__tab${activeTab === 'mast_content' ? ' extraction-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('mast_content')}
        >
          Mast Content {declarationCount > 0 && <span className="extraction-tabs__tab-count">{declarationCount}</span>}
        </button>
      </div>

      {/* Filter toggle */}
      <div className="extraction-tabs__filter">
        <button
          type="button"
          className={`extraction-tabs__filter-btn${filterMode === 'hearted' ? ' extraction-tabs__filter-btn--active' : ''}`}
          onClick={() => setFilterMode((m) => m === 'hearted' ? 'all' : 'hearted')}
        >
          <Heart size={12} fill={filterMode === 'hearted' ? 'currentColor' : 'none'} />
          {filterMode === 'hearted' ? 'Hearted' : 'All'}
        </button>
      </div>

      {/* Tab content */}
      <div className="extraction-tabs__content">
        {activeTab === 'summary' && (
          <SummaryTab
            summaries={summaries}
            extractingTab={extractingTab}
            genres={genres}
            manifestItemId={manifestItemId}
            onToggleHeart={onToggleSummaryHeart}
            onDelete={onDeleteSummary}
            onUpdateText={onUpdateSummaryText}
            onGoDeeper={onSummaryGoDeeper}
            onReRun={onSummaryReRun}
            filterMode={filterMode}
          />
        )}
        {activeTab === 'frameworks' && (
          <FrameworksTab
            principles={principles}
            extractingTab={extractingTab}
            onToggleHeart={onTogglePrincipleHeart}
            onDelete={onDeletePrinciple}
            onViewFramework={onViewFramework}
            filterMode={filterMode}
            hasFramework={hasFramework}
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
            onSendToMast={onSendDeclarationToMast}
            onGoDeeper={onDeclarationGoDeeper}
            onReRun={onDeclarationReRun}
            filterMode={filterMode}
          />
        )}
      </div>
    </div>
  );
}
