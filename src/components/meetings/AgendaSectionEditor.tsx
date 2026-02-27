import { useState, useEffect, useCallback, useRef } from 'react';
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
import { X, GripVertical, ChevronDown, Trash2, Archive, RotateCcw } from 'lucide-react';
import { Button } from '../shared';
import { useMeetingTemplateSections } from '../../hooks/useMeetingTemplateSections';
import { MEETING_TYPE_LABELS } from '../../lib/types';
import type { MeetingType, MeetingTemplateSection } from '../../lib/types';

interface AgendaSectionEditorProps {
  meetingType: string;
  templateId?: string;
  templateName?: string;
  onClose: () => void;
}

function SortableSectionRow({
  section,
  index,
  onUpdateTitle,
  onUpdatePrompt,
  onArchive,
  onDelete,
}: {
  section: MeetingTemplateSection;
  index: number;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const [showPrompt, setShowPrompt] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(section.title);
  const [promptValue, setPromptValue] = useState(section.ai_prompt_text);
  const titleRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== section.title) {
      onUpdateTitle(section.id, titleValue.trim());
    } else {
      setTitleValue(section.title);
    }
  }, [titleValue, section.id, section.title, onUpdateTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setTitleValue(section.title);
      setEditingTitle(false);
    }
  }, [section.title]);

  const handlePromptBlur = useCallback(() => {
    if (promptValue !== section.ai_prompt_text) {
      onUpdatePrompt(section.id, promptValue);
    }
  }, [promptValue, section.id, section.ai_prompt_text, onUpdatePrompt]);

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-editor__row ${isDragging ? 'section-editor__row--dragging' : ''}`}
    >
      <button
        className="section-editor__drag-handle"
        aria-label="Drag to reorder"
        {...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...(listeners as React.DOMAttributes<HTMLButtonElement>)}
      >
        <GripVertical size={16} />
      </button>

      <span className="section-editor__number">{index + 1}</span>

      <div className="section-editor__content">
        <div className="section-editor__title-row">
          {editingTitle ? (
            <input
              ref={titleRef}
              className="section-editor__title-input"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <button
              className="section-editor__title-text"
              onClick={() => setEditingTitle(true)}
              type="button"
            >
              {section.title}
            </button>
          )}
          {section.is_default && (
            <span className="section-editor__default-badge">default</span>
          )}
        </div>

        <button
          className="section-editor__prompt-toggle"
          onClick={() => setShowPrompt(!showPrompt)}
          type="button"
        >
          AI prompt
          <ChevronDown
            size={12}
            style={{ transform: showPrompt ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
          />
        </button>

        {showPrompt && (
          <textarea
            className="section-editor__prompt-input"
            value={promptValue}
            onChange={e => setPromptValue(e.target.value)}
            onBlur={handlePromptBlur}
            rows={2}
            placeholder="Instructions for the AI during this section..."
          />
        )}
      </div>

      <div className="section-editor__actions">
        {section.is_default ? (
          <button
            className="section-editor__action-btn"
            onClick={() => onArchive(section.id)}
            aria-label="Archive section"
            title="Hide this section"
          >
            <Archive size={14} />
          </button>
        ) : (
          <button
            className="section-editor__action-btn section-editor__action-btn--delete"
            onClick={() => onDelete(section.id)}
            aria-label="Delete section"
            title="Delete this section"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AgendaSectionEditor({
  meetingType,
  templateId,
  templateName,
  onClose,
}: AgendaSectionEditorProps) {
  const {
    sections,
    archivedSections,
    loading,
    fetchSections,
    addSection,
    updateSection,
    archiveSection,
    deleteSection,
    restoreSection,
    restoreAllDefaults,
    reorderSections,
  } = useMeetingTemplateSections();

  const [showArchived, setShowArchived] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const newTitleRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchSections(meetingType, templateId);
  }, [meetingType, templateId, fetchSections]);

  useEffect(() => {
    if (addingNew && newTitleRef.current) {
      newTitleRef.current.focus();
    }
  }, [addingNew]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    reorderSections(reordered.map(s => s.id));
  }, [sections, reorderSections]);

  const handleUpdateTitle = useCallback((id: string, title: string) => {
    updateSection(id, { title });
  }, [updateSection]);

  const handleUpdatePrompt = useCallback((id: string, aiPromptText: string) => {
    updateSection(id, { ai_prompt_text: aiPromptText });
  }, [updateSection]);

  const handleAddSection = useCallback(async () => {
    if (!newTitle.trim()) return;
    await addSection(meetingType, newTitle.trim(), '', templateId);
    setNewTitle('');
    setAddingNew(false);
  }, [meetingType, templateId, newTitle, addSection]);

  const handleRestoreAll = useCallback(async () => {
    await restoreAllDefaults(meetingType, templateId);
  }, [meetingType, templateId, restoreAllDefaults]);

  const label = templateName || MEETING_TYPE_LABELS[meetingType as MeetingType] || meetingType;
  const hasArchivedDefaults = archivedSections.some(s => s.is_default);

  return (
    <div className="section-editor__overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="section-editor__panel" role="dialog" aria-label="Edit agenda sections">
        <div className="section-editor__header">
          <h3 className="section-editor__title">{label} Agenda</h3>
          <button className="section-editor__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="section-editor__body">
          {loading && sections.length === 0 ? (
            <p className="section-editor__loading">Loading sections...</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {sections.map((section, index) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    onUpdateTitle={handleUpdateTitle}
                    onUpdatePrompt={handleUpdatePrompt}
                    onArchive={archiveSection}
                    onDelete={deleteSection}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Add Section */}
          {addingNew ? (
            <div className="section-editor__add-form">
              <input
                ref={newTitleRef}
                className="section-editor__add-input"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') { setAddingNew(false); setNewTitle(''); }
                }}
                placeholder="Section title..."
              />
              <Button
                variant="primary"
                onClick={handleAddSection}
                disabled={!newTitle.trim()}
              >
                Add
              </Button>
              <button
                className="section-editor__cancel-btn"
                onClick={() => { setAddingNew(false); setNewTitle(''); }}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="template-editor__add-section"
              onClick={() => setAddingNew(true)}
              type="button"
            >
              + Add Section
            </button>
          )}

          {/* Archived Sections */}
          {archivedSections.length > 0 && (
            <div className="section-editor__archived">
              <button
                className="section-editor__archived-toggle"
                onClick={() => setShowArchived(!showArchived)}
                type="button"
              >
                {showArchived ? 'Hide' : 'Show'} archived ({archivedSections.length})
              </button>

              {showArchived && archivedSections.map(section => (
                <div key={section.id} className="section-editor__archived-row">
                  <span className="section-editor__archived-title">{section.title}</span>
                  <button
                    className="section-editor__restore-btn"
                    onClick={() => restoreSection(section.id)}
                    type="button"
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Restore All Defaults */}
          {hasArchivedDefaults && (
            <button
              className="section-editor__restore-all"
              onClick={handleRestoreAll}
              type="button"
            >
              Restore all default sections
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
