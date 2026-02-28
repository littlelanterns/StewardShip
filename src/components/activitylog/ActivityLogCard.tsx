import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Trophy,
  Users,
  MessageCircle,
  BookOpen,
  Brain,
  Anchor,
  EyeOff,
  Eye,
} from 'lucide-react';
import type { ActivityLogEvent } from '../../lib/types';
import { ACTIVITY_LOG_EVENT_LABELS } from '../../lib/types';
import './ActivityLogCard.css';

interface ActivityLogCardProps {
  event: ActivityLogEvent;
  onHide: (id: string) => void;
  onUnhide?: (id: string) => void;
}

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  task_completed: CheckCircle2,
  victory_recorded: Trophy,
  meeting_completed: Users,
  helm_conversation_started: MessageCircle,
  journal_entry_created: BookOpen,
  keel_entry_added: Brain,
  mast_entry_added: Anchor,
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ActivityLogCard({ event, onHide, onUnhide }: ActivityLogCardProps) {
  const navigate = useNavigate();
  const Icon = EVENT_ICONS[event.event_type] || BookOpen;
  const label = ACTIVITY_LOG_EVENT_LABELS[event.event_type] || event.event_type;

  const handleClick = () => {
    if (event.source_url) {
      navigate(event.source_url);
    }
  };

  const handleToggleHidden = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.hidden && onUnhide) {
      onUnhide(event.id);
    } else {
      onHide(event.id);
    }
  };

  return (
    <div
      className={`activity-log-card ${event.source_url ? 'activity-log-card--clickable' : ''} ${event.hidden ? 'activity-log-card--hidden' : ''}`}
      onClick={handleClick}
      role={event.source_url ? 'button' : undefined}
      tabIndex={event.source_url ? 0 : undefined}
    >
      <div className="activity-log-card__icon">
        <Icon size={16} strokeWidth={1.5} />
      </div>
      <div className="activity-log-card__content">
        <span className="activity-log-card__badge">{label}</span>
        <p className="activity-log-card__text">{event.display_text}</p>
      </div>
      <div className="activity-log-card__meta">
        <span className="activity-log-card__time">{formatTime(event.created_at)}</span>
        <button
          type="button"
          className="activity-log-card__hide-btn"
          onClick={handleToggleHidden}
          aria-label={event.hidden ? 'Unhide event' : 'Hide event'}
          title={event.hidden ? 'Unhide' : 'Hide'}
        >
          {event.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>
    </div>
  );
}
