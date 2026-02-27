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
  FeatureGuide,
  SparkleOverlay,
  CompletionNotePrompt,
} from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { TaskCard } from '../components/compass/TaskCard';
import AddTaskModal from '../components/compass/AddTaskModal';
import TaskDetail from '../components/compass/TaskDetail';
import CarryForwardView from '../components/compass/CarryForwardView';
import EisenhowerView from '../components/compass/views/EisenhowerView';
import FrogView from '../components/compass/views/FrogView';
import OneThreeNineView from '../components/compass/views/OneThreeNineView';
import BigRocksView from '../components/compass/views/BigRocksView';
import IvyLeeView from '../components/compass/views/IvyLeeView';
import { useCompass } from '../hooks/useCompass';
import { useRoutineAssignment } from '../hooks/useRoutineAssignment';
import { useRoutineReset } from '../hooks/useRoutineReset';
import { useLists } from '../hooks/useLists';
import { usePageContext } from '../hooks/usePageContext';
import { suggestTaskPlacements } from '../lib/aiPlacement';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { RoutineCard } from '../components/compass/RoutineCard';
import type { CompassTask, CompassView, CompassLifeArea, ListItem } from '../lib/types';
import { COMPASS_VIEW_LABELS, COMPASS_VIEW_DESCRIPTIONS, COMPASS_LIFE_AREA_LABELS } from '../lib/types';
import './Compass.css';

const VIEW_ORDER: CompassView[] = [
  'simple_list', 'eisenhower', 'eat_the_frog', 'one_three_nine', 'big_rocks', 'ivy_lee', 'by_category',
];

function SortableTaskCard({
  task,
  onComplete,
  onUncomplete,
  onClick,
  subtaskCount,
  onToggleExpand,
  isExpanded,
  subtasks,
}: {
  task: CompassTask;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onClick: (task: CompassTask) => void;
  subtaskCount?: number;
  onToggleExpand?: (taskId: string) => void;
  isExpanded?: boolean;
  subtasks?: CompassTask[];
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
        subtaskCount={subtaskCount}
        onToggleExpand={onToggleExpand}
        isExpanded={isExpanded}
        subtasks={subtasks}
      />
    </div>
  );
}

type PageView = 'list' | 'add' | 'detail' | 'carry_forward';

const LIFE_AREA_ORDER: (CompassLifeArea | 'uncategorized')[] = [
  'spiritual', 'spouse_marriage', 'family', 'career_work', 'home',
  'health_physical', 'social', 'financial', 'personal', 'custom', 'uncategorized',
];

// Views that need all tasks (not just today's)
const ALL_TASKS_VIEWS: CompassView[] = ['by_category', 'eisenhower', 'eat_the_frog', 'one_three_nine', 'big_rocks', 'ivy_lee'];

