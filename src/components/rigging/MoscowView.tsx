import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { RiggingPlan } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button, Input } from '../shared';
import './MoscowView.css';

interface MoscowViewProps {
  plan: RiggingPlan;
  onUpdate: (id: string, updates: Partial<RiggingPlan>) => void;
}

type MoscowCategory = 'must' | 'should' | 'could' | 'wont';

const CATEGORIES: { key: MoscowCategory; label: string; field: keyof RiggingPlan }[] = [
  { key: 'must', label: 'Must Have', field: 'moscow_must_have' },
  { key: 'should', label: 'Should Have', field: 'moscow_should_have' },
  { key: 'could', label: 'Could Have', field: 'moscow_could_have' },
  { key: 'wont', label: "Won't Have", field: 'moscow_wont_have' },
];

export function MoscowView({ plan, onUpdate }: MoscowViewProps) {
  const [addingTo, setAddingTo] = useState<MoscowCategory | null>(null);
  const [newItem, setNewItem] = useState('');

  const handleAdd = (category: MoscowCategory, field: keyof RiggingPlan) => {
    if (!newItem.trim()) return;
    const current = (plan[field] as string[]) || [];
    onUpdate(plan.id, { [field]: [...current, newItem.trim()] });
    setNewItem('');
    setAddingTo(null);
  };

  const handleRemove = (field: keyof RiggingPlan, index: number) => {
    const current = (plan[field] as string[]) || [];
    onUpdate(plan.id, { [field]: current.filter((_, i) => i !== index) });
  };

  return (
    <div className="moscow-view">
      {CATEGORIES.map(({ key, label, field }) => {
        const items = (plan[field] as string[]) || [];
        return (
          <Card key={key} className={`moscow-view__column moscow-view__column--${key}`}>
            <h4 className="moscow-view__column-title">{label}</h4>
            <ul className="moscow-view__list">
              {items.map((item, idx) => (
                <li key={idx} className="moscow-view__item">
                  <span>{item}</span>
                  <button
                    type="button"
                    className="moscow-view__remove"
                    onClick={() => handleRemove(field, idx)}
                    aria-label="Remove item"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            {addingTo === key ? (
              <div className="moscow-view__add-form">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Add item..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd(key, field);
                    if (e.key === 'Escape') setAddingTo(null);
                  }}
                />
                <div className="moscow-view__add-actions">
                  <Button size="sm" onClick={() => handleAdd(key, field)} disabled={!newItem.trim()}>
                    Add
                  </Button>
                  <Button size="sm" variant="text" onClick={() => setAddingTo(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="moscow-view__add-btn"
                onClick={() => { setAddingTo(key); setNewItem(''); }}
              >
                <Plus size={12} /> Add
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
