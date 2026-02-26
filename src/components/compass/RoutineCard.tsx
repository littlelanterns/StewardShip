import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../shared/Card';
import type { List, ListItem } from '../../lib/types';
import './RoutineCard.css';

interface RoutineCardProps {
  list: List;
  items: ListItem[];
  streak?: number;
  onToggleItem: (id: string) => void;
}

export function RoutineCard({ list, items, streak, onToggleItem }: RoutineCardProps) {
  const [expanded, setExpanded] = useState(false);

  const checked = items.filter((i) => i.checked).length;
  const total = items.length;

  return (
    <Card className="routine-card">
      <button
        type="button"
        className="routine-card__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="routine-card__expand-icon">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="routine-card__title">{list.title}</span>
        <span className="routine-card__progress">
          {checked}/{total}
        </span>
        {streak !== undefined && streak > 0 && (
          <span className="routine-card__streak">{streak}d</span>
        )}
      </button>

      {expanded && (
        <div className="routine-card__items">
          {items.sort((a, b) => a.sort_order - b.sort_order).map((item) => (
            <label key={item.id} className="routine-card__item">
              <input
                type="checkbox"
                className="routine-card__item-checkbox"
                checked={item.checked}
                onChange={() => onToggleItem(item.id)}
              />
              <span className="routine-card__item-checkmark" />
              <span className={`routine-card__item-text ${item.checked ? 'routine-card__item-text--checked' : ''}`}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}
