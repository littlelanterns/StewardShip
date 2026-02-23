import { MessageCircle, Mic, Users } from 'lucide-react';
import type { LogEntry } from '../../lib/types';
import { LOG_ENTRY_TYPE_LABELS, LIFE_AREA_LABELS } from '../../lib/types';
import './LogEntryCard.css';

interface LogEntryCardProps {
  entry: LogEntry;
  onClick: () => void;
}

function truncateText(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TYPE_CLASS_MAP: Record<string, string> = {
  journal: 'log-entry-card__badge--journal',
  gratitude: 'log-entry-card__badge--gratitude',
  reflection: 'log-entry-card__badge--reflection',
  quick_note: 'log-entry-card__badge--quick-note',
  meeting_notes: 'log-entry-card__badge--meeting',
  helm_conversation: 'log-entry-card__badge--helm',
  transcript: 'log-entry-card__badge--helm',
  custom: 'log-entry-card__badge--journal',
};

function SourceIcon({ source }: { source: string }) {
  if (source === 'voice_transcription') return <Mic size={14} strokeWidth={1.5} />;
  if (source === 'helm_conversation') return <MessageCircle size={14} strokeWidth={1.5} />;
  if (source === 'meeting_framework') return <Users size={14} strokeWidth={1.5} />;
  return null;
}

export default function LogEntryCard({ entry, onClick }: LogEntryCardProps) {
  return (
    <button type="button" className="log-entry-card" onClick={onClick}>
      <div className="log-entry-card__header">
        <span className={`log-entry-card__badge ${TYPE_CLASS_MAP[entry.entry_type] || ''}`}>
          {LOG_ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
        </span>
        <span className="log-entry-card__date">
          {entry.source !== 'manual_text' && (
            <span className="log-entry-card__source-icon">
              <SourceIcon source={entry.source} />
            </span>
          )}
          {formatDate(entry.created_at)}
        </span>
      </div>

      <p className="log-entry-card__text">{truncateText(entry.text)}</p>

      {(entry.life_area_tags.length > 0 || entry.routed_to.length > 0) && (
        <div className="log-entry-card__footer">
          {entry.life_area_tags.length > 0 && (
            <div className="log-entry-card__tags">
              {entry.life_area_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="log-entry-card__tag">
                  {LIFE_AREA_LABELS[tag] || tag}
                </span>
              ))}
              {entry.life_area_tags.length > 3 && (
                <span className="log-entry-card__tag">+{entry.life_area_tags.length - 3}</span>
              )}
            </div>
          )}
          {entry.routed_to.length > 0 && (
            <span className="log-entry-card__routed">
              Routed
            </span>
          )}
        </div>
      )}
    </button>
  );
}
