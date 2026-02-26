import { CollapsibleGroup } from '../../shared';
import { TaskCard } from '../TaskCard';
import { Card } from '../../shared/Card';
import type { CompassTask } from '../../../lib/types';
import './BigRocksView.css';

interface BigRocksViewProps {
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
  onUpdateTask: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
}

export default function BigRocksView({
  tasks,
  onComplete,
  onUncomplete,
  onTaskClick,
  onUpdateTask,
}: BigRocksViewProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const bigRocks = pendingTasks.filter((t) => t.big_rock);
  const gravel = pendingTasks.filter((t) => !t.big_rock);

  const handleToggleBigRock = async (taskId: string, currentValue: boolean) => {
    await onUpdateTask(taskId, { big_rock: !currentValue });
  };

  return (
    <div className="big-rocks">
      <p className="big-rocks__instruction">
        Identify your 2-3 major priorities. Everything else is gravel that fits around them. If the big rocks don't go in first, they won't fit at all.
      </p>

      <div className="big-rocks__section">
        <div className="big-rocks__section-header">
          <span className="big-rocks__section-label">Big Rocks</span>
          <span className="big-rocks__section-count">{bigRocks.length}</span>
        </div>
        <div className="big-rocks__section-tasks">
          {bigRocks.map((task) => (
            <Card key={task.id} className="big-rocks__rock-card">
              <TaskCard
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onClick={onTaskClick}
              />
              <button
                type="button"
                className="big-rocks__demote-btn"
                onClick={() => handleToggleBigRock(task.id, true)}
              >
                Move to gravel
              </button>
            </Card>
          ))}
          {bigRocks.length === 0 && (
            <div className="big-rocks__empty">
              Mark your most important tasks as Big Rocks below.
            </div>
          )}
        </div>
      </div>

      <div className="big-rocks__section">
        <div className="big-rocks__section-header">
          <span className="big-rocks__section-label big-rocks__section-label--gravel">Gravel</span>
          <span className="big-rocks__section-count">{gravel.length}</span>
        </div>
        <div className="big-rocks__section-tasks">
          {gravel.map((task) => (
            <div key={task.id} className="big-rocks__gravel-row">
              <TaskCard
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onClick={onTaskClick}
              />
              <button
                type="button"
                className="big-rocks__promote-btn"
                onClick={() => handleToggleBigRock(task.id, false)}
                title="Make this a Big Rock"
              >
                Big Rock
              </button>
            </div>
          ))}
        </div>
      </div>

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