export default function Compass() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
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
    uncompleteTask,
    checkAllSubtasksComplete,
    archiveTask,
    carryForwardTask,
    reorderTasks,
    getOverdueTasks,
    taskCount,
    tasksByCategory,
    createSubtasks,
    fetchSubtasks,
    updateCompletionNote,
  } = useCompass();

  // Routine assignments on Compass
  const { fetchAssignments, getTodayAssignments, assignments } = useRoutineAssignment();
  const { fetchListItems: fetchRoutineItems } = useLists();
  const { getStreakForList } = useRoutineReset();
  const [routineItemsMap, setRoutineItemsMap] = useState<Record<string, ListItem[]>>({});
  const [routineLists, setRoutineLists] = useState<Record<string, { title: string }>>({});
  const [routineStreaks, setRoutineStreaks] = useState<Record<string, number>>({});

  const [pageView, setPageView] = useState<PageView>('list');
  const [selectedTask, setSelectedTask] = useState<CompassTask | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Subtask tracking
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtaskMap, setSubtaskMap] = useState<Record<string, CompassTask[]>>({});
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, number>>({});

  // Completion sparkle + note prompt state
  const [completionPromptTask, setCompletionPromptTask] = useState<CompassTask | null>(null);
  const [showSparkle, setShowSparkle] = useState(false);

  // AI placement state
  const [placementBanner, setPlacementBanner] = useState<string | null>(null);
  const [placementLoading, setPlacementLoading] = useState(false);
  const placementDone = useRef<Set<CompassView>>(new Set());


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load tasks
  useEffect(() => {
    if (ALL_TASKS_VIEWS.includes(currentView)) {
      fetchTasksByCategory();
    } else {
      fetchTasks();
    }
  }, [currentView, fetchTasks, fetchTasksByCategory]);

  // Check overdue tasks on mount
  useEffect(() => {
    getOverdueTasks().then((overdue) => setOverdueCount(overdue.length));
  }, [getOverdueTasks]);

  // Fetch routine assignments + their items
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const todayAssigns = getTodayAssignments();
    if (todayAssigns.length === 0) return;

    // Fetch list items, list metadata, and streaks for each assignment
    Promise.all(
      todayAssigns.map(async (a) => {
        const items = await fetchRoutineItems(a.list_id);
        // Also fetch list title + reset_schedule for streak calc
        const { data: listData } = await supabase
          .from('lists')
          .select('title, reset_schedule')
          .eq('id', a.list_id)
          .single();
        const streak = await getStreakForList(a.list_id, listData?.reset_schedule || undefined);
        return { listId: a.list_id, items, title: listData?.title || 'Routine', streak };
      })
    ).then((results) => {
      const itemsMap: Record<string, ListItem[]> = {};
      const listsMap: Record<string, { title: string }> = {};
      const streaksMap: Record<string, number> = {};
      for (const r of results) {
        itemsMap[r.listId] = r.items;
        listsMap[r.listId] = { title: r.title };
        streaksMap[r.listId] = r.streak;
      }
      setRoutineItemsMap(itemsMap);
      setRoutineLists(listsMap);
      setRoutineStreaks(streaksMap);
    });
  }, [assignments, getTodayAssignments, fetchRoutineItems, getStreakForList]);

  // Fetch subtask counts for parent tasks
  useEffect(() => {
    if (tasks.length === 0) return;
    const parentIds = tasks.filter((t) => !t.parent_task_id).map((t) => t.id);
    if (parentIds.length === 0) return;

    // Fetch subtask counts for all potential parents
    Promise.all(
      parentIds.map(async (pid) => {
        const subs = await fetchSubtasks(pid);
        return [pid, subs.length] as [string, number];
      }),
    ).then((results) => {
      const counts: Record<string, number> = {};
      for (const [pid, count] of results) {
        if (count > 0) counts[pid] = count;
      }
      setSubtaskCounts(counts);
    });
  }, [tasks, fetchSubtasks]);

  const handleToggleExpand = useCallback(async (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
        // Fetch subtasks if not already loaded
        if (!subtaskMap[taskId]) {
          fetchSubtasks(taskId).then((subs) => {
            setSubtaskMap((prev) => ({ ...prev, [taskId]: subs }));
          });
        }
      }
      return next;
    });
  }, [subtaskMap, fetchSubtasks]);

  // AI placement suggestion when switching to a framework view
  useEffect(() => {
    if (!user) return;
    if (currentView === 'simple_list' || currentView === 'by_category') return;
    if (placementDone.current.has(currentView)) return;
    if (placementLoading) return;

    const pendingWithout = tasks.filter((t) => t.status === 'pending' && needsPlacement(t, currentView));
    if (pendingWithout.length === 0) return;

    setPlacementLoading(true);
    suggestTaskPlacements(pendingWithout, currentView, user.id)
      .then(async (suggestions) => {
        const updates = Object.entries(suggestions).map(([taskId, partial]) =>
          updateTask(taskId, partial),
        );
        await Promise.all(updates);
        placementDone.current.add(currentView);
        setPlacementBanner("I've suggested where each task fits. Tap any to adjust.");
      })
      .catch(() => {
        // Silently fail — AI placement is a nice-to-have
      })
      .finally(() => setPlacementLoading(false));
  }, [currentView, tasks, user, placementLoading, updateTask]);

  // Complete a task (parent or subtask) with full cascade behavior
  const handleCompleteTask = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    await completeTask(id);

    if (task && !task.parent_task_id) {
      // Parent/top-level task — sparkle + completion note prompt
      setShowSparkle(true);
      setCompletionPromptTask(task);
      setTimeout(() => setCompletionPromptTask((prev) => prev?.id === id ? null : prev), 8000);

      // Refresh subtask map so expanded children show as completed
      if (subtaskMap[id]) {
        fetchSubtasks(id).then((subs) => {
          setSubtaskMap((prev) => ({ ...prev, [id]: subs }));
        });
      }
    } else if (task?.parent_task_id) {
      // Subtask completed — refresh subtask map
      const subs = await fetchSubtasks(task.parent_task_id);
      setSubtaskMap((prev) => ({ ...prev, [task.parent_task_id!]: subs }));

      // Check if all subtasks now complete → auto-complete parent
      const allDone = await checkAllSubtasksComplete(task.parent_task_id);
      if (allDone) {
        const parent = tasks.find((t) => t.id === task.parent_task_id);
        if (parent && parent.status === 'pending') {
          await completeTask(parent.id);
          setShowSparkle(true);
          setCompletionPromptTask(parent);
          setTimeout(() => setCompletionPromptTask((prev) => prev?.id === parent.id ? null : prev), 8000);
        }
      }
    }
  }, [tasks, completeTask, subtaskMap, fetchSubtasks, checkAllSubtasksComplete]);

  const handleUncompleteTask = useCallback(async (id: string) => {
    await uncompleteTask(id);
    // Refresh subtask map for any parent whose children changed
    const task = tasks.find((t) => t.id === id);
    if (task?.parent_task_id && subtaskMap[task.parent_task_id]) {
      fetchSubtasks(task.parent_task_id).then((subs) => {
        setSubtaskMap((prev) => ({ ...prev, [task.parent_task_id!]: subs }));
      });
    }
    if (!task?.parent_task_id && subtaskMap[id]) {
      fetchSubtasks(id).then((subs) => {
        setSubtaskMap((prev) => ({ ...prev, [id]: subs }));
      });
    }
  }, [uncompleteTask, tasks, subtaskMap, fetchSubtasks]);

  // Toggle routine item from Compass (same DB record as Lists)
  const handleToggleRoutineItem = useCallback(async (itemId: string) => {
    // Find item in routineItemsMap
    for (const [listId, items] of Object.entries(routineItemsMap)) {
      const item = items.find((i) => i.id === itemId);
      if (item) {
        const newChecked = !item.checked;
        // Optimistic update
        setRoutineItemsMap((prev) => ({
          ...prev,
          [listId]: prev[listId].map((i) => (i.id === itemId ? { ...i, checked: newChecked } : i)),
        }));
        // Update DB
        await supabase.from('list_items').update({ checked: newChecked }).eq('id', itemId);
        return;
      }
    }
  }, [routineItemsMap]);

  const handleViewChange = (view: CompassView) => {
    setCurrentView(view);
    setPlacementBanner(null);
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
    if (ALL_TASKS_VIEWS.includes(currentView)) {
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
          onCreateSubtasks={createSubtasks}
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

  // Sort tasks for simple list (exclude child tasks from top-level display)
  const pendingTasks = tasks.filter((t) => t.status === 'pending').sort((a, b) => a.sort_order - b.sort_order);
  const completedTasks = tasks.filter((t) => t.status === 'completed').sort((a, b) => a.sort_order - b.sort_order);
  const topLevelPending = pendingTasks.filter((t) => !t.parent_task_id);
  const topLevelCompleted = completedTasks.filter((t) => !t.parent_task_id);

  const renderCurrentView = () => {
    if (loading && tasks.length === 0) {
      return (
        <div className="compass-page__loading">
          <LoadingSpinner />
        </div>
      );
    }

    if (error) {
      return (
        <EmptyState
          heading="Something went wrong"
          message={error}
          action={<Button onClick={() => fetchTasks()}>Try again</Button>}
        />
      );
    }

    switch (currentView) {
      case 'eisenhower':
        return (
          <EisenhowerView
            tasks={tasks}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
            onUpdateTask={updateTask}
          />
        );

      case 'eat_the_frog':
        return (
          <FrogView
            tasks={tasks}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
            onUpdateTask={updateTask}
          />
        );

      case 'one_three_nine':
        return (
          <OneThreeNineView
            tasks={tasks}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
            onUpdateTask={updateTask}
          />
        );

      case 'big_rocks':
        return (
          <BigRocksView
            tasks={tasks}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
            onUpdateTask={updateTask}
          />
        );

      case 'ivy_lee':
        return (
          <IvyLeeView
            tasks={tasks}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
            onUpdateTask={updateTask}
          />
        );

      case 'by_category':
        return (
          <ByCategoryView
            tasksByCategory={tasksByCategory}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onTaskClick={handleTaskClick}
          />
        );

      case 'simple_list':
      default:
        return (
          <>
            {topLevelPending.length === 0 && topLevelCompleted.length === 0 ? (
              <EmptyState
                heading="No tasks for today"
                message="Add one, or ask the Helm what you should focus on."
                action={<Button onClick={() => setPageView('add')}>Add a task</Button>}
              />
            ) : (
              <div className="compass-page__tasks">
                {topLevelPending.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={topLevelPending.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {pendingTasks.filter((t) => !t.parent_task_id).map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                          onClick={handleTaskClick}
                          subtaskCount={subtaskCounts[task.id] || 0}
                          onToggleExpand={handleToggleExpand}
                          isExpanded={expandedTasks.has(task.id)}
                          subtasks={subtaskMap[task.id]}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {topLevelCompleted.length > 0 && (
                  <CollapsibleGroup
                    label="Completed"
                    count={topLevelCompleted.length}
                    defaultExpanded={false}
                  >
                    {topLevelCompleted.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleCompleteTask}
                        onUncomplete={handleUncompleteTask}
                        onClick={handleTaskClick}
                      />
                    ))}
                  </CollapsibleGroup>
                )}
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="page compass-page">
      <div className="compass-page__header">
        <h1 className="compass-page__title">The Compass</h1>
        <p className="compass-page__subtitle">What to do right now to stay on course.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.compass} />

      {/* Quick link to Lists */}
      <button
        type="button"
        className="compass-page__lists-link"
        onClick={() => navigate('/lists')}
      >
        View Lists
      </button>

      <>
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
                onTouchStart={(e) => handleShowTooltip(view, e)}
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

          {/* Task count (includes routine items) */}
          <div className="compass-page__task-count">
            {(() => {
              let totalRoutineItems = 0;
              let checkedRoutineItems = 0;
              for (const items of Object.values(routineItemsMap)) {
                totalRoutineItems += items.length;
                checkedRoutineItems += items.filter((i) => i.checked).length;
              }
              const totalAll = taskCount.total + totalRoutineItems;
              const completedAll = taskCount.completed + checkedRoutineItems;
              return `${completedAll} of ${totalAll} items completed today`;
            })()}
          </div>

          {/* AI placement banner */}
          {placementBanner && (
            <div className="compass-page__placement-banner">
              <span className="compass-page__placement-text">{placementBanner}</span>
              <button
                type="button"
                className="compass-page__placement-dismiss"
                onClick={() => setPlacementBanner(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {placementLoading && (
            <div className="compass-page__placement-banner">
              <span className="compass-page__placement-text">Suggesting task placements...</span>
            </div>
          )}

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

          {/* Educational view tip — dismissable via FeatureGuide system */}
          <FeatureGuide {...FEATURE_GUIDES.compass_views} />

          {/* Today's Routines */}
          {(() => {
            const todayAssigns = getTodayAssignments();
            if (todayAssigns.length === 0) return null;
            return (
              <div className="compass-page__routines">
                <h3 className="compass-page__routines-title">Today's Routines</h3>
                {todayAssigns.map((a) => {
                  const items = routineItemsMap[a.list_id] || [];
                  const listInfo = routineLists[a.list_id];
                  if (!listInfo) return null;
                  return (
                    <RoutineCard
                      key={a.id}
                      list={{ id: a.list_id, title: listInfo.title } as import('../lib/types').List}
                      items={items}
                      streak={routineStreaks[a.list_id]}
                      onToggleItem={handleToggleRoutineItem}
                    />
                  );
                })}
              </div>
            );
          })()}

          {renderCurrentView()}

          <FloatingActionButton onClick={() => setPageView('add')} aria-label="Add task">
            <Plus size={24} />
          </FloatingActionButton>
        </>

      <SparkleOverlay show={showSparkle} size="quick" onComplete={() => setShowSparkle(false)} />

      {completionPromptTask && (
        <CompletionNotePrompt
          taskId={completionPromptTask.id}
          taskTitle={completionPromptTask.title}
          onSave={(taskId, note) => {
            updateCompletionNote(taskId, note);
            setCompletionPromptTask(null);
          }}
          onDismiss={() => setCompletionPromptTask(null)}
        />
      )}
    </div>
  );
}

function needsPlacement(task: CompassTask, view: CompassView): boolean {
  switch (view) {
    case 'eisenhower': return task.eisenhower_quadrant === null;
    case 'eat_the_frog': return task.frog_rank === null;
    case 'one_three_nine': return task.importance_level === null;
    case 'big_rocks': return false; // big_rock defaults to false, not null
    case 'ivy_lee': return task.ivy_lee_rank === null;
    default: return false;
  }
}

function ByCategoryView({
  tasksByCategory,
  onComplete,
  onUncomplete,
  onTaskClick,
}: {
  tasksByCategory: Record<string, CompassTask[]>;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
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
              onUncomplete={onUncomplete}
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      ))}
    </div>
  );
}
