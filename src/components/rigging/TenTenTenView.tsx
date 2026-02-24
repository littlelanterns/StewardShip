import { useState } from 'react';
import type { RiggingPlan } from '../../lib/types';
import { Card } from '../shared/Card';
import { Button } from '../shared';
import './TenTenTenView.css';

interface TenTenTenViewProps {
  plan: RiggingPlan;
  onUpdate: (id: string, updates: Partial<RiggingPlan>) => void;
}

const HORIZONS: { key: keyof RiggingPlan; label: string; subtitle: string }[] = [
  { key: 'ten_ten_ten_10_days', label: '10 Days', subtitle: 'How will this feel in 10 days?' },
  { key: 'ten_ten_ten_10_months', label: '10 Months', subtitle: 'How will this look in 10 months?' },
  { key: 'ten_ten_ten_10_years', label: '10 Years', subtitle: 'How will this matter in 10 years?' },
];

export function TenTenTenView({ plan, onUpdate }: TenTenTenViewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (field: string, current: string | null) => {
    setEditingField(field);
    setEditValue(current || '');
  };

  const saveEdit = (field: string) => {
    onUpdate(plan.id, { [field]: editValue.trim() || null });
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  return (
    <div className="ten-ten-ten-view">
      {/* Decision */}
      <Card className="ten-ten-ten-view__decision">
        <h4 className="ten-ten-ten-view__label">The Decision</h4>
        {editingField === 'ten_ten_ten_decision' ? (
          <div className="ten-ten-ten-view__edit">
            <textarea
              className="ten-ten-ten-view__textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="ten-ten-ten-view__edit-actions">
              <Button size="sm" onClick={() => saveEdit('ten_ten_ten_decision')}>Save</Button>
              <Button size="sm" variant="text" onClick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p
            className="ten-ten-ten-view__text ten-ten-ten-view__text--clickable"
            onClick={() => startEdit('ten_ten_ten_decision', plan.ten_ten_ten_decision)}
          >
            {plan.ten_ten_ten_decision || 'Click to describe the decision...'}
          </p>
        )}
      </Card>

      {/* Three horizons */}
      <div className="ten-ten-ten-view__horizons">
        {HORIZONS.map(({ key, label, subtitle }) => {
          const value = plan[key] as string | null;
          return (
            <Card key={key} className="ten-ten-ten-view__horizon">
              <h4 className="ten-ten-ten-view__horizon-label">{label}</h4>
              <p className="ten-ten-ten-view__horizon-subtitle">{subtitle}</p>
              {editingField === key ? (
                <div className="ten-ten-ten-view__edit">
                  <textarea
                    className="ten-ten-ten-view__textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="ten-ten-ten-view__edit-actions">
                    <Button size="sm" onClick={() => saveEdit(key)}>Save</Button>
                    <Button size="sm" variant="text" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p
                  className="ten-ten-ten-view__text ten-ten-ten-view__text--clickable"
                  onClick={() => startEdit(key, value)}
                >
                  {value || 'Click to add perspective...'}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Conclusion */}
      <Card className="ten-ten-ten-view__conclusion">
        <h4 className="ten-ten-ten-view__label">Conclusion</h4>
        {editingField === 'ten_ten_ten_conclusion' ? (
          <div className="ten-ten-ten-view__edit">
            <textarea
              className="ten-ten-ten-view__textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="ten-ten-ten-view__edit-actions">
              <Button size="sm" onClick={() => saveEdit('ten_ten_ten_conclusion')}>Save</Button>
              <Button size="sm" variant="text" onClick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p
            className="ten-ten-ten-view__text ten-ten-ten-view__text--clickable"
            onClick={() => startEdit('ten_ten_ten_conclusion', plan.ten_ten_ten_conclusion)}
          >
            {plan.ten_ten_ten_conclusion || 'Click to add conclusion...'}
          </p>
        )}
      </Card>
    </div>
  );
}
