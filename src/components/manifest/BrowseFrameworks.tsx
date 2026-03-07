import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react';
import type { AIFramework, ManifestItem } from '../../lib/types';
import {
  exportAggregatedAsMarkdown,
  exportAggregatedAsTxt,
  exportAggregatedAsDocx,
} from '../../lib/exportFramework';
import './BrowseFrameworks.css';

interface BrowseFrameworksProps {
  frameworks: AIFramework[];
  items: ManifestItem[];
  onSelectFramework: (fw: AIFramework) => void;
  onBack: () => void;
}

export default function BrowseFrameworks({
  frameworks,
  items,
  onSelectFramework,
  onBack,
}: BrowseFrameworksProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  // Derive sorted tag list from all frameworks (most-used first)
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    frameworks.forEach((fw) => {
      (fw.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [frameworks]);

  // Filter frameworks by active tag
  const visibleFrameworks = useMemo(() =>
    activeTag
      ? frameworks.filter((fw) => (fw.tags || []).includes(activeTag))
      : frameworks,
    [frameworks, activeTag],
  );

  const handleAccordionToggle = (fwId: string) => {
    setExpandedId((prev) => (prev === fwId ? null : fwId));
  };

  // Build export data from visible frameworks
  const buildExportData = useCallback(() => {
    return {
      frameworks: visibleFrameworks.map((fw) => {
        const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
        return {
          frameworkName: fw.name,
          sourceTitle: sourceItem?.title || 'Unknown source',
          principles: (fw.principles || [])
            .filter((p) => p.is_included !== false)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => ({ text: p.text, sort_order: p.sort_order, is_included: true })),
        };
      }),
    };
  }, [visibleFrameworks, items]);

  const handleExport = useCallback(async (format: 'md' | 'txt' | 'docx') => {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const data = buildExportData();
      if (format === 'md') exportAggregatedAsMarkdown(data);
      else if (format === 'txt') exportAggregatedAsTxt(data);
      else await exportAggregatedAsDocx(data);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [buildExportData]);

  const exportLabel = activeTag ? `Export "${activeTag}"` : 'Export All';

  return (
    <div className="browse-frameworks">
      {/* Header */}
      <div className="browse-frameworks__header">
        <button type="button" className="browse-frameworks__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <h2 className="browse-frameworks__title">Browse by Topic</h2>
        <div className="browse-frameworks__export-wrap" ref={exportMenuRef}>
          <button
            type="button"
            className="browse-frameworks__export-btn"
            onClick={() => setExportMenuOpen((o) => !o)}
            disabled={exporting || visibleFrameworks.length === 0}
            title={exportLabel}
          >
            <Download size={15} />
            {exporting ? 'Exporting...' : exportLabel}
          </button>
          {exportMenuOpen && (
            <div className="browse-frameworks__export-menu">
              <button type="button" onClick={() => handleExport('md')}>Markdown (.md)</button>
              <button type="button" onClick={() => handleExport('docx')}>Word Doc (.docx)</button>
              <button type="button" onClick={() => handleExport('txt')}>Plain Text (.txt)</button>
            </div>
          )}
        </div>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="browse-frameworks__tag-bar">
          <button
            type="button"
            className={`browse-frameworks__tag-chip${activeTag === null ? ' browse-frameworks__tag-chip--active' : ''}`}
            onClick={() => { setActiveTag(null); setExpandedId(null); }}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`browse-frameworks__tag-chip${activeTag === tag ? ' browse-frameworks__tag-chip--active' : ''}`}
              onClick={() => { setActiveTag(tag); setExpandedId(null); }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Framework list */}
      <div className="browse-frameworks__list">
        {visibleFrameworks.length === 0 ? (
          <div className="browse-frameworks__empty">
            {activeTag
              ? `No frameworks tagged with "${activeTag}" yet.`
              : 'No frameworks yet. Extract principles from a book in the Manifest to get started.'}
          </div>
        ) : (
          visibleFrameworks.map((fw) => {
            const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
            const isExpanded = expandedId === fw.id;
            const includedPrinciples = (fw.principles || [])
              .filter((p) => p.is_included !== false)
              .sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div key={fw.id} className={`browse-frameworks__card${isExpanded ? ' browse-frameworks__card--expanded' : ''}`}>
                {/* Card header */}
                <button
                  type="button"
                  className="browse-frameworks__card-header"
                  onClick={() => handleAccordionToggle(fw.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="browse-frameworks__chevron">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="browse-frameworks__card-info">
                    <span className="browse-frameworks__card-name">{fw.name}</span>
                    <span className="browse-frameworks__card-meta">
                      {sourceItem?.title || 'Unknown source'}
                      {' · '}
                      {includedPrinciples.length} principle{includedPrinciples.length !== 1 ? 's' : ''}
                    </span>
                    {fw.tags && fw.tags.length > 0 && (
                      <div className="browse-frameworks__card-tags">
                        {fw.tags.map((tag) => (
                          <span key={tag} className="browse-frameworks__card-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded principles */}
                {isExpanded && (
                  <div className="browse-frameworks__principles">
                    {(() => {
                      const hasSections = includedPrinciples.some((p) => p.section_title);
                      if (!hasSections) {
                        return (
                          <ol className="browse-frameworks__principles-list">
                            {includedPrinciples.map((p, i) => (
                              <li key={p.id || i} className="browse-frameworks__principle">
                                {p.text}
                              </li>
                            ))}
                          </ol>
                        );
                      }
                      // Group by section_title
                      const groups: Array<{ title: string; items: typeof includedPrinciples }> = [];
                      for (const p of includedPrinciples) {
                        const title = p.section_title || 'General';
                        const last = groups[groups.length - 1];
                        if (last && last.title === title) {
                          last.items.push(p);
                        } else {
                          groups.push({ title, items: [p] });
                        }
                      }
                      return groups.map((g) => (
                        <div key={g.title} className="browse-frameworks__section-group">
                          <h5 className="browse-frameworks__section-title">{g.title}</h5>
                          <ol className="browse-frameworks__principles-list">
                            {g.items.map((p, i) => (
                              <li key={p.id || i} className="browse-frameworks__principle">
                                {p.text}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ));
                    })()}
                    <div className="browse-frameworks__card-footer">
                      <button
                        type="button"
                        className="browse-frameworks__edit-link"
                        onClick={() => onSelectFramework(fw)}
                      >
                        Edit Framework &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
