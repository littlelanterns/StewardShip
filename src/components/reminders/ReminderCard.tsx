import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, CheckSquare, Calendar, Heart, Target, Bell, BookOpen, Anchor } from 'lucide-react';
import { SnoozeDropdown } from './SnoozeDropdown';
import type { Reminder, SnoozePreset, ReminderSourceFeature } from '../../lib/types';
import './Reminders.css';

interface ReminderCardProps {
  reminder: Reminder;
  onDismiss: (id: string) => void;
  onAct: (id: string) => void;
  onSnooze: (id: string, preset: SnoozePreset) => void;
}

function getSourceIcon(source: ReminderSourceFeature) {
  switch (source) {
    case 'compass': return <CheckSquare size={16} />;
    case 'meetings': return <Calendar size={16} />;
    case 'first_mate':
    case 'crew': return <Heart size={16} />;
    case 'wheel':
    case 'rigging':
    case 'charts': return <Target size={16} />;
    case 'log': return <BookOpen size={16} />;
    case 'rhythms': return <Anchor size={16} />;
    default: return <Bell size={16} />;
  }
}

function getNavigationTarget(reminder: Reminder): string {
  switch (reminder.source_feature) {
    case 'compass': return '/compass';
    case 'meetings': return '/meetings';
    case 'first_mate': return '/first-mate';
    case 'crew': return '/crew';
    case 'wheel': return '/wheel';
    case 'rigging': return '/rigging';
    case 'charts': return '/charts';
    case 'log': return '/log';
    case 'lists': return '/lists';
    default: return '/';
  }
}

export function ReminderCard({ reminder, onDismiss, onAct, onSnooze }: ReminderCardProps) {
  const navigate = useNavigate();

  const handleAct = useCallback(() => {
    onAct(reminder.id);
    navigate(getNavigationTarget(reminder));
  }, [reminder, onAct, navigate]);

  return (
    <div className="reminder-card">
      <div className="reminder-card__icon">
        {getSourceIcon(reminder.source_feature)}
      </div>
      <div className="reminder-card__content">
        <div className="reminder-card__title">{reminder.title}</div>
        {reminder.body && (
          <div className="reminder-card__body">{reminder.body}</div>
        )}
      </div>
      <div className="reminder-card__actions">
        <button
          type="button"
          className="reminder-card__action reminder-card__action--act"
          onClick={handleAct}
          aria-label="Act on reminder"
          title="Go to feature"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          className="reminder-card__action reminder-card__action--dismiss"
          onClick={() => onDismiss(reminder.id)}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X size={14} />
        </button>
        <SnoozeDropdown
          onSnooze={(preset) => onSnooze(reminder.id, preset)}
          snoozeCount={reminder.snooze_count}
        />
      </div>
    </div>
  );
}
