import { useEffect, useCallback, useState } from 'react';
import type { Priority, PriorityTier } from '../../lib/types';
import { PRIORITY_TIER_LABELS, PRIORITY_TIER_ORDER } from '../../lib/types';
import { usePriorities } from '../../hooks/usePriorities';
import { useVictories } from '../../hooks/useVictories';
import { PriorityCard } from './PriorityCard';
import { PriorityDetail } from './PriorityDetail';
import { CollapsibleGroup } from '../shared/CollapsibleGroup';
import { EmptyState, LoadingSpinner } from '../shared';

interface PrioritiesViewProps {
  onAddClick: () => void;
}

export function PrioritiesView({ onAddClick }: PrioritiesViewProps) {
  const {
    priorities,
    selectedPriority,
    loading,
    fetchPriorities,
    fetchPriority,
    updatePriority,
    moveTier,
    achievePriority,
    archivePriority,
    setSelectedPriority,
    getCommittedNowCount,
    getCommittedLater,
  } = usePriorities();

  const { createVictory } = useVictories();
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    fetchPriorities();
  }, [fetchPriorities]);

  const handleSelect = useCallback(async (priority: Priority) => {
    await fetchPriority(priority.id);
    setViewMode('detail');
  }, [fetchPriority]);

  const handleBack = useCallback(() => {
    setSelectedPriority(null);
    setViewMode('list');
    fetchPriorities();
  }, [setSelectedPriority, fetchPriorities]);

  const handleAchieve = useCallback(async (id: string) => {
    const p = priorities.find((pr) => pr.id === id);
    await achievePriority(id);
    if (p) {
      createVictory({
        description: `Achieved priority: ${p.title}`,
        source: 'manual',
        source_reference_id: p.id,
      });
    }
  }, [achievePriority, priorities, createVictory]);

  const handlePromote = useCallback(async (id: string) => {
    await moveTier(id, 'committed_now');
  }, [moveTier]);

  // Group by tier
  const grouped: Record<PriorityTier, Priority[]> = {
    committed_now: [],
    committed_later: [],
    interested: [],
    achieved: [],
  };

  for (const p of priorities) {
    if (!p.archived_at) {
      grouped[p.tier].push(p);
    }
  }

  // Sort within groups
  for (const tier of PRIORITY_TIER_ORDER) {
    grouped[tier].sort((a, b) => a.sort_order - b.sort_order);
  }

  if (viewMode === 'detail' && selectedPriority) {
    return (
      <PriorityDetail
        priority={selectedPriority}
        committedNowCount={getCommittedNowCount()}
        committedLaterItems={getCommittedLater()}
        onBack={handleBack}
        onUpdate={updatePriority}
        onMoveTier={moveTier}
        onAchieve={handleAchieve}
        onArchive={async (id) => { await archivePriority(id); handleBack(); }}
        onPromote={handlePromote}
      />
    );
  }

  if (loading && priorities.length === 0) {
    return <LoadingSpinner />;
  }

  if (priorities.length === 0) {
    return (
      <EmptyState
        heading="No priorities yet"
        message="Add priorities to track what you're committed to. Organize them by tier to keep your focus sharp."
        action={{ label: 'Add Priority', onClick: onAddClick }}
      />
    );
  }

  const activeTiers: PriorityTier[] = ['committed_now', 'committed_later', 'interested'];

  return (
    <div className="priorities-view">
      {activeTiers.map((tier) => {
        const items = grouped[tier];
        if (items.length === 0) return null;
        return (
          <CollapsibleGroup
            key={tier}
            label={PRIORITY_TIER_LABELS[tier]}
            count={items.length}
            defaultExpanded={true}
          >
            <div className="rigging-page__plan-list">
              {items.map((p) => (
                <PriorityCard key={p.id} priority={p} onClick={handleSelect} />
              ))}
            </div>
          </CollapsibleGroup>
        );
      })}

      {grouped.achieved.length > 0 && (
        <CollapsibleGroup
          label={PRIORITY_TIER_LABELS.achieved}
          count={grouped.achieved.length}
          defaultExpanded={false}
        >
          <div className="rigging-page__plan-list">
            {grouped.achieved.map((p) => (
              <PriorityCard key={p.id} priority={p} onClick={handleSelect} showTier />
            ))}
          </div>
        </CollapsibleGroup>
      )}
    </div>
  );
}
