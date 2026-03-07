import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, BookOpen, Download } from 'lucide-react';
import { Button } from '../shared';
import type { AIFramework, ManifestItem } from '../../lib/types';
import {
  exportAsMarkdown, exportAsTxt, exportAsDocx,
  exportAggregatedAsMarkdown, exportAggregatedAsTxt, exportAggregatedAsDocx,
} from '../../lib/exportFramework';
import './FrameworkManager.css';

interface FrameworkManagerProps {
  frameworks: AIFramework[];
  items: ManifestItem[];
  onToggleFrameworks: (changes: Array<{ frameworkId: string; isActive: boolean }>) => Promise<void>;
  onSelectFramework: (fw: AIFramework) => void;
  onBrowse: () => void;
  onTagFramework: (frameworkId: string, name: string, principles: string[]) => Promise<void>;
  onBack: () => void;
}

export default function FrameworkManager({
  frameworks,
  items,
  onToggleFrameworks,
  onSelectFramework,
  onBrowse,
  onTagFramework,
  onBack,
}: FrameworkManagerProps) {
  // Local state tracks checkbox changes before saving
  const [localActive, setLocalActive] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const fw of frameworks) {
      map[fw.id] = fw.is_active;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Tag All state
  const [taggingAll, setTaggingAll] = useState(false);
  const [tagProgress, setTagProgress] = useState<{ done: number; total: number } | null>(null);

  const untaggedFrameworks = useMemo(() =>
    frameworks.filter((fw) => !fw.archived_at && (!fw.tags || fw.tags.length === 0)),
    [frameworks],
  );

  const handleTagAll = useCallback(async () => {
    if (untaggedFrameworks.length === 0 || taggingAll) return;
    setTaggingAll(true);
    setTagProgress({ done: 0, total: untaggedFrameworks.length });
    for (let i = 0; i < untaggedFrameworks.length; i++) {
      const fw = untaggedFrameworks[i];
      await onTagFramework(
        fw.id,
        fw.name,
        (fw.principles || []).filter((p) => p.is_included !== false).slice(0, 20).map((p) => p.text),
      ).catch((err) => console.error('Tag All failed for', fw.id, err));
      setTagProgress({ done: i + 1, total: untaggedFrameworks.length });
    }
    setTaggingAll(false);
    setTagProgress(null);
  }, [untaggedFrameworks, taggingAll, onTagFramework]);

  // Close export menu on outside click
  useEffect(() => {
    if (!openExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setOpenExportMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openExportMenu]);

  const handleExport = useCallback(async (fw: AIFramework, format: 'md' | 'txt' | 'docx') => {
    setOpenExportMenu(null);
    const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
    const exportData = {
      frameworkName: fw.name,
      sourceTitle: sourceItem?.title || fw.name,
      principles: (fw.principles || []).filter((p: { archived_at?: string | null }) => !p.archived_at),
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
  }, [items]);

  const handleExportSelected = useCallback(async (format: 'md' | 'txt' | 'docx') => {
    setOpenExportMenu(null);
    const selectedFrameworks = frameworks.filter((fw) => localActive[fw.id]);
    if (selectedFrameworks.length === 0) return;

    const aggregatedData = {
      frameworks: selectedFrameworks.map((fw) => {
        const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
        return {
          frameworkName: fw.name,
          sourceTitle: sourceItem?.title || fw.name,
          principles: (fw.principles || []).filter((p: { archived_at?: string | null }) => !p.archived_at),
        };
      }),
    };

    if (format === 'md') {
      exportAggregatedAsMarkdown(aggregatedData);
    } else if (format === 'txt') {
      exportAggregatedAsTxt(aggregatedData);
    } else {
      setExporting(true);
      try {
        await exportAggregatedAsDocx(aggregatedData);
      } finally {
        setExporting(false);
      }
    }
  }, [frameworks, localActive, items]);

  const activeCount = useMemo(
    () => Object.values(localActive).filter(Boolean).length,
    [localActive],
  );

  const hasChanges = useMemo(() => {
    return frameworks.some((fw) => localActive[fw.id] !== fw.is_active);
  }, [frameworks, localActive]);

  const handleToggle = useCallback((frameworkId: string, checked: boolean) => {
    setLocalActive((prev) => ({ ...prev, [frameworkId]: checked }));
  }, []);

  const handleSave = useCallback(async () => {
    const changes = frameworks
      .filter((fw) => localActive[fw.id] !== fw.is_active)
      .map((fw) => ({ frameworkId: fw.id, isActive: localActive[fw.id] }));

    if (changes.length === 0) return;
    setSaving(true);
    try {
      await onToggleFrameworks(changes);
    } finally {
      setSaving(false);
    }
  }, [frameworks, localActive, onToggleFrameworks]);

  if (frameworks.length === 0) {
    return (
      <div className="framework-manager">
        <button type="button" className="framework-manager__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="framework-manager__header">
          <h2 className="framework-manager__title">Your Frameworks</h2>
        </div>
        <div className="framework-manager__empty">
          <BookOpen size={32} className="framework-manager__empty-icon" />
          <p>No frameworks extracted yet.</p>
          <p className="framework-manager__empty-hint">
            Upload a book or resource and designate it as "AI Framework" to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="framework-manager">
      <button type="button" className="framework-manager__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="framework-manager__header">
        <h2 className="framework-manager__title">Your Frameworks</h2>
        <p className="framework-manager__count">
          {activeCount} of {frameworks.length} active
        </p>
      </div>

      <p className="framework-manager__intro">
        These frameworks are loaded into every AI conversation. Check the ones you want active.
      </p>

      <button
        type="button"
        className="framework-manager__browse-link"
        onClick={onBrowse}
      >
        Browse by Topic &rarr;
      </button>

      {untaggedFrameworks.length > 0 && (
        <button
          type="button"
          className="framework-manager__tag-all-btn"
          onClick={handleTagAll}
          disabled={taggingAll}
        >
          {taggingAll && tagProgress
            ? `Tagging ${tagProgress.done} of ${tagProgress.total}...`
            : `Tag All (${untaggedFrameworks.length} untagged)`}
        </button>
      )}

      <div className="framework-manager__list">
        {frameworks.map((fw) => {
          const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
          const isChecked = localActive[fw.id] ?? fw.is_active;
          return (
            <div key={fw.id} className="framework-manager__card">
              <div className="framework-manager__card-check">
                <input
                  type="checkbox"
                  className="framework-manager__checkbox"
                  checked={isChecked}
                  onChange={(e) => handleToggle(fw.id, e.target.checked)}
                  title={isChecked
                    ? 'Currently active — included in every AI conversation. Uncheck to deactivate.'
                    : 'Currently inactive — saved but not included in AI conversations. Check to activate.'}
                />
              </div>
              <button
                type="button"
                className="framework-manager__card-body"
                onClick={() => onSelectFramework(fw)}
              >
                <h3 className="framework-manager__card-name">{fw.name}</h3>
                <p className="framework-manager__card-principles">
                  {fw.principles?.length || 0} principles
                </p>
                <p className="framework-manager__card-source">
                  {sourceItem?.title || 'Unknown source'}
                </p>
                {fw.tags && fw.tags.length > 0 && (
                  <div className="framework-manager__card-tags">
                    {fw.tags.map((tag) => (
                      <span key={tag} className="framework-manager__card-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
              <div className="framework-manager__card-export" ref={openExportMenu === fw.id ? exportMenuRef : undefined}>
                <button
                  type="button"
                  className="framework-manager__export-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenExportMenu(openExportMenu === fw.id ? null : fw.id);
                  }}
                  disabled={exporting}
                  title="Export framework"
                >
                  <Download size={14} />
                </button>
                {openExportMenu === fw.id && (
                  <div className="framework-manager__export-menu">
                    <button type="button" onClick={() => handleExport(fw, 'md')}>Markdown (.md)</button>
                    <button type="button" onClick={() => handleExport(fw, 'docx')}>Word Doc (.docx)</button>
                    <button type="button" onClick={() => handleExport(fw, 'txt')}>Plain Text (.txt)</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="framework-manager__actions">
        <div className="framework-manager__export-selected-wrapper" ref={openExportMenu === 'aggregated' ? exportMenuRef : undefined}>
          <button
            type="button"
            className="framework-manager__export-selected-btn"
            onClick={() => setOpenExportMenu(openExportMenu === 'aggregated' ? null : 'aggregated')}
            disabled={exporting || Object.values(localActive).filter(Boolean).length === 0}
            title="Export all checked frameworks into one document"
          >
            <Download size={14} />
            Export Selected
          </button>
          {openExportMenu === 'aggregated' && (
            <div className="framework-manager__export-menu framework-manager__export-menu--up">
              <button type="button" onClick={() => handleExportSelected('md')}>Markdown (.md)</button>
              <button type="button" onClick={() => handleExportSelected('docx')}>Word Doc (.docx)</button>
              <button type="button" onClick={() => handleExportSelected('txt')}>Plain Text (.txt)</button>
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={onBack}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          title="Apply all checkbox changes to activate or deactivate the selected frameworks."
        >
          {saving ? 'Saving...' : 'Save and Activate Selected'}
        </Button>
      </div>
    </div>
  );
}
