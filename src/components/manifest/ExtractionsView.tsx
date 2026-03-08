import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Heart, Download, FileText, FileCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ManifestItem, ManifestSummary, ManifestDeclaration, AIFrameworkPrinciple } from '../../lib/types';
import { exportExtractionsMd, exportExtractionsTxt, exportExtractionsDocx } from '../../lib/exportExtractions';
import type { BookExtractionGroup } from '../../lib/exportExtractions';
import './ExtractionsView.css';

interface ExtractionsViewProps {
  items: ManifestItem[];
  onBack: () => void;
}

type TabType = 'summary' | 'frameworks' | 'mast_content';

interface BookExtractions {
  bookId: string;
  bookTitle: string;
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
}

export function ExtractionsView({ items, onBack }: ExtractionsViewProps) {
  const { user } = useAuthContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [bookData, setBookData] = useState<Map<string, BookExtractions>>(new Map());
  const [loading, setLoading] = useState(false);

  const extractedItems = useMemo(
    () => items.filter((i) => i.extraction_status === 'completed'),
    [items],
  );

  // Auto-select first extracted item
  useEffect(() => {
    if (extractedItems.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set([extractedItems[0].id]));
    }
  }, [extractedItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch extractions for selected books
  const fetchExtractions = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setLoading(true);

    try {
      const [summaryRes, declRes, principleRes] = await Promise.all([
        supabase
          .from('manifest_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('manifest_item_id', ids)
          .order('manifest_item_id')
          .order('sort_order', { ascending: true }),
        supabase
          .from('manifest_declarations')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('manifest_item_id', ids)
          .order('manifest_item_id')
          .order('sort_order', { ascending: true }),
        supabase
          .from('ai_framework_principles')
          .select('*, ai_frameworks!inner(manifest_item_id, name)')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .in('ai_frameworks.manifest_item_id', ids)
          .order('sort_order', { ascending: true }),
      ]);

      const summaries = (summaryRes.data || []) as ManifestSummary[];
      const declarations = (declRes.data || []) as ManifestDeclaration[];
      const rawPrinciples = (principleRes.data || []) as Array<AIFrameworkPrinciple & { ai_frameworks: { manifest_item_id: string; name: string } }>;

      const newData = new Map<string, BookExtractions>();
      for (const id of ids) {
        const item = extractedItems.find((i) => i.id === id);
        newData.set(id, {
          bookId: id,
          bookTitle: item?.title || 'Unknown Book',
          summaries: summaries.filter((s) => s.manifest_item_id === id),
          declarations: declarations.filter((d) => d.manifest_item_id === id),
          principles: rawPrinciples
            .filter((p) => p.ai_frameworks.manifest_item_id === id)
            .map((p) => ({ ...p, framework_name: p.ai_frameworks.name })),
        });
      }
      setBookData(newData);
    } finally {
      setLoading(false);
    }
  }, [user, extractedItems]);

  useEffect(() => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      fetchExtractions(ids);
    } else {
      setBookData(new Map());
    }
  }, [selectedIds, fetchExtractions]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedData = useMemo(() => {
    const result: BookExtractions[] = [];
    for (const id of selectedIds) {
      const data = bookData.get(id);
      if (data) result.push(data);
    }
    return result;
  }, [selectedIds, bookData]);

  const totalCounts = useMemo(() => {
    let summaries = 0, frameworks = 0, declarations = 0;
    for (const d of selectedData) {
      summaries += d.summaries.length;
      frameworks += d.principles.length;
      declarations += d.declarations.length;
    }
    return { summaries, frameworks, declarations };
  }, [selectedData]);

  // --- Export ---
  const exportGroups = useMemo((): BookExtractionGroup[] => {
    return selectedData.map((d) => ({
      bookTitle: d.bookTitle,
      summaries: d.summaries,
      declarations: d.declarations,
      principles: d.principles,
    }));
  }, [selectedData]);

  const singleBookTitle = useMemo(() => {
    if (exportGroups.length === 1) return `${exportGroups[0].bookTitle} - Extractions`;
    return undefined;
  }, [exportGroups]);

  const handleExportMd = useCallback(() => {
    exportExtractionsMd(exportGroups, singleBookTitle);
  }, [exportGroups, singleBookTitle]);

  const handleExportTxt = useCallback(() => {
    exportExtractionsTxt(exportGroups, singleBookTitle);
  }, [exportGroups, singleBookTitle]);

  const handleExportDocx = useCallback(async () => {
    await exportExtractionsDocx(exportGroups, singleBookTitle);
  }, [exportGroups, singleBookTitle]);

  return (
    <div className="extractions-view">
      <div className="extractions-view__header">
        <button type="button" className="extractions-view__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <h2 className="extractions-view__title">Extractions</h2>
      </div>

      {extractedItems.length === 0 ? (
        <div className="extractions-view__empty">
          No books with extractions yet. Extract content from a book's detail page first.
        </div>
      ) : (
        <>
          {/* Book selector */}
          <div className="extractions-view__books">
            <div className="extractions-view__books-label">
              Select books ({selectedIds.size} of {extractedItems.length})
            </div>
            {extractedItems.map((item) => (
              <label key={item.id} className="extractions-view__book-item">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => handleToggle(item.id)}
                />
                <span className="extractions-view__book-title">{item.title}</span>
              </label>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <>
              {/* Export row */}
              <div className="extractions-view__export-row">
                <button type="button" className="extractions-view__export-btn" onClick={handleExportMd}>
                  <FileCode size={12} /> Export .md
                </button>
                <button type="button" className="extractions-view__export-btn" onClick={handleExportDocx}>
                  <FileText size={12} /> Export .docx
                </button>
                <button type="button" className="extractions-view__export-btn" onClick={handleExportTxt}>
                  <Download size={12} /> Export .txt
                </button>
              </div>

              {/* Tabs */}
              <div className="extractions-view__tabs">
                <button
                  type="button"
                  className={`extractions-view__tab${activeTab === 'summary' ? ' extractions-view__tab--active' : ''}`}
                  onClick={() => setActiveTab('summary')}
                >
                  Summary {totalCounts.summaries > 0 && <span className="extractions-view__tab-count">{totalCounts.summaries}</span>}
                </button>
                <button
                  type="button"
                  className={`extractions-view__tab${activeTab === 'frameworks' ? ' extractions-view__tab--active' : ''}`}
                  onClick={() => setActiveTab('frameworks')}
                >
                  Frameworks {totalCounts.frameworks > 0 && <span className="extractions-view__tab-count">{totalCounts.frameworks}</span>}
                </button>
                <button
                  type="button"
                  className={`extractions-view__tab${activeTab === 'mast_content' ? ' extractions-view__tab--active' : ''}`}
                  onClick={() => setActiveTab('mast_content')}
                >
                  Mast Content {totalCounts.declarations > 0 && <span className="extractions-view__tab-count">{totalCounts.declarations}</span>}
                </button>
              </div>

              {/* Content */}
              {loading ? (
                <div className="extractions-view__loading">Loading extractions...</div>
              ) : (
                <div className="extractions-view__content">
                  {selectedData.map((group) => (
                    <div key={group.bookId} className="extractions-view__book-section">
                      {selectedIds.size > 1 && (
                        <h3 className="extractions-view__book-heading">{group.bookTitle}</h3>
                      )}

                      {activeTab === 'summary' && (
                        group.summaries.length === 0 ? (
                          <div className="extractions-view__tab-empty">No summaries extracted.</div>
                        ) : (
                          group.summaries.map((s) => (
                            <div key={s.id} className="extractions-view__item">
                              <div className="extractions-view__item-row">
                                <span className="extractions-view__item-badge">{s.content_type.replace(/_/g, ' ')}</span>
                                {s.is_hearted && <Heart size={12} className="extractions-view__hearted" fill="currentColor" />}
                              </div>
                              <div className="extractions-view__item-text">{s.text}</div>
                              {s.section_title && (
                                <div className="extractions-view__item-section">{s.section_title}</div>
                              )}
                            </div>
                          ))
                        )
                      )}

                      {activeTab === 'frameworks' && (
                        group.principles.length === 0 ? (
                          <div className="extractions-view__tab-empty">No framework principles extracted.</div>
                        ) : (
                          <>
                            {group.principles[0]?.framework_name && (
                              <div className="extractions-view__framework-name">{group.principles[0].framework_name}</div>
                            )}
                            {group.principles.map((p) => (
                              <div key={p.id} className="extractions-view__item">
                                <div className="extractions-view__item-row">
                                  {p.is_hearted && <Heart size={12} className="extractions-view__hearted" fill="currentColor" />}
                                </div>
                                <div className="extractions-view__item-text">{p.text}</div>
                                {p.section_title && (
                                  <div className="extractions-view__item-section">{p.section_title}</div>
                                )}
                              </div>
                            ))}
                          </>
                        )
                      )}

                      {activeTab === 'mast_content' && (
                        group.declarations.length === 0 ? (
                          <div className="extractions-view__tab-empty">No declarations extracted.</div>
                        ) : (
                          group.declarations.map((d) => (
                            <div key={d.id} className="extractions-view__item">
                              <div className="extractions-view__item-row">
                                {d.value_name && <span className="extractions-view__item-badge">{d.value_name}</span>}
                                {d.is_hearted && <Heart size={12} className="extractions-view__hearted" fill="currentColor" />}
                              </div>
                              <div className="extractions-view__item-text">{d.declaration_text}</div>
                              {d.section_title && (
                                <div className="extractions-view__item-section">{d.section_title}</div>
                              )}
                            </div>
                          ))
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
