import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Download, FileText, FileCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ManifestSummary, ManifestDeclaration, AIFrameworkPrinciple } from '../../lib/types';
import { exportHeartedMd, exportHeartedTxt, exportHeartedDocx } from '../../lib/exportExtractions';
import type { BookExtractionGroup } from '../../lib/exportExtractions';
import './HeartedItemsView.css';

interface HeartedItemsViewProps {
  onBack: () => void;
}

interface BookGroup {
  bookId: string;
  bookTitle: string;
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
}

export function HeartedItemsView({ onBack }: HeartedItemsViewProps) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [bookGroups, setBookGroups] = useState<BookGroup[]>([]);

  // Fetch all hearted items
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [summaryRes, declRes, principleRes] = await Promise.all([
          supabase
            .from('manifest_summaries')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_hearted', true)
            .eq('is_deleted', false)
            .order('manifest_item_id')
            .order('sort_order', { ascending: true }),
          supabase
            .from('manifest_declarations')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_hearted', true)
            .eq('is_deleted', false)
            .order('manifest_item_id')
            .order('sort_order', { ascending: true }),
          supabase
            .from('ai_framework_principles')
            .select('*, ai_frameworks!inner(manifest_item_id, name)')
            .eq('user_id', user.id)
            .eq('is_hearted', true)
            .eq('is_deleted', false)
            .order('sort_order', { ascending: true }),
        ]);

        const summaries = (summaryRes.data || []) as ManifestSummary[];
        const declarations = (declRes.data || []) as ManifestDeclaration[];
        const rawPrinciples = (principleRes.data || []) as Array<AIFrameworkPrinciple & { ai_frameworks: { manifest_item_id: string; name: string } }>;

        // Get all unique manifest_item_ids
        const itemIds = new Set<string>();
        summaries.forEach((s) => itemIds.add(s.manifest_item_id));
        declarations.forEach((d) => itemIds.add(d.manifest_item_id));
        rawPrinciples.forEach((p) => itemIds.add(p.ai_frameworks.manifest_item_id));

        // Fetch book titles
        const { data: items } = await supabase
          .from('manifest_items')
          .select('id, title')
          .in('id', Array.from(itemIds));

        const titleMap = new Map((items || []).map((i: { id: string; title: string }) => [i.id, i.title]));

        // Group by book
        const groups: BookGroup[] = [];
        for (const bookId of itemIds) {
          const group: BookGroup = {
            bookId,
            bookTitle: titleMap.get(bookId) || 'Unknown Book',
            summaries: summaries.filter((s) => s.manifest_item_id === bookId),
            declarations: declarations.filter((d) => d.manifest_item_id === bookId),
            principles: rawPrinciples
              .filter((p) => p.ai_frameworks.manifest_item_id === bookId)
              .map((p) => ({ ...p, framework_name: p.ai_frameworks.name })),
          };
          if (group.summaries.length > 0 || group.declarations.length > 0 || group.principles.length > 0) {
            groups.push(group);
          }
        }

        setBookGroups(groups);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const totalCount = useMemo(() => {
    return bookGroups.reduce(
      (sum, g) => sum + g.summaries.length + g.declarations.length + g.principles.length,
      0,
    );
  }, [bookGroups]);

  // --- Export functions ---
  const exportGroups = useMemo((): BookExtractionGroup[] => {
    return bookGroups.map((g) => ({
      bookTitle: g.bookTitle,
      summaries: g.summaries,
      declarations: g.declarations,
      principles: g.principles,
    }));
  }, [bookGroups]);

  const handleExportMd = useCallback(() => {
    exportHeartedMd(exportGroups);
  }, [exportGroups]);

  const handleExportTxt = useCallback(() => {
    exportHeartedTxt(exportGroups);
  }, [exportGroups]);

  const handleExportDocx = useCallback(async () => {
    await exportHeartedDocx(exportGroups);
  }, [exportGroups]);

  if (loading) {
    return (
      <div className="hearted-items">
        <div className="hearted-items__header">
          <button type="button" className="hearted-items__back" onClick={onBack}>
            <ChevronLeft size={16} />
            Back
          </button>
          <h2 className="hearted-items__title">My Hearted Items</h2>
        </div>
        <div className="hearted-items__loading">Loading hearted items...</div>
      </div>
    );
  }

  return (
    <div className="hearted-items">
      <div className="hearted-items__header">
        <button type="button" className="hearted-items__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <h2 className="hearted-items__title">My Hearted Items</h2>
      </div>

      {totalCount > 0 && (
        <div className="hearted-items__export-row">
          <button type="button" className="hearted-items__export-btn" onClick={handleExportMd}>
            <FileCode size={12} />
            Export .md
          </button>
          <button type="button" className="hearted-items__export-btn" onClick={handleExportDocx}>
            <FileText size={12} />
            Export .docx
          </button>
          <button type="button" className="hearted-items__export-btn" onClick={handleExportTxt}>
            <Download size={12} />
            Export .txt
          </button>
        </div>
      )}

      {bookGroups.length === 0 ? (
        <div className="hearted-items__empty">
          No hearted items yet. Heart items you love across your books and they'll appear here.
        </div>
      ) : (
        bookGroups.map((group) => (
          <div key={group.bookId} className="hearted-items__book-section">
            <h3 className="hearted-items__book-title">{group.bookTitle}</h3>

            {group.summaries.length > 0 && (
              <>
                <div className="hearted-items__type-label">Key Insights</div>
                {group.summaries.map((s) => (
                  <div key={s.id} className="hearted-items__item">
                    <span className="hearted-items__item-badge">{s.content_type.replace(/_/g, ' ')}</span>
                    {s.text}
                  </div>
                ))}
              </>
            )}

            {group.principles.length > 0 && (
              <>
                <div className="hearted-items__type-label">
                  Framework Principles
                  {group.principles[0]?.framework_name && ` (${group.principles[0].framework_name})`}
                </div>
                {group.principles.map((p) => (
                  <div key={p.id} className="hearted-items__item">
                    {p.text}
                  </div>
                ))}
              </>
            )}

            {group.declarations.length > 0 && (
              <>
                <div className="hearted-items__type-label">Declarations</div>
                {group.declarations.map((d) => (
                  <div key={d.id} className="hearted-items__item">
                    {d.value_name && (
                      <span className="hearted-items__item-badge">{d.value_name}</span>
                    )}
                    {d.declaration_text}
                  </div>
                ))}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
