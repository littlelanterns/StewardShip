import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Award, MessageSquare, Moon } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { usePageContext } from '../hooks/usePageContext';
import { useCrowsNest } from '../hooks/useCrowsNest';
import { Button, Card, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { supabase } from '../lib/supabase';
import { TodaysCompassCard } from '../components/crowsnest/TodaysCompassCard';
import { ActiveStreaksCard } from '../components/crowsnest/ActiveStreaksCard';
import { RecentAccomplishmentsCard } from '../components/crowsnest/RecentAccomplishmentsCard';
import { useAccomplishments } from '../hooks/useAccomplishments';
import { GoalsCard } from '../components/crowsnest/GoalsCard';
import { JournalSnapshotCard } from '../components/crowsnest/JournalSnapshotCard';
import { MastThoughtCard } from '../components/crowsnest/MastThoughtCard';
import { WheelProgressCard } from '../components/wheel/WheelProgressCard';
import { UpcomingRemindersCard } from '../components/crowsnest/UpcomingRemindersCard';
import { CurrentCommitmentsCard } from '../components/crowsnest/CurrentCommitmentsCard';
import './CrowsNest.css';

function getGreeting(timezone: string): string {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(hour, 10);
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return "Burning the midnight oil";
  } catch {
    return 'Welcome aboard';
  }
}

function getUserLocalHour(timezone: string): number {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(hour, 10);
  } catch {
    return new Date().getHours();
  }
}

export default function CrowsNest() {
  usePageContext({ page: 'crowsnest' });
  const { profile, user, signOut } = useAuthContext();
  const { data, loading, fetchDashboard } = useCrowsNest();
  const navigate = useNavigate();
  const [showEveningReview, setShowEveningReview] = useState(false);

  const timezone = profile?.timezone || 'America/Chicago';
  const greeting = getGreeting(timezone);
  const name = profile?.display_name || 'Steward';

  const { getRecentAccomplishments, getAccomplishmentCount } = useAccomplishments();
  const [recentAccomplishments, setRecentAccomplishments] = useState<import('../hooks/useAccomplishments').Accomplishment[]>([]);
  const [weekAccomplishmentCount, setWeekAccomplishmentCount] = useState(0);

  useEffect(() => {
    fetchDashboard();
    getRecentAccomplishments(3).then(setRecentAccomplishments);
    getAccomplishmentCount('this_week').then(setWeekAccomplishmentCount);
  }, [fetchDashboard, getRecentAccomplishments, getAccomplishmentCount]);

  // Refresh dashboard when page becomes visible (e.g., navigating back from Compass)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard();
        getRecentAccomplishments(3).then(setRecentAccomplishments);
        getAccomplishmentCount('this_week').then(setWeekAccomplishmentCount);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboard, getRecentAccomplishments, getAccomplishmentCount]);

  // Check if Evening Review button should show
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('reckoning_enabled, reckoning_time')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settings?.reckoning_enabled) {
        setShowEveningReview(false);
        return;
      }

      const reckoningHour = parseInt((settings.reckoning_time || '21:00').split(':')[0], 10);
      const currentHour = getUserLocalHour(timezone);
      setShowEveningReview(currentHour >= reckoningHour);
    })();
  }, [user, timezone]);

  const handleRefresh = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Determine if we have enough data for cards
  const hasTaskData = data && data.todayTasks.total > 0;
  const hasStreaks = data && data.streaks.length > 0;
  const hasVictories = recentAccomplishments.length > 0;
  const hasGoals = data && data.goals.length > 0;
  const hasJournal = data && (data.journalThisWeek > 0 || data.lastJournalPreview);
  const hasMast = data && data.mastThought;
  const hasWheels = data && data.activeWheels.length > 0;
  const hasReminders = data && data.upcomingReminders.length > 0;
  const hasReflections = data && data.reflectionsThisWeek > 0;
  const hasCommitments = data && data.currentCommitments.length > 0;
  const hasAnyData = hasTaskData || hasStreaks || hasVictories || hasGoals || hasJournal || hasMast || hasWheels || hasReminders || hasReflections || hasCommitments;

  return (
    <div className="page crowsnest" onTouchEnd={handleRefresh}>
      <Card className="crowsnest__greeting-card">
        <h1 className="crowsnest__greeting">
          {greeting}, {name}.
        </h1>
        {!hasAnyData && !loading && (
          <p className="crowsnest__welcome">
            Welcome aboard. Your voyage starts here. As you add entries, tasks, and goals, this dashboard will come alive.
          </p>
        )}
      </Card>

      <FeatureGuide {...FEATURE_GUIDES.crowsnest} />

      {/* Quick Actions Bar */}
      <div className="crowsnest__actions">
        <button
          type="button"
          className="crowsnest__action-btn"
          onClick={() => navigate('/compass')}
        >
          <Plus size={16} />
          <span>New Task</span>
        </button>
        <button
          type="button"
          className="crowsnest__action-btn"
          onClick={() => navigate('/journal')}
        >
          <BookOpen size={16} />
          <span>New Entry</span>
        </button>
        <button
          type="button"
          className="crowsnest__action-btn"
          onClick={() => navigate('/victories')}
        >
          <Award size={16} />
          <span>Victory</span>
        </button>
        <button
          type="button"
          className="crowsnest__action-btn"
          onClick={() => navigate('/helm')}
        >
          <MessageSquare size={16} />
          <span>Helm</span>
        </button>
      </div>

      {/* Dashboard Cards — only shown when data exists */}
      {data && (
        <div className="crowsnest__cards">
          {hasTaskData && (
            <TodaysCompassCard
              total={data.todayTasks.total}
              completed={data.todayTasks.completed}
              pending={data.todayTasks.pending}
            />
          )}

          {hasReminders && (
            <UpcomingRemindersCard reminders={data.upcomingReminders} />
          )}

          {hasStreaks && (
            <ActiveStreaksCard streaks={data.streaks} />
          )}

          {hasVictories && (
            <RecentAccomplishmentsCard
              accomplishments={recentAccomplishments}
              weekCount={weekAccomplishmentCount}
            />
          )}

          {hasCommitments && (
            <CurrentCommitmentsCard commitments={data.currentCommitments} />
          )}

          {hasGoals && (
            <GoalsCard goals={data.goals} />
          )}

          {hasWheels && (
            <WheelProgressCard
              wheels={data.activeWheels}
              onWheelClick={() => navigate('/wheel')}
            />
          )}

          {hasReflections && data && (
            <Card className="crowsnest__card">
              <h3 className="crowsnest__card-title">Reflections</h3>
              <p className="crowsnest__card-text">
                You reflected on {data.reflectionsThisWeek} question{data.reflectionsThisWeek !== 1 ? 's' : ''} this week.
              </p>
              <button
                type="button"
                className="crowsnest__card-link"
                onClick={() => navigate('/reflections')}
              >
                View Reflections
              </button>
            </Card>
          )}

          {hasJournal && (
            <JournalSnapshotCard
              thisWeekCount={data.journalThisWeek}
              lastDate={data.lastJournalDate}
              lastPreview={data.lastJournalPreview}
            />
          )}

          {hasMast && data.mastThought && (
            <MastThoughtCard entry={data.mastThought} />
          )}
        </div>
      )}

      {loading && !data && (
        <p className="crowsnest__loading">Loading your dashboard...</p>
      )}

      {showEveningReview && (
        <button
          type="button"
          className="crowsnest__evening-review"
          onClick={() => navigate('/reckoning')}
        >
          <Moon size={16} />
          <span>Evening Review</span>
        </button>
      )}

      <div className="crowsnest__signout">
        <Button variant="text" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
