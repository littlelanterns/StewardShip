import { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { CollapsibleGroup } from '../../shared';
import { TaskCard } from '../TaskCard';
import type { CompassTask, EisenhowerQuadrant } from '../../../lib/types';
import './EisenhowerView.css';

interface EisenhowerViewProps {
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
  onUpdateTask: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
}

const QUADRANTS: { key: EisenhowerQuadrant; label: string; subtitle: string }[] = [
  { key: 'do_now', label: 'Do Now', subtitle: 'Urgent + Important' },
  { key: 'schedule', label: 'Schedule', subtitle: 'Important, Not Urgent' },
  { key: 'delegate', label: 'Delegate', subtitle: 'Urgent, Not Important' },
  { key: 'eliminate', label: 'Eliminate', subtitle: 'Neither' },
];

function DroppableQuadrant({
  quadrant,
  label,
  subtitle,
  tasks,
  onComplete,
  onUncomplete,
  onTaskClick,
}: {
  quadrant: EisenhowerQuadrant;
  label: string;
  subtitle: string;
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });

  return (
    <div
      ref={setNodeRef}
      className={`eisenhower__quadrant eisenhower__quadrant--${quadrant} ${isOver ? 'eisenhower__quadrant--over' : ''}`}
    >
      <div className="eisenhower__quadrant-header">
        <span className="eisenhower__quadrant-label">{label}</span>
        <span className="eisenhower__quadrant-subtitle">{subtitle}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="eisenhower__quadrant-tasks">
          {tasks.map((task) => (
            <SortableEisenhowerCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onClick={onTaskClick}
            />
          ))}
          {tasks.length === 0 && (
            <div className="eisenhower__empty-quadrant">Drop tasks here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableEisenhowerCard({
  task,
  onComplete,
  onUncomplete,
  onClick,
}: {
  task: CompassTask;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onClick: (task: CompassTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        onComplete={onComplete}
        onUncomplete={onUncomplete}
        onClick={onClick}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function EisenhowerView({
  tasks,
  onComplete,
  onUncomplete,
  onTaskClick,
  onUpdateTask,
}: EisenhowerViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const tasksByQuadrant: Record<EisenhowerQuadrant, CompassTask[]> = {
    do_now: pendingTasks.filter((t) => t.eisenhower_quadrant === 'do_now'),
    schedule: pendingTasks.filter((t) => t.eisenhower_quadrant === 'schedule'),
    delegate: pendingTasks.filter((t) => t.eisenhower_quadrant === 'delegate'),
    eliminate: pendingTasks.filter((t) => t.eisenhower_quadrant === 'eliminate'),
  };

  const unsortedTasks = pendingTasks.filter((t) => !t.eisenhower_quadrant);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a quadrant
    const quadrants: EisenhowerQuadrant[] = ['do_now', 'schedule', 'delegate', 'eliminate'];
    if (quadrants.includes(overId as EisenhowerQuadrant)) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.eisenhower_quadrant !== overId) {
        onUpdateTask(taskId, { eisenhower_quadrant: overId as EisenhowerQuadrant });
      }
      return;
    }

    // Dropped on another task — figure out which quadrant that task is in
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && overTask.eisenhower_quadrant) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.eisenhower_quadrant !== overTask.eisenhower_quadrant) {
        onUpdateTask(taskId, { eisenhower_quadrant: overTask.eisenhower_quadrant });
      }
    }
  }, [tasks, onUpdateTask]);

  return (
    <div className="eisenhower">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="eisenhower__grid">
          {QUADRANTS.map(({ key, label, subtitle }) => (
            <DroppableQuadrant
              key={key}
              quadrant={key}
              label={label}
              subtitle={subtitle}
              tasks={tasksByQuadrant[key]}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              onComplete={() => {}}
              onClick={() => {}}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {unsortedTasks.length > 0 && (
        <CollapsibleGroup label="Unsorted" count={unsortedTasks.length}>
          {unsortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      )}

      {completedTasks.length > 0 && (
        <CollapsibleGroup label="Completed" count={completedTasks.length} defaultExpanded={false}>
          {completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      )}
    </div>
  );
}
