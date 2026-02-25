import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ReminderCard } from './ReminderCard';
import type { Reminder, SnoozePreset, ReminderSourceFeature } from '../../lib/types';
import './Reminders.css';

interface ReminderBatchSectionProps {
  reminders: Reminder[];
  onDismiss: (id: string) => void;
  onAct: (id: string) => void;
  onSnooze: (id: string, preset: SnoozePreset) => void;
  title?: string;
}

const SOURCE_GROUPS: { key: string; label: string; sources: ReminderSourceFeature[] }[] = [
  { key: 'people', label: 'People', sources: ['first_mate', 'crew'] },
  { key: 'meetings', label: 'Meetings', sources: ['meetings'] },
  { key: 'tasks', label: 'Tasks', sources: ['compass'] },
  { key: 'growth', label: 'Growth', sources: ['wheel', 'rigging', 'charts'] },
  { key: 'other', label: 'Other', sources: ['log', 'lists', 'rhythms', 'settings', 'user'] },
];

export function ReminderBatchSection({ reminders, onDismiss, onAct, onSnooze, title = 'Reminders for Today' }: ReminderBatchSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (reminders.length === 0) return null;

  // Group reminders by source priority
  const grouped: { key: string; label: string; items: Reminder[] }[] = [];

  for (const group of SOURCE_GROUPS) {
    const items = reminders.filter((r) => group.sources.includes(r.source_feature));
    if (items.length > 0) {
      grouped.push({ key: group.key, label: group.label, items });
    }
  }

  // Show top 5 unless expanded
  const flatReminders = grouped.flatMap((g) => g.items);
  const visibleCount = expanded ? flatReminders.length : Math.min(5, flatReminders.length);
  const hiddenCount = flatReminders.length - 5;

  // If all fit in 5, just show them flat
  if (flatReminders.length <= 5) {
    return (
      <div className="reminder-batch">
        <h3 className="rhythm-section__title">
          {title}
          <span className="reminder-batch__count">{flatReminders.length}</span>
        </h3>
        <div className="reminder-batch__list">
          {flatReminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onDismiss={onDismiss}
              onAct={onAct}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      </div>
    );
  }

  // Grouped display with expand
  return (
    <div className="reminder-batch">
      <h3 className="rhythm-section__title">
        {title}
        <span className="reminder-batch__count">{flatReminders.length}</span>
      </h3>
      <div className="reminder-batch__list">
        {expanded ? (
          grouped.map((group) => (
            <div key={group.key} className="reminder-batch__group">
              <div className="reminder-batch__group-label">{group.label}</div>
              {group.items.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onDismiss={onDismiss}
                  onAct={onAct}
                  onSnooze={onSnooze}
                />
              ))}
            </div>
          ))
        ) : (
          flatReminders.slice(0, 5).map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onDismiss={onDismiss}
              onAct={onAct}
              onSnooze={onSnooze}
            />
          ))
        )}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="reminder-batch__toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>Show less <ChevronUp size={14} /></>
          ) : (
            <>and {hiddenCount} more <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}
