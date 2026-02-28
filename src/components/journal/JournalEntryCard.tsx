import { MessageCircle, Mic, Users } from 'lucide-react';
import type { JournalEntry } from '../../lib/types';
import { JOURNAL_ENTRY_TYPE_LABELS, LIFE_AREA_LABELS } from '../../lib/types';
import './JournalEntryCard.css';

interface JournalEntryCardProps {
  entry: JournalEntry;
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
  journal_entry: 'journal-entry-card__badge--journal',
  gratitude: 'journal-entry-card__badge--gratitude',
  reflection: 'journal-entry-card__badge--reflection',
  quick_note: 'journal-entry-card__badge--quick-note',
  commonplace: 'journal-entry-card__badge--journal',
  kid_quips: 'journal-entry-card__badge--journal',
  meeting_notes: 'journal-entry-card__badge--meeting',
  helm_conversation: 'journal-entry-card__badge--helm',
  transcript: 'journal-entry-card__badge--helm',
  custom: 'journal-entry-card__badge--journal',
};

function SourceIcon({ source }: { source: string }) {
  if (source === 'voice_transcription') return <Mic size={14} strokeWidth={1.5} />;
  if (source === 'helm_conversation') return <MessageCircle size={14} strokeWidth={1.5} />;
  if (source === 'meeting_framework') return <Users size={14} strokeWidth={1.5} />;
  return null;
}

export default function JournalEntryCard({ entry, onClick }: JournalEntryCardProps) {
  return (
    <button type="button" className="journal-entry-card" onClick={onClick}>
      <div className="journal-entry-card__header">
        <span className={`journal-entry-card__badge ${TYPE_CLASS_MAP[entry.entry_type] || ''}`}>
          {JOURNAL_ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
        </span>
        <span className="journal-entry-card__date">
          {entry.source !== 'manual_text' && (
            <span className="journal-entry-card__source-icon">
              <SourceIcon source={entry.source} />
            </span>
          )}
          {formatDate(entry.created_at)}
        </span>
      </div>

      <p className="journal-entry-card__text">{truncateText(entry.text)}</p>

      {(entry.life_area_tags.length > 0 || entry.routed_to.length > 0) && (
        <div className="journal-entry-card__footer">
          {entry.life_area_tags.length > 0 && (
            <div className="journal-entry-card__tags">
              {entry.life_area_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="journal-entry-card__tag">
                  {LIFE_AREA_LABELS[tag] || tag}
                </span>
              ))}
              {entry.life_area_tags.length > 3 && (
                <span className="journal-entry-card__tag">+{entry.life_area_tags.length - 3}</span>
              )}
            </div>
          )}
          {entry.routed_to.length > 0 && (
            <span className="journal-entry-card__routed">
              Routed
            </span>
          )}
        </div>
      )}
    </button>
  );
}
