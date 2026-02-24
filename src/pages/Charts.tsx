import { useState, useEffect, useCallback } from 'react';
import { Plus, Target } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useCharts, type ChartsPeriod } from '../hooks/useCharts';
import { useGoals } from '../hooks/useGoals';
import { useWheel } from '../hooks/useWheel';
import { EmptyState, FloatingActionButton } from '../components/shared';
import { TaskCompletionCard } from '../components/charts/TaskCompletionCard';
import { ActiveStreaksCard } from '../components/charts/ActiveStreaksCard';
import { GoalProgressCard } from '../components/charts/GoalProgressCard';
import { VictorySummaryCard } from '../components/charts/VictorySummaryCard';
import { JournalActivityCard } from '../components/charts/JournalActivityCard';
import { CustomTrackerCard } from '../components/charts/CustomTrackerCard';
import { CreateGoal } from '../components/charts/CreateGoal';
import { GoalDetail } from '../components/charts/GoalDetail';
import { CreateTracker } from '../components/charts/CreateTracker';
import { LogTrackerEntry } from '../components/charts/LogTrackerEntry';
import { WheelProgressCard } from '../components/wheel/WheelProgressCard';
import './Charts.css';

const PERIOD_LABELS: Record<ChartsPeriod, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

export default function Charts() {
  usePageContext({ page: 'charts' });

  const { trackers, fetchTrackers } = useCharts();
  const { goals, fetchGoals } = useGoals();
  const { wheels, fetchWheels } = useWheel();
  const [period, setPeriod] = useState<ChartsPeriod>('week');
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showCreateTracker, setShowCreateTracker] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [logTrackerId, setLogTrackerId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    fetchWheels('active');
  }, [fetchWheels]);

  const handleRefresh = useCallback(() => {
    fetchTrackers();
    fetchGoals();
  }, [fetchTrackers, fetchGoals]);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) || null;
  const logTracker = trackers.find((t) => t.id === logTrackerId) || null;

  const hasAnyData = goals.length > 0 || trackers.length > 0;

  return (
    <div className="page charts">
      <div className="charts__header">
        <h1>Charts</h1>
        <p className="charts__subtitle">Where you've been and where you're going.</p>
      </div>

      <div className="charts__period-toggle">
        {(Object.keys(PERIOD_LABELS) as ChartsPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`charts__period-btn ${period === p ? 'charts__period-btn--active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="charts__cards">
        {/* Automatic cards — each self-hides when empty */}
        <TaskCompletionCard period={period} />
        <ActiveStreaksCard />
        <GoalProgressCard onTap={(id) => setSelectedGoalId(id)} />
        <VictorySummaryCard period={period} />
        <JournalActivityCard period={period} />

        {/* Active Wheels */}
        {wheels.length > 0 && (
          <>
            <h3 className="charts__section-header">Active Wheels</h3>
            <WheelProgressCard wheels={wheels} />
          </>
        )}

        {/* Custom trackers */}
        {trackers.length > 0 && (
          <>
            <h3 className="charts__section-header">Custom Trackers</h3>
            {trackers.map((t) => (
              <CustomTrackerCard
                key={t.id}
                tracker={t}
                period={period}
                onLog={(id) => setLogTrackerId(id)}
              />
            ))}
          </>
        )}

        {/* Goals section with Create button */}
        {goals.length > 0 && (
          <h3 className="charts__section-header">Goals</h3>
        )}

        <button
          type="button"
          className="charts__add-tracker"
          onClick={() => setShowCreateGoal(true)}
        >
          <Target size={16} /> Add Goal
        </button>

        <button
          type="button"
          className="charts__add-tracker"
          onClick={() => setShowCreateTracker(true)}
        >
          <Plus size={16} /> Add Custom Tracker
        </button>

        {!hasAnyData && (
          <EmptyState
            heading="Track your progress"
            message="Charts come alive as you add tasks, habits, and goals. Create a goal or custom tracker to get started."
          />
        )}
      </div>

      <FloatingActionButton onClick={() => setShowCreateGoal(true)} aria-label="Create a Goal">
        <Plus size={24} />
      </FloatingActionButton>

      {showCreateGoal && (
        <CreateGoal
          onClose={() => setShowCreateGoal(false)}
          onCreated={handleRefresh}
        />
      )}

      {selectedGoal && (
        <GoalDetail
          goal={selectedGoal}
          onClose={() => setSelectedGoalId(null)}
          onUpdated={handleRefresh}
        />
      )}

      {showCreateTracker && (
        <CreateTracker
          onClose={() => setShowCreateTracker(false)}
          onCreated={handleRefresh}
        />
      )}

      {logTracker && (
        <LogTrackerEntry
          tracker={logTracker}
          onClose={() => setLogTrackerId(null)}
          onLogged={handleRefresh}
        />
      )}
    </div>
  );
}
