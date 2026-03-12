import { useState, useCallback, useMemo } from 'react';
import { GripVertical, ChevronDown, ChevronRight, Download } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BookExtractionGroup, ExportTabFilter, ExportFormat } from '../../lib/exportExtractions';
import { exportWithOptions } from '../../lib/exportEpub';
import { AddEntryModal } from '../shared';
import { Button } from '../shared';
import './ExportDialog.css';

interface ExportDialogProps {
  groups: BookExtractionGroup[];
  onClose: () => void;
  defaultTitle?: string;
  mode?: 'extractions' | 'hearted' | 'notes';
}

// --- Sortable book row ---

function SortableBookRow({ group, id }: { group: BookExtractionGroup; id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const count = group.summaries.length + group.principles.length +
    (group.actionSteps?.length || 0) + group.declarations.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`export-dialog__book-row${isDragging ? ' export-dialog__book-row--dragging' : ''}`}
    >
      <span
        className="export-dialog__drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>
      <span className="export-dialog__book-title">{group.bookTitle}</span>
      <span className="export-dialog__book-count">{count} items</span>
    </div>
  );
}

// --- Main component ---

export function ExportDialog({ groups, onClose, defaultTitle, mode = 'extractions' }: ExportDialogProps) {
  // Tab selection
  const [tabs, setTabs] = useState<ExportTabFilter>({
    summary: true,
    frameworks: true,
    action_steps: true,
    mast_content: true,
  });

  // Format selection
  const [format, setFormat] = useState<ExportFormat>('epub');

  // Book ordering (ephemeral)
  const [orderedGroups, setOrderedGroups] = useState<BookExtractionGroup[]>(groups);
  const [bookOrderExpanded, setBookOrderExpanded] = useState(false);

  // Exporting state
  const [exporting, setExporting] = useState(false);

  // Counts per tab
  const tabCounts = useMemo(() => {
    let summaries = 0, frameworks = 0, actionSteps = 0, declarations = 0;
    for (const g of groups) {
      summaries += g.summaries.length;
      frameworks += g.principles.length;
      actionSteps += (g.actionSteps?.length || 0);
      declarations += g.declarations.length;
    }
    return { summaries, frameworks, actionSteps, declarations };
  }, [groups]);

  const noTabsSelected = !tabs.summary && !tabs.frameworks && !tabs.action_steps && !tabs.mast_content;

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const bookIds = useMemo(
    () => orderedGroups.map((g) => g.bookTitle),
    [orderedGroups],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedGroups.findIndex((g) => g.bookTitle === active.id);
    const newIndex = orderedGroups.findIndex((g) => g.bookTitle === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setOrderedGroups(arrayMove(orderedGroups, oldIndex, newIndex));
  }, [orderedGroups]);

  const toggleTab = useCallback((key: keyof ExportTabFilter) => {
    setTabs((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportWithOptions(orderedGroups, {
        tabs,
        format,
        title: defaultTitle,
        mode,
      });
      onClose();
    } finally {
      setExporting(false);
    }
  }, [orderedGroups, tabs, format, defaultTitle, mode, onClose]);

  return (
    <AddEntryModal title="Export" onClose={onClose}>
      {/* Tab selection */}
      <div className="export-dialog__section">
        <h4 className="export-dialog__section-title">Content to Include</h4>
        <div className="export-dialog__tab-checkboxes">
          <label className="export-dialog__tab-checkbox">
            <input
              type="checkbox"
              checked={tabs.summary ?? true}
              onChange={() => toggleTab('summary')}
            />
            <span className="export-dialog__tab-label">Summary</span>
            {tabCounts.summaries > 0 && <span className="export-dialog__tab-count">{tabCounts.summaries}</span>}
          </label>
          <label className="export-dialog__tab-checkbox">
            <input
              type="checkbox"
              checked={tabs.frameworks ?? true}
              onChange={() => toggleTab('frameworks')}
            />
            <span className="export-dialog__tab-label">Frameworks</span>
            {tabCounts.frameworks > 0 && <span className="export-dialog__tab-count">{tabCounts.frameworks}</span>}
          </label>
          <label className="export-dialog__tab-checkbox">
            <input
              type="checkbox"
              checked={tabs.action_steps ?? true}
              onChange={() => toggleTab('action_steps')}
            />
            <span className="export-dialog__tab-label">Action Steps</span>
            {tabCounts.actionSteps > 0 && <span className="export-dialog__tab-count">{tabCounts.actionSteps}</span>}
          </label>
          <label className="export-dialog__tab-checkbox">
            <input
              type="checkbox"
              checked={tabs.mast_content ?? true}
              onChange={() => toggleTab('mast_content')}
            />
            <span className="export-dialog__tab-label">Declarations</span>
            {tabCounts.declarations > 0 && <span className="export-dialog__tab-count">{tabCounts.declarations}</span>}
          </label>
        </div>
      </div>

      {/* Book ordering (only for 2+ books) */}
      {orderedGroups.length > 1 && (
        <div className="export-dialog__section">
          <button
            type="button"
            className="export-dialog__section-toggle"
            onClick={() => setBookOrderExpanded((v) => !v)}
          >
            {bookOrderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Book Order ({orderedGroups.length} books) — drag to reorder
          </button>

          {bookOrderExpanded && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={bookIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="export-dialog__book-list">
                  {orderedGroups.map((group) => (
                    <SortableBookRow
                      key={group.bookTitle}
                      group={group}
                      id={group.bookTitle}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Format selection */}
      <div className="export-dialog__section">
        <h4 className="export-dialog__section-title">Format</h4>
        <div className="export-dialog__format-options">
          {([
            ['epub', '.epub (e-reader)'],
            ['docx', '.docx'],
            ['md', '.md'],
            ['txt', '.txt'],
          ] as [ExportFormat, string][]).map(([fmt, label]) => (
            <button
              key={fmt}
              type="button"
              className={`export-dialog__format-btn${format === fmt ? ' export-dialog__format-btn--active' : ''}`}
              onClick={() => setFormat(fmt)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Export button */}
      <div className="export-dialog__actions">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={noTabsSelected || exporting}
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </div>
    </AddEntryModal>
  );
}
