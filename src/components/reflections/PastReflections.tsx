import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { LoadingSpinner, EmptyState } from '../shared';
import type { ReflectionResponse } from '../../lib/types';
import './PastReflections.css';

interface PastReflectionsProps {
  responses: ReflectionResponse[];
  loading: boolean;
  onLoadMore: () => void;
}

export default function PastReflections({ responses, loading, onLoadMore }: PastReflectionsProps) {
  if (responses.length === 0 && !loading) {
    return (
      <EmptyState
        heading="No past reflections yet"
        message="Answer a question on the Today tab to start building your reflection history."
      />
    );
  }

  // Group by date
  const grouped = new Map<string, ReflectionResponse[]>();
  for (const r of responses) {
    const dateKey = r.response_date;
    const existing = grouped.get(dateKey) || [];
    existing.push(r);
    grouped.set(dateKey, existing);
  }

  const dates = Array.from(grouped.keys());

  return (
    <div className="past-reflections">
      {dates.map((date) => {
        const dayResponses = grouped.get(date)!;
        const d = new Date(date + 'T12:00:00');
        const label = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <div key={date} className="past-reflections__group">
            <h3 className="past-reflections__date">{label}</h3>
            {dayResponses.map((r) => (
              <Card key={r.id} className="past-reflections__card">
                <p className="past-reflections__question">{r.question_text || 'Question'}</p>
                <p className="past-reflections__response">{r.response_text}</p>
                <div className="past-reflections__meta">
                  {r.routed_to_log && <span className="past-reflections__tag">In Log</span>}
                  {r.routed_to_victory && <span className="past-reflections__tag">Victory</span>}
                </div>
              </Card>
            ))}
          </div>
        );
      })}

      {loading && <div className="past-reflections__loading"><LoadingSpinner /></div>}

      {!loading && responses.length > 0 && responses.length % 50 === 0 && (
        <div className="past-reflections__load-more">
          <Button variant="secondary" onClick={onLoadMore}>Load More</Button>
        </div>
      )}
    </div>
  );
}
