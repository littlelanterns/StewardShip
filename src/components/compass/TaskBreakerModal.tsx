import { useState, useCallback } from 'react';
import { ArrowLeft, Trash2, GripVertical, Plus } from 'lucide-react';
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
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared';
import { breakDownTask } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import type { CompassTask, TaskBreakerLevel } from '../../lib/types';
import './TaskBreakerModal.css';

interface SubtaskDraft {
  id: string; // temp client ID
  title: string;
  description: string;
}

interface TaskBreakerModalProps {
  task: CompassTask;
  onSave: (subtasks: Array<{ title: string; description?: string; sort_order: number }>) => Promise<void>;
  onCancel: () => void;
}

const DETAIL_LEVELS: { value: TaskBreakerLevel; label: string; desc: string }[] = [
  { value: 'quick', label: 'Quick', desc: '3-5 high-level steps' },
  { value: 'detailed', label: 'Detailed', desc: 'Steps with substeps' },
  { value: 'granular', label: 'Granular', desc: 'Very small concrete actions' },
];

let tempId = 0;
function nextTempId(): string {
  return `temp-${++tempId}`;
}

function SortableSubtaskRow({
  draft,
  onUpdate,
  onDelete,
}: {
  draft: SubtaskDraft;
  onUpdate: (id: string, field: 'title' | 'description', value: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="task-breaker__subtask-row">
      <button
        type="button"
        className="task-breaker__drag-handle"
        {...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...(listeners as React.DOMAttributes<HTMLButtonElement>)}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <div className="task-breaker__subtask-fields">
        <input
          type="text"
          className="task-breaker__subtask-title"
          value={draft.title}
          onChange={(e) => onUpdate(draft.id, 'title', e.target.value)}
          placeholder="Subtask title"
        />
        <input
          type="text"
          className="task-breaker__subtask-desc"
          value={draft.description}
          onChange={(e) => onUpdate(draft.id, 'description', e.target.value)}
          placeholder="Description (optional)"
        />
      </div>
      <button
        type="button"
        className="task-breaker__delete-btn"
        onClick={() => onDelete(draft.id)}
        aria-label="Delete subtask"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function TaskBreakerModal({ task, onSave, onCancel }: TaskBreakerModalProps) {
  const { user } = useAuthContext();
  const [detailLevel, setDetailLevel] = useState<TaskBreakerLevel>('quick');
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGenerate = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);

    try {
      const results = await breakDownTask(
        task.title,
        task.description,
        detailLevel,
        user.id,
      );

      setSubtasks(
        results.map((r) => ({
          id: nextTempId(),
          title: r.title,
          description: r.description || '',
        })),
      );
      setGenerated(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate subtasks';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [user, task, detailLevel]);

  const handleUpdateSubtask = useCallback((id: string, field: 'title' | 'description', value: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  }, []);

  const handleDeleteSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddSubtask = useCallback(() => {
    setSubtasks((prev) => [...prev, { id: nextTempId(), title: '', description: '' }]);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSubtasks((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSave = async () => {
    const validSubtasks = subtasks.filter((s) => s.title.trim());
    if (validSubtasks.length === 0) return;

    setSaving(true);
    try {
      await onSave(
        validSubtasks.map((s, i) => ({
          title: s.title.trim(),
          description: s.description.trim() || undefined,
          sort_order: i,
        })),
      );
    } catch {
      setError('Failed to save subtasks');
    } finally {
      setSaving(false);
    }
  };

  const validCount = subtasks.filter((s) => s.title.trim()).length;

  return (
    <div className="task-breaker">
      <div className="task-breaker__top-bar">
        <button type="button" className="task-breaker__back" onClick={onCancel} aria-label="Cancel">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="task-breaker__top-title">Break Down Task</span>
      </div>

      <div className="task-breaker__task-info">
        <span className="task-breaker__task-label">Task:</span>
        <span className="task-breaker__task-title">{task.title}</span>
      </div>

      <div className="task-breaker__level-selector">
        <span className="task-breaker__level-label">Detail Level</span>
        <div className="task-breaker__level-btns">
          {DETAIL_LEVELS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              className={`task-breaker__level-btn ${detailLevel === value ? 'task-breaker__level-btn--active' : ''}`}
              onClick={() => setDetailLevel(value)}
              title={desc}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!generated && (
        <Button
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Subtasks'}
        </Button>
      )}

      {generating && (
        <div className="task-breaker__loading">
          <LoadingSpinner />
          <span>Breaking down your task...</span>
        </div>
      )}

      {error && (
        <div className="task-breaker__error">{error}</div>
      )}

      {generated && subtasks.length > 0 && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={subtasks.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-breaker__subtask-list">
                {subtasks.map((draft) => (
                  <SortableSubtaskRow
                    key={draft.id}
                    draft={draft}
                    onUpdate={handleUpdateSubtask}
                    onDelete={handleDeleteSubtask}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            className="task-breaker__add-btn"
            onClick={handleAddSubtask}
          >
            <Plus size={16} />
            Add another
          </button>

          <div className="task-breaker__actions">
            <Button
              onClick={handleSave}
              disabled={validCount === 0 || saving}
            >
              {saving ? 'Saving...' : `Save ${validCount} Subtask${validCount !== 1 ? 's' : ''}`}
            </Button>
            <Button variant="secondary" onClick={handleGenerate} disabled={generating}>
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
