import type React from 'react';
import { Repeat, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { CompassTask } from '../../lib/types';
import { COMPASS_LIFE_AREA_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './TaskCard.css';

interface TaskCardProps {
  task: CompassTask;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onClick: (task: CompassTask) => void;
  showDueDate?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: { attributes: any; listeners: any };
  isDragging?: boolean;
  subtaskCount?: number;
  onToggleExpand?: (taskId: string) => void;
  isExpanded?: boolean;
  subtasks?: CompassTask[];
}

const SOURCE_LABELS: Record<string, string> = {
  helm_conversation: 'From Helm',
  log_routed: 'From Log',
  meeting_action: 'From Meeting',
  rigging_output: 'From Rigging',
  wheel_commitment: 'From Wheel',
  recurring_generated: 'Recurring',
};

export function TaskCard({
  task,
  onComplete,
  onUncomplete,
  onClick,
  showDueDate = false,
  dragHandleProps,
  isDragging = false,
  subtaskCount = 0,
  onToggleExpand,
  isExpanded = false,
  subtasks,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed';

  return (
    <div className="task-card-wrapper">
      <Card className={`task-card ${isDragging ? 'task-card--dragging' : ''} ${isCompleted ? 'task-card--completed' : ''}`.trim()}>
        <div className="task-card__row">
          {dragHandleProps && (
            <button
              className="task-card__drag-handle"
              aria-label="Drag to reorder"
              {...(dragHandleProps.attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
              {...(dragHandleProps.listeners as React.DOMAttributes<HTMLButtonElement>)}
            >
              &#x2630;
            </button>
          )}

          {subtaskCount > 0 && onToggleExpand && (
            <button
              type="button"
              className="task-card__expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(task.id);
              }}
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}

          <label className="task-card__checkbox-wrapper">
            <input
              type="checkbox"
              className="task-card__checkbox"
              checked={isCompleted}
              onChange={() => {
                if (isCompleted && onUncomplete) {
                  onUncomplete(task.id);
                } else if (!isCompleted) {
                  onComplete(task.id);
                }
              }}
            />
            <span className="task-card__checkmark" />
          </label>

          <button
            type="button"
            className="task-card__content"
            onClick={() => onClick(task)}
          >
            <span className={`task-card__title ${isCompleted ? 'task-card__title--completed' : ''}`}>
              {task.title}
            </span>

            <div className="task-card__meta">
              {task.life_area_tag && (
                <span className="task-card__tag">
                  {COMPASS_LIFE_AREA_LABELS[task.life_area_tag] || task.life_area_tag}
                </span>
              )}

              {showDueDate && task.due_date && (
                <span className="task-card__due-date">{task.due_date}</span>
              )}

              {task.recurrence_rule && (
                <span className="task-card__recurring" title={`Repeats ${task.recurrence_rule}`}>
                  <Repeat size={12} />
                </span>
              )}

              {task.source !== 'manual' && task.source !== 'recurring_generated' && (
                <span className="task-card__source">
                  <ArrowRight size={10} />
                  {SOURCE_LABELS[task.source] || task.source}
                </span>
              )}

              {subtaskCount > 0 && (
                <span className="task-card__subtask-count">
                  {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
        </div>
      </Card>

      {isExpanded && subtasks && subtasks.length > 0 && (
        <div className="task-card__subtasks">
          {subtasks.map((sub) => (
            <SubtaskCard
              key={sub.id}
              task={sub}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubtaskCard({
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
  const isCompleted = task.status === 'completed';

  return (
    <Card className={`task-card task-card--subtask ${isCompleted ? 'task-card--completed' : ''}`}>
      <div className="task-card__row">
        <label className="task-card__checkbox-wrapper">
          <input
            type="checkbox"
            className="task-card__checkbox"
            checked={isCompleted}
            onChange={() => {
              if (isCompleted && onUncomplete) {
                onUncomplete(task.id);
              } else if (!isCompleted) {
                onComplete(task.id);
              }
            }}
          />
          <span className="task-card__checkmark" />
        </label>

        <button
          type="button"
          className="task-card__content"
          onClick={() => onClick(task)}
        >
          <span className={`task-card__title ${isCompleted ? 'task-card__title--completed' : ''}`}>
            {task.title}
          </span>
        </button>
      </div>
    </Card>
  );
}
