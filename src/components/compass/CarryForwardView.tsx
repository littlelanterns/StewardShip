import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { CompassTask } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';
import './CarryForwardView.css';

interface CarryForwardViewProps {
  onLoadOverdue: () => Promise<CompassTask[]>;
  onCarryForward: (id: string, option: 'tomorrow' | 'reschedule' | 'cancel' | 'keep', date?: string) => Promise<void>;
  onBack: () => void;
}

export default function CarryForwardView({ onLoadOverdue, onCarryForward, onBack }: CarryForwardViewProps) {
  const [overdueTasks, setOverdueTasks] = useState<CompassTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [showReschedule, setShowReschedule] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const tasks = await onLoadOverdue();
      setOverdueTasks(tasks);
      setLoading(false);
    }
    load();
  }, [onLoadOverdue]);

  const handleAction = async (taskId: string, option: 'tomorrow' | 'reschedule' | 'cancel' | 'keep') => {
    if (option === 'reschedule') {
      const date = rescheduleDates[taskId];
      if (!date) return;
      await onCarryForward(taskId, option, date);
    } else {
      await onCarryForward(taskId, option);
    }
    setOverdueTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  return (
    <div className="carry-forward">
      <div className="carry-forward__top-bar">
        <button type="button" className="carry-forward__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="carry-forward__top-title">Overdue Tasks</span>
      </div>

      {loading ? (
        <p className="carry-forward__loading">Loading...</p>
      ) : overdueTasks.length === 0 ? (
        <EmptyState
          heading="All caught up"
          message="No overdue tasks. Nice work."
        />
      ) : (
        <div className="carry-forward__list">
          {overdueTasks.map((task) => (
            <Card key={task.id} className="carry-forward__card">
              <div className="carry-forward__task-info">
                <span className="carry-forward__task-title">{task.title}</span>
                <span className="carry-forward__task-date">
                  Due {task.due_date}
                </span>
              </div>

              <div className="carry-forward__options">
                <Button
                  variant="secondary"
                  onClick={() => handleAction(task.id, 'tomorrow')}
                >
                  Move to tomorrow
                </Button>

                <button
                  type="button"
                  className="carry-forward__option-btn"
                  onClick={() => setShowReschedule((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                >
                  Reschedule
                </button>

                {showReschedule[task.id] && (
                  <div className="carry-forward__reschedule-row">
                    <input
                      type="date"
                      className="carry-forward__date-input"
                      value={rescheduleDates[task.id] || ''}
                      onChange={(e) => setRescheduleDates((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleAction(task.id, 'reschedule')}
                      disabled={!rescheduleDates[task.id]}
                    >
                      Set
                    </Button>
                  </div>
                )}

                <button
                  type="button"
                  className="carry-forward__option-btn"
                  onClick={() => handleAction(task.id, 'cancel')}
                >
                  I'm done with this
                </button>

                <button
                  type="button"
                  className="carry-forward__option-btn"
                  onClick={() => handleAction(task.id, 'keep')}
                >
                  Still working on it
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
