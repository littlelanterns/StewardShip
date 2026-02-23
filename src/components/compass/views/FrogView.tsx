import { CollapsibleGroup } from '../../shared';
import { TaskCard } from '../TaskCard';
import { Card } from '../../shared/Card';
import type { CompassTask } from '../../../lib/types';
import './FrogView.css';

interface FrogViewProps {
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
  onUpdateTask: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
}

export default function FrogView({
  tasks,
  onComplete,
  onTaskClick,
  onUpdateTask,
}: FrogViewProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const frogTask = pendingTasks.find((t) => t.frog_rank === 1);
  const otherTasks = pendingTasks
    .filter((t) => t.id !== frogTask?.id)
    .sort((a, b) => {
      // Tasks with frog_rank come first, then nulls
      if (a.frog_rank !== null && b.frog_rank !== null) return a.frog_rank - b.frog_rank;
      if (a.frog_rank !== null) return -1;
      if (b.frog_rank !== null) return 1;
      return a.sort_order - b.sort_order;
    });

  const handleMakeFrog = async (taskId: string) => {
    // Clear the current frog's rank
    if (frogTask) {
      await onUpdateTask(frogTask.id, { frog_rank: null });
    }
    // Set new frog
    await onUpdateTask(taskId, { frog_rank: 1 });
  };

  return (
    <div className="frog-view">
      <p className="frog-view__instruction">
        Your hardest or most dreaded task goes to the top. Do it first — everything else feels easier after.
      </p>

      {frogTask ? (
        <Card className="frog-view__frog-card">
          <div className="frog-view__frog-label">The Frog</div>
          <TaskCard
            task={frogTask}
            onComplete={onComplete}
            onClick={onTaskClick}
          />
        </Card>
      ) : (
        <Card className="frog-view__frog-card frog-view__frog-card--empty">
          <div className="frog-view__frog-label">The Frog</div>
          <p className="frog-view__frog-empty">
            Tap "Make the Frog" on any task below to set your biggest challenge.
          </p>
        </Card>
      )}

      <div className="frog-view__other-tasks">
        {otherTasks.map((task) => (
          <div key={task.id} className="frog-view__task-row">
            <TaskCard
              task={task}
              onComplete={onComplete}
              onClick={onTaskClick}
            />
            <button
              type="button"
              className="frog-view__make-frog-btn"
              onClick={() => handleMakeFrog(task.id)}
              title="Make this the Frog"
            >
              Make the Frog
            </button>
          </div>
        ))}
      </div>

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
