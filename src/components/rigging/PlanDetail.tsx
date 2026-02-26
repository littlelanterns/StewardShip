import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { RiggingPlan, RiggingMilestone, RiggingObstacle, LogEntry, HelmConversation, CompassTask } from '../../lib/types';
import { PLANNING_FRAMEWORK_LABELS } from '../../lib/types';
import { Button } from '../shared';
import { MilestoneList } from './MilestoneList';
import { ObstacleList } from './ObstacleList';
import { MoscowView } from './MoscowView';
import { TenTenTenView } from './TenTenTenView';
import { NudgePreferences } from './NudgePreferences';
import { PlanJournalTab } from './PlanJournalTab';
import { PlanConversationsTab } from './PlanConversationsTab';
import './PlanDetail.css';

type DetailTab = 'plan' | 'journal' | 'conversations';

interface PlanDetailProps {
  plan: RiggingPlan;
  milestones: RiggingMilestone[];
  obstacles: RiggingObstacle[];
  linkedLogEntries: LogEntry[];
  linkedConversations: HelmConversation[];
  linkedTasks: CompassTask[];
  onBack: () => void;
  onUpdatePlan: (id: string, updates: Partial<RiggingPlan>) => void;
  onCompletePlan: (id: string) => void;
  onPausePlan: (id: string) => void;
  onArchivePlan: (id: string) => void;
  onContinueAtHelm: (plan: RiggingPlan) => void;
  onCreateMilestone: (planId: string, data: Partial<RiggingMilestone>) => void;
  onUpdateMilestone: (id: string, updates: Partial<RiggingMilestone>) => void;
  onDeleteMilestone: (id: string) => void;
  onCreateObstacle: (planId: string, data: { risk_description: string; mitigation_plan: string }) => void;
  onUpdateObstacle: (id: string, updates: Partial<RiggingObstacle>) => void;
  onDeleteObstacle: (id: string) => void;
  onLoadMilestones: (planId: string) => void;
  onLoadObstacles: (planId: string) => void;
  onLoadJournal: (planId: string) => void;
  onLoadConversations: (planId: string) => void;
  onConversationClick?: (conversationId: string) => void;
  onBreakDownMilestone?: (milestone: RiggingMilestone) => void;
}

