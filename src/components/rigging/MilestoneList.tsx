import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { RiggingMilestone, MilestoneStatus } from '../../lib/types';
import { MILESTONE_STATUS_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button, Input } from '../shared';
import './MilestoneList.css';

interface MilestoneListProps {
  milestones: RiggingMilestone[];
  onUpdate: (id: string, updates: Partial<RiggingMilestone>) => void;
  onDelete: (id: string) => void;
  onCreate: (planId: string, data: Partial<RiggingMilestone>) => void;
  planId: string;
}

const STATUS_OPTIONS: MilestoneStatus[] = ['not_started', 'in_progress', 'completed', 'skipped'];

export function MilestoneList({ milestones, onUpdate, onDelete, onCreate, planId }: MilestoneListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onCreate(planId, { title: newTitle.trim() });
    setNewTitle('');
    setShowAdd(false);
  };

  const completedCount = milestones.filter((m) => m.status === 'completed').length;

  return (
    <div className="milestone-list">
      {milestones.length > 0 && (
        <div className="milestone-list__progress">
          <div className="milestone-list__progress-bar">
            <div
              className="milestone-list__progress-fill"
              style={{ width: `${milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0}%` }}
            />
          </div>
          <span className="milestone-list__progress-text">
            {completedCount} of {milestones.length}
          </span>
        </div>
      )}

      {milestones.map((milestone) => (
        <Card key={milestone.id} className={`milestone-list__item milestone-list__item--${milestone.status}`}>
          <div className="milestone-list__item-header">
            <select
              className="milestone-list__status-select"
              value={milestone.status}
              onChange={(e) => onUpdate(milestone.id, { status: e.target.value as MilestoneStatus })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{MILESTONE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className="milestone-list__item-title">{milestone.title}</span>
            <button
              type="button"
              className="milestone-list__delete-btn"
              onClick={() => onDelete(milestone.id)}
              aria-label="Delete milestone"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {milestone.description && (
            <p className="milestone-list__item-desc">{milestone.description}</p>
          )}
          {milestone.target_date && (
            <span className="milestone-list__item-date">Target: {milestone.target_date}</span>
          )}
        </Card>
      ))}

      {showAdd ? (
        <div className="milestone-list__add-form">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Milestone title..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            autoFocus
          />
          <div className="milestone-list__add-actions">
            <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>Add</Button>
            <Button size="sm" variant="text" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="milestone-list__add-btn"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Milestone
        </button>
      )}
    </div>
  );
}
