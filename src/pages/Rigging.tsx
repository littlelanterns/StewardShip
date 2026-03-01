import { useState, useEffect, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useRigging } from '../hooks/useRigging';
import { usePriorities } from '../hooks/usePriorities';
import { useHelmContext } from '../contexts/HelmContext';
import type { RiggingPlan } from '../lib/types';
import { PlanCard } from '../components/rigging/PlanCard';
import { PlanDetail } from '../components/rigging/PlanDetail';
import { ManualPlanForm } from '../components/rigging/ManualPlanForm';
import { PrioritiesView } from '../components/rigging/PrioritiesView';
import { AddPriorityModal } from '../components/rigging/AddPriorityModal';
import { Plus, MessageSquare, PenLine, ListPlus } from 'lucide-react';
import { FloatingActionButton } from '../components/shared/FloatingActionButton';
import { CollapsibleGroup } from '../components/shared/CollapsibleGroup';
import { EmptyState, LoadingSpinner, FeatureGuide, SparkleOverlay } from '../components/shared';
import { AddEntryModal } from '../components/shared/AddEntryModal';
import { BulkAddWithAISort, type ParsedBulkItem } from '../components/shared/BulkAddWithAISort';
import { useVictories } from '../hooks/useVictories';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import './Rigging.css';

type ActiveTab = 'plans' | 'priorities';
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
    setSelectedPlan,
  } = useRigging();

  const { createPriority, getCommittedNowCount } = usePriorities();

  const [activeTab, setActiveTab] = useState<ActiveTab>('plans');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [fabExpanded, setFabExpanded] = useState(false);
  const [showSparkle, setShowSparkle] = useState(false);
  const [showAddPriority, setShowAddPriority] = useState(false);
  const [showSprintImport, setShowSprintImport] = useState(false);
  const { createVictory } = useVictories();

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

  const SPRINT_IMPORT_PROMPT = `You are parsing a sprint plan or project outline into individual milestones. Each item should be a distinct milestone, deliverable, or major step. Return a JSON array of strings, one per milestone. Example: ["Design wireframes", "Build authentication", "Write tests", "Deploy to staging"]`;

  const handleSprintImportSave = useCallback(async (items: ParsedBulkItem[]) => {
    // Create a plan with the milestones
    const plan = await createPlan({
      title: 'Sprint Plan',
      description: `Imported ${items.length} milestones`,
      planning_framework: 'milestone',
      frameworks_used: ['milestone'],
    });
    if (plan) {
      for (let i = 0; i < items.length; i++) {
        await createMilestone({
          plan_id: plan.id,
          title: items[i].text,
          sort_order: i,
          status: 'pending',
        });
      }
      await fetchPlan(plan.id);
      setViewMode('detail');
    }
    setShowSprintImport(false);
  }, [createPlan, createMilestone, fetchPlan]);

  const handlePlanAtHelm = useCallback(() => {
    setFabExpanded(false);
    startGuidedConversation('rigging');
  }, [startGuidedConversation]);

  const handleCompletePlan = useCallback(async (id: string) => {
    const plan = plans.find((p) => p.id === id) || selectedPlan;
    await completePlan(id);
    if (plan) {
      setShowSparkle(true);
      createVictory({
        description: `Completed plan: ${plan.title}`,
        source: 'manual',
        source_reference_id: plan.id,
      });
    }
    handleBack();
  }, [completePlan, handleBack, plans, selectedPlan, createVictory]);

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

      <FeatureGuide {...FEATURE_GUIDES[activeTab === 'priorities' ? 'priorities' : 'rigging']} />

      <SparkleOverlay show={showSparkle} size="quick" onComplete={() => setShowSparkle(false)} />

      {/* Tab bar */}
      <div className="rigging-page__tabs">
        <button
          type="button"
          className={`rigging-page__tab ${activeTab === 'plans' ? 'rigging-page__tab--active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          Plans
        </button>
        <button
          type="button"
          className={`rigging-page__tab ${activeTab === 'priorities' ? 'rigging-page__tab--active' : ''}`}
          onClick={() => setActiveTab('priorities')}
        >
          Priorities
        </button>
      </div>

      {activeTab === 'priorities' ? (
        <PrioritiesView onAddClick={() => setShowAddPriority(true)} />
      ) : (
        <>
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
                  label="Completed"
                  count={completedPlans.length}
                  defaultExpanded={false}
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
        </>
      )}

      {/* FAB */}
      <FloatingActionButton
        onClick={() => {
          if (activeTab === 'priorities') {
            setShowAddPriority(true);
          } else {
            setFabExpanded(true);
          }
        }}
        aria-label={activeTab === 'priorities' ? 'Add priority' : 'Create new plan'}
        title={activeTab === 'priorities' ? 'Add priority' : 'Create new plan'}
      >
        <Plus size={24} />
      </FloatingActionButton>

      {/* New Plan options modal */}
      {fabExpanded && activeTab === 'plans' && (
        <>
          <div className="rigging-page__fab-overlay" onClick={() => setFabExpanded(false)} />
          <div className="rigging-page__fab-modal" role="dialog" aria-label="New plan options">
            <h3 className="rigging-page__fab-modal-title">New Plan</h3>
            <button
              type="button"
              className="rigging-page__fab-option"
              onClick={handlePlanAtHelm}
            >
              <MessageSquare size={18} />
              <div>
                <span className="rigging-page__fab-option-label">Plan at The Helm</span>
                <span className="rigging-page__fab-option-desc">AI-guided planning conversation</span>
              </div>
            </button>
            <button
              type="button"
              className="rigging-page__fab-option"
              onClick={() => { setFabExpanded(false); setViewMode('create'); }}
            >
              <PenLine size={18} />
              <div>
                <span className="rigging-page__fab-option-label">Create Manually</span>
                <span className="rigging-page__fab-option-desc">Fill in plan details yourself</span>
              </div>
            </button>
            <button
              type="button"
              className="rigging-page__fab-option"
              onClick={() => { setFabExpanded(false); setShowSprintImport(true); }}
            >
              <ListPlus size={18} />
              <div>
                <span className="rigging-page__fab-option-label">Import Sprint Plan</span>
                <span className="rigging-page__fab-option-desc">Paste milestones and let AI sort them</span>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Add Priority Modal */}
      {showAddPriority && (
        <AddPriorityModal
          onClose={() => setShowAddPriority(false)}
          onSave={createPriority}
          committedNowCount={getCommittedNowCount()}
        />
      )}

      {/* Sprint Import Modal */}
      {showSprintImport && (
        <AddEntryModal title="Import Sprint Plan" onClose={() => setShowSprintImport(false)}>
          <BulkAddWithAISort
            title="Import Sprint Plan"
            placeholder={"Paste your project milestones, sprint tasks, or project outline...\n\nDesign wireframes\nBuild authentication system\nSet up CI/CD pipeline\nWrite integration tests\nDeploy to staging"}
            parsePrompt={SPRINT_IMPORT_PROMPT}
            onSave={handleSprintImportSave}
            onClose={() => setShowSprintImport(false)}
          />
        </AddEntryModal>
      )}
    </div>
  );
}
