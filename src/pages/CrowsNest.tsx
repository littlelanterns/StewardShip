import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Award, MessageSquare } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { usePageContext } from '../hooks/usePageContext';
import { useCrowsNest } from '../hooks/useCrowsNest';
import { Button, Card } from '../components/shared';
import { TodaysCompassCard } from '../components/crowsnest/TodaysCompassCard';
import { ActiveStreaksCard } from '../components/crowsnest/ActiveStreaksCard';
import { RecentVictoriesCard } from '../components/crowsnest/RecentVictoriesCard';
import { GoalsCard } from '../components/crowsnest/GoalsCard';
import { JournalSnapshotCard } from '../components/crowsnest/JournalSnapshotCard';
import { MastThoughtCard } from '../components/crowsnest/MastThoughtCard';
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

export default function CrowsNest() {
  usePageContext({ page: 'crowsnest' });
  const { profile, signOut } = useAuthContext();
  const { data, loading, fetchDashboard } = useCrowsNest();
  const navigate = useNavigate();

  const greeting = getGreeting(profile?.timezone || 'America/Chicago');
  const name = profile?.display_name || 'Steward';

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Determine if we have enough data for cards
  const hasTaskData = data && data.todayTasks.total > 0;
  const hasStreaks = data && data.streaks.length > 0;
  const hasVictories = data && data.recentVictories.length > 0;
  const hasGoals = data && data.goals.length > 0;
  const hasJournal = data && (data.journalThisWeek > 0 || data.lastJournalPreview);
  const hasMast = data && data.mastThought;
  const hasAnyData = hasTaskData || hasStreaks || hasVictories || hasGoals || hasJournal || hasMast;

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
          onClick={() => navigate('/log')}
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

          {hasStreaks && (
            <ActiveStreaksCard streaks={data.streaks} />
          )}

          {hasVictories && (
            <RecentVictoriesCard
              victories={data.recentVictories}
              weekCount={data.weekVictoryCount}
            />
          )}

          {hasGoals && (
            <GoalsCard goals={data.goals} />
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

      <div className="crowsnest__signout">
        <Button variant="text" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
