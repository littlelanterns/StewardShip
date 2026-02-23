import { useCallback } from 'react';
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
import { CollapsibleGroup } from '../../shared';
import { TaskCard } from '../TaskCard';
import { Card } from '../../shared/Card';
import type { CompassTask } from '../../../lib/types';
import './IvyLeeView.css';

interface IvyLeeViewProps {
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
  onUpdateTask: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
}

function SortableIvyLeeCard({
  task,
  rank,
  onComplete,
  onClick,
}: {
  task: CompassTask;
  rank: number;
  onComplete: (id: string) => void;
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
      <Card className={`ivy-lee__ranked-card ${rank === 1 ? 'ivy-lee__ranked-card--top' : ''}`}>
        <span className={`ivy-lee__rank-number ${rank === 1 ? 'ivy-lee__rank-number--top' : ''}`}>
          {rank}
        </span>
        <div className="ivy-lee__ranked-task">
          <TaskCard
            task={task}
            onComplete={onComplete}
            onClick={onClick}
            dragHandleProps={{ attributes, listeners }}
            isDragging={isDragging}
          />
        </div>
      </Card>
    </div>
  );
}

export default function IvyLeeView({
  tasks,
  onComplete,
  onTaskClick,
  onUpdateTask,
}: IvyLeeViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const rankedTasks = pendingTasks
    .filter((t) => t.ivy_lee_rank !== null && t.ivy_lee_rank >= 1 && t.ivy_lee_rank <= 6)
    .sort((a, b) => (a.ivy_lee_rank ?? 0) - (b.ivy_lee_rank ?? 0));

  const unrankedTasks = pendingTasks.filter(
    (t) => t.ivy_lee_rank === null || t.ivy_lee_rank < 1 || t.ivy_lee_rank > 6,
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rankedTasks.findIndex((t) => t.id === active.id);
    const newIndex = rankedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(rankedTasks, oldIndex, newIndex);

    // Update ivy_lee_rank for all reordered tasks
    const updates = newOrder.map((task, i) =>
      onUpdateTask(task.id, { ivy_lee_rank: i + 1 }),
    );
    await Promise.all(updates);
  }, [rankedTasks, onUpdateTask]);

  const handleAddToList = async (taskId: string) => {
    // Find next available rank
    const usedRanks = rankedTasks.map((t) => t.ivy_lee_rank ?? 0);
    let nextRank = 1;
    while (usedRanks.includes(nextRank) && nextRank <= 6) nextRank++;
    if (nextRank > 6) return; // Already 6 tasks

    await onUpdateTask(taskId, { ivy_lee_rank: nextRank });
  };

  const handleRemoveFromList = async (taskId: string) => {
    await onUpdateTask(taskId, { ivy_lee_rank: null });
  };

  return (
    <div className="ivy-lee">
      <p className="ivy-lee__instruction">
        Work only on #1 until finished. Then move to #2. Simple, powerful, no multitasking.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rankedTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="ivy-lee__ranked-list">
            {rankedTasks.map((task, i) => (
              <div key={task.id} className="ivy-lee__ranked-row">
                <SortableIvyLeeCard
                  task={task}
                  rank={i + 1}
                  onComplete={onComplete}
                  onClick={onTaskClick}
                />
                <button
                  type="button"
                  className="ivy-lee__remove-btn"
                  onClick={() => handleRemoveFromList(task.id)}
                  title="Remove from today's list"
                >
                  Remove
                </button>
              </div>
            ))}
            {rankedTasks.length === 0 && (
              <div className="ivy-lee__empty">
                Pick up to 6 tasks from below to build your focused list.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {unrankedTasks.length > 0 && (
        <CollapsibleGroup label="Not today" count={unrankedTasks.length}>
          {unrankedTasks.map((task) => (
            <div key={task.id} className="ivy-lee__unranked-row">
              <TaskCard
                task={task}
                onComplete={onComplete}
                onClick={onTaskClick}
              />
              {rankedTasks.length < 6 && (
                <button
                  type="button"
                  className="ivy-lee__add-btn"
                  onClick={() => handleAddToList(task.id)}
                >
                  Add to list
                </button>
              )}
            </div>
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
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      )}
    </div>
  );
}
