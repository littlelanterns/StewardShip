import { useEffect } from 'react';
import type { JournalEntry, RiggingPlan } from '../../lib/types';
import { Card } from '../shared/Card';
import { EmptyState, LoadingSpinner } from '../shared';

interface PlanJournalTabProps {
  plan: RiggingPlan;
  entries: JournalEntry[];
  loading?: boolean;
  onLoad: (planId: string) => void;
}

export function PlanJournalTab({ plan, entries, loading, onLoad }: PlanJournalTabProps) {
  useEffect(() => {
    onLoad(plan.id);
  }, [plan.id, onLoad]);

  if (loading) {
    return <LoadingSpinner size="sm" />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        heading="No journal entries yet"
        message="Log entries linked to this plan will appear here."
      />
    );
  }

  return (
    <div className="plan-journal-tab">
      {entries.map((entry) => {
        const date = new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <Card key={entry.id} className="plan-journal-tab__entry">
            <div className="plan-journal-tab__entry-header">
              <span className="plan-journal-tab__entry-type">{entry.entry_type}</span>
              <span className="plan-journal-tab__entry-date">{date}</span>
            </div>
            <p className="plan-journal-tab__entry-text">
              {entry.text.length > 200 ? entry.text.slice(0, 197) + '...' : entry.text}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
