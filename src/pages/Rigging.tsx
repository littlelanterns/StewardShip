import { useState, useEffect, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useRigging } from '../hooks/useRigging';
import { useHelmContext } from '../contexts/HelmContext';
import type { RiggingPlan, RiggingPlanStatus } from '../lib/types';
import { PlanCard } from '../components/rigging/PlanCard';
import { PlanDetail } from '../components/rigging/PlanDetail';
import { ManualPlanForm } from '../components/rigging/ManualPlanForm';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { EmptyState, LoadingSpinner, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Rigging.css';

type ViewMode = 'list' | 'detail' | 'create';
type FilterStatus = 'active' | 'paused' | 'completed' | 'all';
type SortBy = 'updated' | 'alpha';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

export default function Rigging() {
  usePageContext({ page: 'rigging' });
  const { startGuidedConversation } = useHelmContext();
  const {
    plans,
    selectedPlan,
    milestones,
    obstacles,
    linkedLogEntries,
    linkedConversations,
    linkedTasks,
    loading,
    fetchPlans,
    fetchPlan,
    createPlan,
    updatePlan,
    archivePlan,
    completePlan,
    pausePlan,
    fetchMilestones,
    fetchObstacles,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createObstacle,
    updateObstacle,
    deleteObstacle,
    getLinkedLogEntries,
    getLinkedConversations,
    getLinkedTasks,
    setSelectedPlan,
  } = useRigging();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [fabExpanded, setFabExpanded] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSelectPlan = useCallback(async (plan: RiggingPlan) => {
    await fetchPlan(plan.id);
    setViewMode('detail');
  }, [fetchPlan]);

  const handleBack = useCallback(() => {
    setSelectedPlan(null);
    setViewMode('list');
    fetchPlans();
  }, [setSelectedPlan, fetchPlans]);

  const handleContinueAtHelm = useCallback((plan: RiggingPlan) => {
    startGuidedConversation('rigging', undefined, plan.id);
  }, [startGuidedConversation]);

  const handleCreateManual = useCallback(async (data: Partial<RiggingPlan>) => {
    const plan = await createPlan(data);
    if (plan) {
      await fetchPlan(plan.id);
      setViewMode('detail');
    }
    return plan;
  }, [createPlan, fetchPlan]);

  const handlePlanAtHelm = useCallback(() => {
    setFabExpanded(false);
    startGuidedConversation('rigging');
  }, [startGuidedConversation]);

  const handleCompletePlan = useCallback(async (id: string) => {
    await completePlan(id);
    handleBack();
  }, [completePlan, handleBack]);

  const handleArchivePlan = useCallback(async (id: string) => {
    await archivePlan(id);
    handleBack();
  }, [archivePlan, handleBack]);

  // Filter and sort plans
  const filteredPlans = plans.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
  });

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    if (sortBy === 'alpha') return a.title.localeCompare(b.title);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const activePlans = sortedPlans.filter((p) => p.status === 'active' || p.status === 'paused');
  const completedPlans = sortedPlans.filter((p) => p.status === 'completed');

  if (viewMode === 'create') {
    return (
      <div className="page rigging-page">
        <ManualPlanForm
          onSave={handleCreateManual}
          onCancel={() => setViewMode('list')}
        />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedPlan) {
    return (
      <div className="page rigging-page">
        <PlanDetail
          plan={selectedPlan}
          milestones={milestones}
          obstacles={obstacles}
          linkedLogEntries={linkedLogEntries}
          linkedConversations={linkedConversations}
          linkedTasks={linkedTasks}
          onBack={handleBack}
          onUpdatePlan={updatePlan}
          onCompletePlan={handleCompletePlan}
          onPausePlan={pausePlan}
          onArchivePlan={handleArchivePlan}
          onContinueAtHelm={handleContinueAtHelm}
          onCreateMilestone={createMilestone}
          onUpdateMilestone={updateMilestone}
          onDeleteMilestone={deleteMilestone}
          onCreateObstacle={createObstacle}
          onUpdateObstacle={updateObstacle}
          onDeleteObstacle={deleteObstacle}
          onLoadMilestones={fetchMilestones}
          onLoadObstacles={fetchObstacles}
          onLoadJournal={getLinkedLogEntries}
          onLoadConversations={getLinkedConversations}
          onConversationClick={undefined}
        />
      </div>
    );
  }

  return (
    <div className="page rigging-page">
      <h1 className="rigging-page__title">Rigging</h1>

      <FeatureGuide {...FEATURE_GUIDES.rigging} />

      {/* Filter and sort bar */}
      <div className="rigging-page__controls">
        <div className="rigging-page__filters">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rigging-page__filter-btn${filterStatus === opt.value ? ' rigging-page__filter-btn--active' : ''}`}
              onClick={() => setFilterStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          className="rigging-page__sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="updated">Recently Updated</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {loading && plans.length === 0 ? (
        <LoadingSpinner />
      ) : sortedPlans.length === 0 ? (
        <EmptyState
          heading="No plans yet"
          message="Create a plan to organize your goals and projects. Use the Helm for AI-guided planning or create one manually."
        />
      ) : filterStatus === 'all' ? (
        <>
          {activePlans.length > 0 && (
            <div className="rigging-page__plan-list">
              {activePlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onClick={handleSelectPlan} />
              ))}
            </div>
          )}
          {completedPlans.length > 0 && (
            <CollapsibleGroup
              title={`Completed (${completedPlans.length})`}
              defaultCollapsed
            >
              <div className="rigging-page__plan-list">
                {completedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onClick={handleSelectPlan} />
                ))}
              </div>
            </CollapsibleGroup>
          )}
        </>
      ) : (
        <div className="rigging-page__plan-list">
          {sortedPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onClick={handleSelectPlan} />
          ))}
        </div>
      )}

      {/* FAB with dual action */}
      <div className="rigging-page__fab-area">
        {fabExpanded && (
          <div className="rigging-page__fab-options">
            <button
              type="button"
              className="rigging-page__fab-option"
              onClick={handlePlanAtHelm}
            >
              Plan at The Helm
            </button>
            <button
              type="button"
              className="rigging-page__fab-option"
              onClick={() => { setFabExpanded(false); setViewMode('create'); }}
            >
              Create Manually
            </button>
          </div>
        )}
        <FloatingActionButton
          onClick={() => setFabExpanded(!fabExpanded)}
          label={fabExpanded ? 'Close' : 'New Plan'}
        />
      </div>
    </div>
  );
}
