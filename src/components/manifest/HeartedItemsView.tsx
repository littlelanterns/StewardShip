import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Download, FileText, FileCode } from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ManifestSummary, ManifestDeclaration, AIFrameworkPrinciple } from '../../lib/types';
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

  const buildMarkdownContent = useCallback((): string => {
    const lines: string[] = [
      '# My Hearted Items',
      '',
      `Exported: ${new Date().toISOString().split('T')[0]}`,
      `Total items: ${totalCount}`,
      '',
    ];

    for (const group of bookGroups) {
      lines.push(`## ${group.bookTitle}`);
      lines.push('');

      if (group.summaries.length > 0) {
        lines.push('### Key Insights');
        for (const s of group.summaries) {
          lines.push(`- **[${s.content_type}]** ${s.text}`);
        }
        lines.push('');
      }

      if (group.principles.length > 0) {
        lines.push(`### Framework Principles${group.principles[0]?.framework_name ? ` (${group.principles[0].framework_name})` : ''}`);
        for (const p of group.principles) {
          lines.push(`- ${p.text}`);
        }
        lines.push('');
      }

      if (group.declarations.length > 0) {
        lines.push('### Declarations');
        for (const d of group.declarations) {
          const prefix = d.value_name ? `**${d.value_name}:** ` : '';
          lines.push(`- ${prefix}${d.declaration_text}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }, [bookGroups, totalCount]);

  const handleExportMd = useCallback(() => {
    const content = buildMarkdownContent();
    const blob = new Blob([content], { type: 'text/markdown' });
    triggerDownload(blob, `hearted-items-${new Date().toISOString().split('T')[0]}.md`);
  }, [buildMarkdownContent]);

  const handleExportTxt = useCallback(() => {
    // Strip markdown formatting for plain text
    const content = buildMarkdownContent()
      .replace(/^#{1,3}\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*\*/g, '');
    const blob = new Blob([content], { type: 'text/plain' });
    triggerDownload(blob, `hearted-items-${new Date().toISOString().split('T')[0]}.txt`);
  }, [buildMarkdownContent]);

  const handleExportDocx = useCallback(async () => {
    // Simple OOXML via JSZip
    const zip = new JSZip();

    const bodyXml: string[] = [];
    for (const group of bookGroups) {
      bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(group.bookTitle)}</w:t></w:r></w:p>`);

      if (group.summaries.length > 0) {
        bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Key Insights</w:t></w:r></w:p>`);
        for (const s of group.summaries) {
          bodyXml.push(`<w:p><w:r><w:t>${escapeXml(`[${s.content_type}] ${s.text}`)}</w:t></w:r></w:p>`);
        }
      }

      if (group.principles.length > 0) {
        bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Framework Principles</w:t></w:r></w:p>`);
        for (const p of group.principles) {
          bodyXml.push(`<w:p><w:r><w:t>${escapeXml(p.text)}</w:t></w:r></w:p>`);
        }
      }

      if (group.declarations.length > 0) {
        bodyXml.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Declarations</w:t></w:r></w:p>`);
        for (const d of group.declarations) {
          const prefix = d.value_name ? `[${d.value_name}] ` : '';
          bodyXml.push(`<w:p><w:r><w:t>${escapeXml(`${prefix}${d.declaration_text}`)}</w:t></w:r></w:p>`);
        }
      }
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>My Hearted Items</w:t></w:r></w:p>
    ${bodyXml.join('\n')}
  </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/document.xml', documentXml);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    triggerDownload(blob, `hearted-items-${new Date().toISOString().split('T')[0]}.docx`);
  }, [bookGroups]);

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
                    <span className="hearted-items__item-badge">{s.content_type}</span>
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
