import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { RiggingObstacle, ObstacleStatus } from '../../lib/types';
import { OBSTACLE_STATUS_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button, Input } from '../shared';
import './ObstacleList.css';

interface ObstacleListProps {
  obstacles: RiggingObstacle[];
  onUpdate: (id: string, updates: Partial<RiggingObstacle>) => void;
  onDelete: (id: string) => void;
  onCreate: (planId: string, data: { risk: string; mitigation: string }) => void;
  planId: string;
}

const STATUS_OPTIONS: ObstacleStatus[] = ['watching', 'triggered', 'resolved'];

export function ObstacleList({ obstacles, onUpdate, onDelete, onCreate, planId }: ObstacleListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newRisk, setNewRisk] = useState('');
  const [newMitigation, setNewMitigation] = useState('');

  const handleAdd = () => {
    if (!newRisk.trim()) return;
    onCreate(planId, { risk: newRisk.trim(), mitigation: newMitigation.trim() });
    setNewRisk('');
    setNewMitigation('');
    setShowAdd(false);
  };

  return (
    <div className="obstacle-list">
      {obstacles.map((obstacle) => (
        <Card key={obstacle.id} className={`obstacle-list__item obstacle-list__item--${obstacle.status}`}>
          <div className="obstacle-list__item-header">
            <select
              className="obstacle-list__status-select"
              value={obstacle.status}
              onChange={(e) => onUpdate(obstacle.id, { status: e.target.value as ObstacleStatus })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{OBSTACLE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              className="obstacle-list__delete-btn"
              onClick={() => onDelete(obstacle.id)}
              aria-label="Delete obstacle"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="obstacle-list__item-body">
            <div className="obstacle-list__field">
              <span className="obstacle-list__field-label">Risk</span>
              <p className="obstacle-list__field-text">{obstacle.risk}</p>
            </div>
            <div className="obstacle-list__field">
              <span className="obstacle-list__field-label">Mitigation</span>
              <p className="obstacle-list__field-text">{obstacle.mitigation}</p>
            </div>
          </div>
        </Card>
      ))}

      {showAdd ? (
        <div className="obstacle-list__add-form">
          <Input
            value={newRisk}
            onChange={(e) => setNewRisk(e.target.value)}
            placeholder="What could go wrong..."
            autoFocus
          />
          <Input
            value={newMitigation}
            onChange={(e) => setNewMitigation(e.target.value)}
            placeholder="How to handle it..."
          />
          <div className="obstacle-list__add-actions">
            <Button size="sm" onClick={handleAdd} disabled={!newRisk.trim()}>Add</Button>
            <Button size="sm" variant="text" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="obstacle-list__add-btn"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} /> Add Obstacle
        </button>
      )}
    </div>
  );
}
