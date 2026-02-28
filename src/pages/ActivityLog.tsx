import { useEffect, useState, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useActivityLog, type ActivityLogFilters } from '../hooks/useActivityLog';
import { LoadingSpinner, EmptyState, Button, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import ActivityLogCard from '../components/activitylog/ActivityLogCard';
import ActivityLogFilterBar from '../components/activitylog/ActivityLogFilterBar';
import './ActivityLog.css';

const DEFAULT_FILTERS: ActivityLogFilters = {
  eventType: null,
  dateRange: 'all',
  showHidden: false,
};

export default function ActivityLog() {
  usePageContext({ page: 'activity_log' });

  const {
    events,
    loading,
    hasMore,
    fetchEvents,
    hideEvent,
    unhideEvent,
  } = useActivityLog();

  const [filters, setFilters] = useState<ActivityLogFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    fetchEvents(filters, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    fetchEvents(filters, events.length);
  }, [fetchEvents, filters, events.length]);

  return (
    <div className="page activity-log-page">
      <div className="activity-log-page__header">
        <h1 className="activity-log-page__title">The Log</h1>
        <p className="activity-log-page__subtitle">A record of the voyage.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.activity_log} />

      <ActivityLogFilterBar filters={filters} onFiltersChange={setFilters} />

      {loading && events.length === 0 ? (
        <div className="activity-log-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          heading="No activity yet"
          message="As you use StewardShip — completing tasks, recording victories, journaling — your activity will appear here automatically."
        />
      ) : (
        <div className="activity-log-page__events">
          {events.map((event) => (
            <ActivityLogCard
              key={event.id}
              event={event}
              onHide={hideEvent}
              onUnhide={unhideEvent}
            />
          ))}

          {hasMore && (
            <div className="activity-log-page__load-more">
              <Button variant="text" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
