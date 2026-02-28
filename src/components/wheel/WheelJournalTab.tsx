import { useEffect } from 'react';
import type { JournalEntry, WheelInstance } from '../../lib/types';
import { Card } from '../shared/Card';
import { EmptyState, LoadingSpinner } from '../shared';

interface WheelJournalTabProps {
  wheel: WheelInstance;
  entries: JournalEntry[];
  loading?: boolean;
  onLoad: (wheelId: string, lifeAreaTag?: string | null) => void;
}

export function WheelJournalTab({ wheel, entries, loading, onLoad }: WheelJournalTabProps) {
  useEffect(() => {
    onLoad(wheel.id, wheel.life_area_tag);
  }, [wheel.id, wheel.life_area_tag, onLoad]);

  if (loading) {
    return <LoadingSpinner size="sm" />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        heading="No journal entries yet"
        message="Log entries linked to this Wheel or its life area will appear here."
      />
    );
  }

  return (
    <div className="wheel-journal-tab">
      {entries.map((entry) => {
        const date = new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const isDirectLink = entry.related_wheel_id === wheel.id;

        return (
          <Card key={entry.id} className="wheel-journal-tab__entry">
            <div className="wheel-journal-tab__entry-header">
              <span className="wheel-journal-tab__entry-type">{entry.entry_type}</span>
              {!isDirectLink && (
                <span className="wheel-journal-tab__entry-tag">via life area</span>
              )}
              <span className="wheel-journal-tab__entry-date">{date}</span>
            </div>
            <p className="wheel-journal-tab__entry-text">
              {entry.text.length > 200 ? entry.text.slice(0, 197) + '...' : entry.text}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
