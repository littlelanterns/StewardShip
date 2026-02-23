import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
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
import {
  EmptyState,
  LoadingSpinner,
  FloatingActionButton,
  Button,
  CollapsibleGroup,
} from '../components/shared';
import { TaskCard } from '../components/compass/TaskCard';
import AddTaskModal from '../components/compass/AddTaskModal';
import TaskDetail from '../components/compass/TaskDetail';
import CarryForwardView from '../components/compass/CarryForwardView';
import { useCompass } from '../hooks/useCompass';
import { usePageContext } from '../hooks/usePageContext';
import type { CompassTask, CompassView, CompassLifeArea } from '../lib/types';
import { COMPASS_VIEW_LABELS, COMPASS_VIEW_DESCRIPTIONS, COMPASS_LIFE_AREA_LABELS } from '../lib/types';
import './Compass.css';

const VIEW_ORDER: CompassView[] = [
  'simple_list', 'eisenhower', 'eat_the_frog', 'one_three_nine', 'big_rocks', 'ivy_lee', 'by_category',
];

const ACTIVE_VIEWS: CompassView[] = ['simple_list', 'by_category'];

function SortableTaskCard({
  task,
  onComplete,
  onClick,
}: {
  task: CompassTask;
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
      <TaskCard
        task={task}
        onComplete={onComplete}
        onClick={onClick}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

type PageView = 'list' | 'add' | 'detail' | 'carry_forward';

const LIFE_AREA_ORDER: (CompassLifeArea | 'uncategorized')[] = [
  'spiritual', 'spouse_marriage', 'family', 'career_work', 'home',
  'health_physical', 'social', 'financial', 'personal', 'custom', 'uncategorized',
];

export default function Compass() {
  const [currentView, setCurrentView] = useState<CompassView>('simple_list');
  usePageContext({ page: 'compass', activeView: currentView });

  const {
    tasks,
    loading,
    error,
    fetchTasks,
    fetchTasksByCategory,
    createTask,
    updateTask,
    completeTask,
    archiveTask,
    carryForwardTask,
    reorderTasks,
    getOverdueTasks,
    taskCount,
    tasksByCategory,
  } = useCompass();

  const [pageView, setPageView] = useState<PageView>('list');
  const [selectedTask, setSelectedTask] = useState<CompassTask | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load tasks
  useEffect(() => {
    if (currentView === 'by_category') {
      fetchTasksByCategory();
    } else {
      fetchTasks();
    }
  }, [currentView, fetchTasks, fetchTasksByCategory]);

  // Check overdue tasks on mount
  useEffect(() => {
    getOverdueTasks().then((overdue) => setOverdueCount(overdue.length));
  }, [getOverdueTasks]);

  const handleViewChange = (view: CompassView) => {
    if (!ACTIVE_VIEWS.includes(view)) {
      alert('Coming in Phase 4B');
      return;
    }
    setCurrentView(view);
  };

  const handleTaskClick = useCallback((task: CompassTask) => {
    setSelectedTask(task);
    setPageView('detail');
  }, []);

  const handleCreateTask = useCallback(async (data: Parameters<typeof createTask>[0]) => {
    const task = await createTask(data);
    return task;
  }, [createTask]);

  const handleBackToList = useCallback(() => {
    setPageView('list');
    setSelectedTask(null);
    if (currentView === 'by_category') {
      fetchTasksByCategory();
    } else {
      fetchTasks();
    }
    getOverdueTasks().then((overdue) => setOverdueCount(overdue.length));
  }, [fetchTasks, fetchTasksByCategory, getOverdueTasks, currentView]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const pendingTasks = tasks.filter((t) => t.status === 'pending').sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = pendingTasks.findIndex((t) => t.id === active.id);
    const newIndex = pendingTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(pendingTasks, oldIndex, newIndex);
    reorderTasks(newOrder.map((t) => t.id));
  }, [tasks, reorderTasks]);

  const handleShowTooltip = (view: CompassView, e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      text: COMPASS_VIEW_DESCRIPTIONS[view],
      x: rect.left,
      y: rect.bottom + 8,
    });
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 3000);
  };

  const handleHideTooltip = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setTooltip(null);
  };

  // Sub-views
  if (pageView === 'add') {
    return (
      <div className="page compass-page">
        <AddTaskModal onSave={handleCreateTask} onBack={handleBackToList} />
      </div>
    );
  }

  if (pageView === 'detail' && selectedTask) {
    return (
      <div className="page compass-page">
        <TaskDetail
          task={selectedTask}
          onUpdate={updateTask}
          onArchive={archiveTask}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  if (pageView === 'carry_forward') {
    return (
      <div className="page compass-page">
        <CarryForwardView
          onLoadOverdue={getOverdueTasks}
          onCarryForward={carryForwardTask}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  // Sort tasks for simple list
  const pendingTasks = tasks.filter((t) => t.status === 'pending').sort((a, b) => a.sort_order - b.sort_order);
  const completedTasks = tasks.filter((t) => t.status === 'completed').sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="page compass-page">
      <div className="compass-page__header">
        <h1 className="compass-page__title">The Compass</h1>
        <p className="compass-page__subtitle">What to do right now to stay on course.</p>
      </div>

      {/* View toggle bar */}
      <div className="compass-page__view-bar" role="tablist">
        {VIEW_ORDER.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            className={`compass-page__view-btn ${currentView === view ? 'compass-page__view-btn--active' : ''}`}
            onClick={() => handleViewChange(view)}
            onMouseEnter={(e) => handleShowTooltip(view, e)}
            onMouseLeave={handleHideTooltip}
            onTouchStart={(e) => {
              if (!ACTIVE_VIEWS.includes(view)) return;
              handleShowTooltip(view, e);
            }}
            aria-selected={currentView === view}
          >
            {COMPASS_VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      {tooltip && (
        <div className="compass-page__tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          {tooltip.text}
        </div>
      )}

      {/* Task count */}
      <div className="compass-page__task-count">
        {taskCount.completed} of {taskCount.total} tasks completed today
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="compass-page__overdue-banner">
          <span className="compass-page__overdue-text">
            You have {overdueCount} task{overdueCount !== 1 ? 's' : ''} from previous days
          </span>
          <button
            type="button"
            className="compass-page__overdue-btn"
            onClick={() => setPageView('carry_forward')}
          >
            Review
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && tasks.length === 0 ? (
        <div className="compass-page__loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <EmptyState
          heading="Something went wrong"
          message={error}
          action={<Button onClick={() => fetchTasks()}>Try again</Button>}
        />
      ) : currentView === 'by_category' ? (
        // By Category view
        <ByCategoryView
          tasksByCategory={tasksByCategory}
          onComplete={completeTask}
          onTaskClick={handleTaskClick}
        />
      ) : (
        // Simple List view
        <>
          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <EmptyState
              heading="No tasks for today"
              message="Add one, or ask the Helm what you should focus on."
              action={<Button onClick={() => setPageView('add')}>Add a task</Button>}
            />
          ) : (
            <div className="compass-page__tasks">
              {pendingTasks.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={pendingTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {pendingTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onComplete={completeTask}
                        onClick={handleTaskClick}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {completedTasks.length > 0 && (
                <CollapsibleGroup
                  label="Completed"
                  count={completedTasks.length}
                  defaultExpanded={false}
                >
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={completeTask}
                      onClick={handleTaskClick}
                    />
                  ))}
                </CollapsibleGroup>
              )}
            </div>
          )}
        </>
      )}

      <FloatingActionButton onClick={() => setPageView('add')} aria-label="Add task">
        <Plus size={24} />
      </FloatingActionButton>
    </div>
  );
}

function ByCategoryView({
  tasksByCategory,
  onComplete,
  onTaskClick,
}: {
  tasksByCategory: Record<string, CompassTask[]>;
  onComplete: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
}) {
  const categoryLabel = (key: string): string => {
    if (key === 'uncategorized') return 'Uncategorized';
    return COMPASS_LIFE_AREA_LABELS[key as CompassLifeArea] || key;
  };

  const categories = LIFE_AREA_ORDER.filter((cat) => tasksByCategory[cat] && tasksByCategory[cat].length > 0);

  if (categories.length === 0) {
    return (
      <EmptyState
        heading="No tasks yet"
        message="Add tasks and they will be grouped by life area."
      />
    );
  }

  return (
    <div className="compass-page__tasks">
      {categories.map((cat) => (
        <CollapsibleGroup
          key={cat}
          label={categoryLabel(cat)}
          count={tasksByCategory[cat].length}
        >
          {tasksByCategory[cat].map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      ))}
    </div>
  );
}
