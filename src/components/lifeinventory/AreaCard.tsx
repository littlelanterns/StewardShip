import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, MessageCircle } from 'lucide-react';
import type { LifeInventoryArea } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button } from '../shared';
import { AreaEditor } from './AreaEditor';
import './AreaCard.css';

interface AreaCardProps {
  area: LifeInventoryArea;
  onUpdate: (id: string, updates: Partial<LifeInventoryArea>) => void;
  onDelete: (id: string) => void;
  onDiscussAtHelm?: (area: LifeInventoryArea) => void;
}

export function AreaCard({ area, onUpdate, onDelete, onDiscussAtHelm }: AreaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<'baseline' | 'current' | 'vision' | null>(null);

  const hasAnyContent = area.baseline_summary || area.current_summary || area.vision_summary;

  const handleSave = (field: string, value: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updates: Partial<LifeInventoryArea> = {};
    if (field === 'baseline') {
      updates.baseline_summary = value;
      updates.baseline_date = today;
    } else if (field === 'current') {
      updates.current_summary = value;
      updates.current_assessed_date = today;
    } else if (field === 'vision') {
      updates.vision_summary = value;
      updates.vision_date = today;
    }
    onUpdate(area.id, updates);
    setEditing(null);
  };

  return (
    <Card className={`area-card${expanded ? ' area-card--expanded' : ''}`}>
      <button
        type="button"
        className="area-card__header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="area-card__header-left">
          <span className="area-card__name">{area.area_name}</span>
          {!hasAnyContent && (
            <span className="area-card__not-assessed">Not assessed</span>
          )}
          {hasAnyContent && !expanded && area.current_summary && (
            <span className="area-card__preview">
              {area.current_summary.length > 60
                ? area.current_summary.slice(0, 57) + '...'
                : area.current_summary}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="area-card__body">
          <div className="area-card__columns">
            <div className="area-card__column">
              <h4 className="area-card__column-label">Where I Was</h4>
              {editing === 'baseline' ? (
                <AreaEditor
                  initialValue={area.baseline_summary || ''}
                  onSave={(value) => handleSave('baseline', value)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  {area.baseline_summary ? (
                    <p className="area-card__column-text">{area.baseline_summary}</p>
                  ) : (
                    <p className="area-card__column-empty">Not yet assessed</p>
                  )}
                  <button
                    type="button"
                    className="area-card__edit-btn"
                    onClick={() => setEditing('baseline')}
                  >
                    {area.baseline_summary ? 'Edit' : 'Add'}
                  </button>
                  {area.baseline_date && (
                    <span className="area-card__date">{area.baseline_date}</span>
                  )}
                </>
              )}
            </div>

            <div className="area-card__column">
              <h4 className="area-card__column-label">Where I Am</h4>
              {editing === 'current' ? (
                <AreaEditor
                  initialValue={area.current_summary || ''}
                  onSave={(value) => handleSave('current', value)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  {area.current_summary ? (
                    <p className="area-card__column-text">{area.current_summary}</p>
                  ) : (
                    <p className="area-card__column-empty">Not yet assessed</p>
                  )}
                  <button
                    type="button"
                    className="area-card__edit-btn"
                    onClick={() => setEditing('current')}
                  >
                    {area.current_summary ? 'Edit' : 'Add'}
                  </button>
                  {area.current_assessed_date && (
                    <span className="area-card__date">{area.current_assessed_date}</span>
                  )}
                </>
              )}
            </div>

            <div className="area-card__column">
              <h4 className="area-card__column-label">Where I Want to Be</h4>
              {editing === 'vision' ? (
                <AreaEditor
                  initialValue={area.vision_summary || ''}
                  onSave={(value) => handleSave('vision', value)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  {area.vision_summary ? (
                    <p className="area-card__column-text">{area.vision_summary}</p>
                  ) : (
                    <p className="area-card__column-empty">Not yet assessed</p>
                  )}
                  <button
                    type="button"
                    className="area-card__edit-btn"
                    onClick={() => setEditing('vision')}
                  >
                    {area.vision_summary ? 'Edit' : 'Add'}
                  </button>
                  {area.vision_date && (
                    <span className="area-card__date">{area.vision_date}</span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="area-card__actions">
            {onDiscussAtHelm && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDiscussAtHelm(area)}
              >
                <MessageCircle size={14} />
                Discuss This Area
              </Button>
            )}
            {area.is_custom && (
              <Button
                size="sm"
                variant="text"
                onClick={() => onDelete(area.id)}
              >
                <Trash2 size={14} />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
