import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { MeetingType } from '../../lib/types';
import { MEETING_TYPE_LABELS, MEETING_ENTRY_MODE_LABELS } from '../../lib/types';
import type { MeetingWithPerson } from '../../hooks/useMeetings';
import { useMeetings } from '../../hooks/useMeetings';

interface MeetingHistoryProps {
  meetingType: MeetingType;
  personId?: string;
  personName?: string;
  onBack: () => void;
}

export function MeetingHistory({ meetingType, personId, personName, onBack }: MeetingHistoryProps) {
  const { fetchMeetingHistory, fetchPatternNote } = useMeetings();
  const [history, setHistory] = useState<MeetingWithPerson[]>([]);
  const [patternNote, setPatternNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [meetings, pattern] = await Promise.all([
      fetchMeetingHistory(meetingType, personId),
      fetchPatternNote(meetingType, personId),
    ]);
    setHistory(meetings);
    setPatternNote(pattern);
    setLoading(false);
  }, [fetchMeetingHistory, fetchPatternNote, meetingType, personId]);

  useEffect(() => {
    load();
  }, [load]);

  const label = MEETING_TYPE_LABELS[meetingType];
  const subtitle = personName ? ` with ${personName}` : '';

  return (
    <div className="meeting-history">
      <button type="button" className="meetings-back-btn" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>

      <h2 className="upcoming-meetings__title">{label}{subtitle} History</h2>

      {patternNote && (
        <div className="meeting-history__pattern">
          <p className="meeting-history__pattern-label">Pattern observed</p>
          <p className="meeting-history__pattern-text">{patternNote}</p>
        </div>
      )}

      {loading && <p className="meeting-history__empty">Loading...</p>}

      {!loading && history.length === 0 && (
        <p className="meeting-history__empty">
          No completed meetings yet. Start your first one above.
        </p>
      )}

      {history.map(meeting => (
        <div
          key={meeting.id}
          className="meeting-history__item"
          onClick={() => setExpandedId(prev => prev === meeting.id ? null : meeting.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') setExpandedId(prev => prev === meeting.id ? null : meeting.id); }}
        >
          <p className="meeting-history__item-date">
            {new Date(meeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
          <p className="meeting-history__item-summary">
            {expandedId === meeting.id
              ? (meeting.summary || 'No summary recorded')
              : (meeting.summary
                ? (meeting.summary.length > 120
                  ? meeting.summary.slice(0, 120) + '...'
                  : meeting.summary)
                : 'No summary recorded')}
          </p>
          <p className="meeting-history__item-mode">
            {MEETING_ENTRY_MODE_LABELS[meeting.entry_mode]}
          </p>
          {expandedId === meeting.id && meeting.impressions && (
            <p style={{ color: 'var(--color-slate-gray)', fontSize: '0.8125rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              Impressions: {meeting.impressions}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