export function PlanDetail({
  plan,
  milestones,
  obstacles,
  linkedLogEntries,
  linkedConversations,
  linkedTasks,
  onBack,
  onUpdatePlan,
  onCompletePlan,
  onPausePlan,
  onArchivePlan,
  onContinueAtHelm,
  onCreateMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onCreateObstacle,
  onUpdateObstacle,
  onDeleteObstacle,
  onLoadMilestones,
  onLoadObstacles,
  onLoadJournal,
  onLoadConversations,
  onConversationClick,
}: PlanDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('plan');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(plan.title);
  const [descDraft, setDescDraft] = useState(plan.description || '');

  useEffect(() => {
    onLoadMilestones(plan.id);
    onLoadObstacles(plan.id);
  }, [plan.id, onLoadMilestones, onLoadObstacles]);

  const handleLoadJournal = useCallback((planId: string) => {
    onLoadJournal(planId);
  }, [onLoadJournal]);

  const saveTitle = () => {
    if (titleDraft.trim()) {
      onUpdatePlan(plan.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const saveDesc = () => {
    onUpdatePlan(plan.id, { description: descDraft.trim() || null });
    setEditingDesc(false);
  };

  const hasMoscow = plan.planning_framework === 'moscow' || plan.frameworks_used.includes('moscow');
  const hasTenTenTen = plan.planning_framework === 'ten_ten_ten' || plan.frameworks_used.includes('ten_ten_ten');

  return (
    <div className="plan-detail">
      <button type="button" className="plan-detail__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="plan-detail__header">
        {editingTitle ? (
          <div className="plan-detail__title-edit">
            <input
              type="text"
              className="plan-detail__title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleDraft(plan.title); setEditingTitle(false); }
              }}
              autoFocus
            />
          </div>
        ) : (
          <h2
            className="plan-detail__title"
            onClick={() => setEditingTitle(true)}
            title="Click to edit"
          >
            {plan.title}
          </h2>
        )}

        <div className="plan-detail__meta">
          {plan.planning_framework && (
            <span className="plan-detail__framework">
              {PLANNING_FRAMEWORK_LABELS[plan.planning_framework]}
            </span>
          )}
          <span className={`plan-detail__status plan-detail__status--${plan.status}`}>
            {plan.status}
          </span>
        </div>

        {editingDesc ? (
          <div className="plan-detail__desc-edit">
            <textarea
              className="plan-detail__desc-textarea"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="plan-detail__desc-actions">
              <Button size="sm" onClick={saveDesc}>Save</Button>
              <Button size="sm" variant="text" onClick={() => { setDescDraft(plan.description || ''); setEditingDesc(false); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p
            className="plan-detail__description"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {plan.description || 'Click to add a description...'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="plan-detail__actions">
        {plan.status === 'active' && (
          <>
            <Button size="sm" onClick={() => onContinueAtHelm(plan)}>
              Continue at Helm
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onPausePlan(plan.id)}>
              Pause
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onCompletePlan(plan.id)}>
              Mark Complete
            </Button>
          </>
        )}
        {plan.status === 'paused' && (
          <>
            <Button size="sm" onClick={() => onUpdatePlan(plan.id, { status: 'active' })}>
              Resume
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onContinueAtHelm(plan)}>
              Continue at Helm
            </Button>
          </>
        )}
        {plan.status === 'completed' && (
          <Button size="sm" variant="secondary" onClick={() => onUpdatePlan(plan.id, { status: 'active' })}>
            Reopen
          </Button>
        )}
        {(plan.status === 'completed' || plan.status === 'paused') && (
          <Button size="sm" variant="text" onClick={() => onArchivePlan(plan.id)}>
            Archive
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="plan-detail__tabs">
        <button
          type="button"
          className={`plan-detail__tab${activeTab === 'plan' ? ' plan-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          Plan
        </button>
        <button
          type="button"
          className={`plan-detail__tab${activeTab === 'journal' ? ' plan-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          className={`plan-detail__tab${activeTab === 'conversations' ? ' plan-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          Conversations
        </button>
      </div>

      {/* Tab content */}
      <div className="plan-detail__tab-content">
        {activeTab === 'plan' && (
          <div className="plan-detail__plan-content">
            {/* Milestones */}
            <section className="plan-detail__section">
              <h3 className="plan-detail__section-title">Milestones</h3>
              <MilestoneList
                milestones={milestones}
                onUpdate={onUpdateMilestone}
                onDelete={onDeleteMilestone}
                onCreate={onCreateMilestone}
                planId={plan.id}
              />
            </section>

            {/* Obstacles */}
            <section className="plan-detail__section">
              <h3 className="plan-detail__section-title">Obstacles</h3>
              <ObstacleList
                obstacles={obstacles}
                onUpdate={onUpdateObstacle}
                onDelete={onDeleteObstacle}
                onCreate={onCreateObstacle}
                planId={plan.id}
              />
            </section>

            {/* MoSCoW view if applicable */}
            {hasMoscow && (
              <section className="plan-detail__section">
                <h3 className="plan-detail__section-title">MoSCoW Prioritization</h3>
                <MoscowView plan={plan} onUpdate={onUpdatePlan} />
              </section>
            )}

            {/* 10-10-10 view if applicable */}
            {hasTenTenTen && (
              <section className="plan-detail__section">
                <h3 className="plan-detail__section-title">10-10-10 Analysis</h3>
                <TenTenTenView plan={plan} onUpdate={onUpdatePlan} />
              </section>
            )}

            {/* Linked tasks */}
            {linkedTasks.length > 0 && (
              <section className="plan-detail__section">
                <h3 className="plan-detail__section-title">
                  Linked Tasks ({linkedTasks.length})
                </h3>
                <div className="plan-detail__linked-tasks">
                  {linkedTasks.map((task) => (
                    <div key={task.id} className="plan-detail__linked-task">
                      <span className={`plan-detail__task-status plan-detail__task-status--${task.status}`}>
                        {task.status === 'completed' ? 'Done' : task.status}
                      </span>
                      <span className="plan-detail__task-title">{task.title}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Nudge preferences */}
            <section className="plan-detail__section">
              <NudgePreferences plan={plan} onUpdate={onUpdatePlan} />
            </section>
          </div>
        )}

        {activeTab === 'journal' && (
          <PlanJournalTab
            plan={plan}
            entries={linkedLogEntries}
            onLoad={handleLoadJournal}
          />
        )}

        {activeTab === 'conversations' && (
          <PlanConversationsTab
            plan={plan}
            conversations={linkedConversations}
            onLoad={onLoadConversations}
            onConversationClick={onConversationClick}
          />
        )}
      </div>
    </div>
  );
}
