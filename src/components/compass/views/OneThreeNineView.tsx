import { CollapsibleGroup } from '../../shared';
import { TaskCard } from '../TaskCard';
import { Card } from '../../shared/Card';
import type { CompassTask, ImportanceLevel } from '../../../lib/types';
import './OneThreeNineView.css';

interface OneThreeNineViewProps {
  tasks: CompassTask[];
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onTaskClick: (task: CompassTask) => void;
  onUpdateTask: (id: string, updates: Partial<CompassTask>) => Promise<CompassTask | null>;
}

const SECTIONS: { level: ImportanceLevel; label: string; max: number }[] = [
  { level: 'critical_1', label: '1 Critical', max: 1 },
  { level: 'important_3', label: '3 Important', max: 3 },
  { level: 'small_9', label: '9 Small', max: 9 },
];

export default function OneThreeNineView({
  tasks,
  onComplete,
  onUncomplete,
  onTaskClick,
  onUpdateTask,
}: OneThreeNineViewProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const tasksByLevel: Record<ImportanceLevel, CompassTask[]> = {
    critical_1: pendingTasks.filter((t) => t.importance_level === 'critical_1'),
    important_3: pendingTasks.filter((t) => t.importance_level === 'important_3'),
    small_9: pendingTasks.filter((t) => t.importance_level === 'small_9'),
  };

  const unassigned = pendingTasks.filter((t) => !t.importance_level);

  const handleSetLevel = async (taskId: string, level: ImportanceLevel) => {
    await onUpdateTask(taskId, { importance_level: level });
  };

  return (
    <div className="one-three-nine">
      <p className="one-three-nine__instruction">
        Limits your day: 1 critical task, 3 important tasks, 9 small tasks.
      </p>

      {SECTIONS.map(({ level, label, max }) => (
        <div key={level} className={`one-three-nine__section one-three-nine__section--${level}`}>
          <div className="one-three-nine__section-header">
            <span className="one-three-nine__section-label">{label}</span>
            <span className="one-three-nine__section-count">
              {tasksByLevel[level].length}/{max}
            </span>
          </div>
          <div className="one-three-nine__section-tasks">
            {tasksByLevel[level].map((task) => (
              <Card key={task.id} className={`one-three-nine__task-card one-three-nine__task-card--${level}`}>
                <TaskCard
                  task={task}
                  onComplete={onComplete}
                  onUncomplete={onUncomplete}
                  onClick={onTaskClick}
                />
              </Card>
            ))}
            {tasksByLevel[level].length === 0 && (
              <div className="one-three-nine__empty-section">
                Assign tasks from below
              </div>
            )}
          </div>
        </div>
      ))}

      {unassigned.length > 0 && (
        <CollapsibleGroup label="Other" count={unassigned.length}>
          {unassigned.map((task) => (
            <div key={task.id} className="one-three-nine__unassigned-row">
              <TaskCard
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onClick={onTaskClick}
              />
              <div className="one-three-nine__assign-btns">
                {SECTIONS.map(({ level, label }) => (
                  <button
                    key={level}
                    type="button"
                    className={`one-three-nine__assign-btn one-three-nine__assign-btn--${level}`}
                    onClick={() => handleSetLevel(task.id, level)}
                  >
                    {label.split(' ')[1]}
                  </button>
                ))}
              </div>
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
              onUncomplete={onUncomplete}
              onClick={onTaskClick}
            />
          ))}
        </CollapsibleGroup>
      )}
    </div>
  );
}
