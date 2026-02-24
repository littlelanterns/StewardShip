import type { RiggingPlan } from '../../lib/types';
import './NudgePreferences.css';

interface NudgePreferencesProps {
  plan: RiggingPlan;
  onUpdate: (id: string, updates: Partial<RiggingPlan>) => void;
}

const NUDGE_OPTIONS: { key: keyof RiggingPlan; label: string; description: string }[] = [
  {
    key: 'nudge_approaching_milestones',
    label: 'Approaching Milestones',
    description: 'Mention upcoming milestones in Reveille and Reckoning',
  },
  {
    key: 'nudge_related_conversations',
    label: 'Related Conversations',
    description: 'Connect related topics during Helm conversations',
  },
  {
    key: 'nudge_overdue_milestones',
    label: 'Overdue Milestones',
    description: 'Gentle reminders about overdue milestones',
  },
];

export function NudgePreferences({ plan, onUpdate }: NudgePreferencesProps) {
  return (
    <div className="nudge-preferences">
      <h4 className="nudge-preferences__title">Nudge Preferences</h4>
      {NUDGE_OPTIONS.map(({ key, label, description }) => (
        <label key={key} className="nudge-preferences__option">
          <div className="nudge-preferences__option-text">
            <span className="nudge-preferences__option-label">{label}</span>
            <span className="nudge-preferences__option-desc">{description}</span>
          </div>
          <input
            type="checkbox"
            className="nudge-preferences__toggle"
            checked={plan[key] as boolean}
            onChange={(e) => onUpdate(plan.id, { [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}
