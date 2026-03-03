import { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useLists } from '../hooks/useLists';
import { useRoutineReset } from '../hooks/useRoutineReset';
import { useRoutineAssignment } from '../hooks/useRoutineAssignment';
import { useCompass } from '../hooks/useCompass';
import { useVictories } from '../hooks/useVictories';
import { useAuthContext } from '../contexts/AuthContext';
import { autoTagTask } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { FloatingActionButton, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import ListsMain from '../components/compass/lists/ListsMain';
import ListDetail from '../components/compass/lists/ListDetail';
import CreateListModal from '../components/compass/lists/CreateListModal';
import BulkAddItems from '../components/compass/lists/BulkAddItems';
import AssignRoutineModal from '../components/compass/lists/AssignRoutineModal';
import RoutineSetupWizard from '../components/compass/lists/RoutineSetupWizard';
import type { List, ListItem } from '../lib/types';
import './Lists.css';

type ListsPageView = 'main' | 'detail' | 'create' | 'bulk_add' | 'assign_routine' | 'routine_wizard';

export default function Lists() {
  usePageContext({ page: 'lists' });

  const { user } = useAuthContext();

  const {
    lists,
    items,
    loading,
    error,
    fetchLists,
    createList,
    updateList,
    archiveList,
    fetchListItems,
    addListItem,
    updateListItem,
    toggleListItem,
    deleteListItem,
    reorderListItems,
    generateShareToken,
    getItemHierarchy,
  } = useLists();

  const {
    history: routineHistory,
    shouldAutoReset,
    resetRoutine,
    fetchHistory,
    getCompletionStats,
  } = useRoutineReset();

  const { createAssignment, getAssignmentForList, fetchAssignments, pauseAssignment, resumeAssignment, removeAssignment } = useRoutineAssignment();
  const { createTask } = useCompass();
  const { createVictory } = useVictories();

  const [pageView, setPageView] = useState<ListsPageView>('main');
  const [selectedList, setSelectedList] = useState<List | null>(null);
  // Track item IDs that have been sent to Compass (query-based approach)
  const [promotedItemIds, setPromotedItemIds] = useState<Set<string>>(new Set());

  // Fetch assignments so getAssignmentForList works
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Fetch promoted item IDs when viewing a list detail
  useEffect(() => {
    if (!user || !selectedList || pageView !== 'detail') return;
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) {
      setPromotedItemIds(new Set());
      return;
    }
    // Query compass_tasks for items promoted from this list's items
    supabase
      .from('compass_tasks')
      .select('source_reference_id')
      .eq('user_id', user.id)
      .eq('source', 'list_converted')
      .in('source_reference_id', itemIds)
      .then(({ data }) => {
        if (data) {
          setPromotedItemIds(new Set(data.map((t) => t.source_reference_id).filter(Boolean) as string[]));
        }
      });
  }, [user, selectedList, pageView, items]);

  const handleListClick = useCallback((list: List) => {
    setSelectedList(list);
    setPageView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setPageView('main');
    setSelectedList(null);
    setPromotedItemIds(new Set());
    fetchLists();
  }, [fetchLists]);

  const handleConvertToTasks = useCallback(async (
    listItems: ListItem[],
    _listTitle: string,
    listId: string,
  ): Promise<number> => {
    const unchecked = listItems.filter((i) => !i.checked);
    if (unchecked.length === 0) return 0;

    let created = 0;
    for (const item of unchecked) {
      const task = await createTask({
        title: item.text,
        description: item.notes || undefined,
        source: 'list_converted',
        source_reference_id: listId,
      });
      if (task) created++;
    }
    return created;
  }, [createTask]);

  // Wrap resetRoutine to auto-create victory (Feature 6)
  const handleResetRoutine = useCallback(async (listId: string, listItems: ListItem[]) => {
    const result = await resetRoutine(listId, listItems);
    if (result) {
      const completedItems = listItems.filter((i) => i.checked);
      if (completedItems.length > 0) {
        const listTitle = selectedList?.title || 'Routine';
        const allDone = completedItems.length === listItems.length;
        const description = allDone
          ? `Completed all steps of ${listTitle}!`
          : `Completed ${completedItems.map((i) => i.text).join(', ')} of ${listTitle}`;

        await createVictory({
          description,
          celebration_text: null,
          source: 'routine_completion',
          source_reference_id: result.id,
        });
      }
    }
    return result;
  }, [resetRoutine, selectedList, createVictory]);

  const handleBulkAddItems = useCallback(async (itemTexts: string[]) => {
    if (!selectedList) return;
    for (const text of itemTexts) {
      await addListItem(selectedList.id, text);
    }
  }, [selectedList, addListItem]);

  const handleAssignRoutine = useCallback(async (data: {
    recurrence_rule: string;
    custom_days?: number[] | null;
    ends_at?: string | null;
  }) => {
    if (!selectedList) return;
    await createAssignment({
      list_id: selectedList.id,
      recurrence_rule: data.recurrence_rule,
      custom_days: data.custom_days,
      ends_at: data.ends_at,
    });
    setPageView('detail');
  }, [selectedList, createAssignment]);

  const handleConvertToRecurringTasks = useCallback(async (
    listItems: ListItem[],
    _listTitle: string,
    listId: string,
    recurrenceRule: string,
  ): Promise<number> => {
    const unchecked = listItems.filter((i) => !i.checked);
    if (unchecked.length === 0) return 0;

    let created = 0;
    for (const item of unchecked) {
      const task = await createTask({
        title: item.text,
        description: item.notes || undefined,
        source: 'list_converted',
        source_reference_id: listId,
        recurrence_rule: recurrenceRule as 'daily' | 'weekdays' | 'weekly' | null,
      });
      if (task) created++;
    }
    return created;
  }, [createTask]);

  // Victory creation for individual list items
  const handleCreateVictory = useCallback(async (itemText: string, listTitle: string, _itemId: string) => {
    await createVictory({
      description: itemText,
      celebration_text: null,
      source: 'list_item_completed',
      source_reference_id: selectedList?.id || null,
    });
  }, [createVictory, selectedList]);

  // Send individual item to Compass
  const handleSendToCompass = useCallback(async (item: ListItem, listTitle: string) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const task = await createTask({
      title: item.text,
      description: item.notes || undefined,
      source: 'list_converted',
      source_reference_id: item.id,
      due_date: today,
    });
    if (task) {
      // Track promoted state locally
      setPromotedItemIds((prev) => new Set(prev).add(item.id));
      // Auto-tag in background
      autoTagTask(item.text, item.notes, user.id).then((tag) => {
        if (tag) {
          supabase
            .from('compass_tasks')
            .update({ life_area_tag: tag })
            .eq('id', task.id)
            .eq('user_id', user.id);
        }
      });
    }
  }, [user, createTask]);

  if (pageView === 'create') {
    return (
      <div className="page lists-page">
        <CreateListModal
          onSave={async (data) => {
            const list = await createList(data);
            if (list) {
              setSelectedList(list);
              if (list.list_type === 'routine') {
                setPageView('routine_wizard');
              } else {
                setPageView('detail');
              }
            }
          }}
          onBack={() => setPageView('main')}
        />
      </div>
    );
  }

  if (pageView === 'routine_wizard' && selectedList) {
    return (
      <div className="page lists-page">
        <RoutineSetupWizard
          list={selectedList}
          onComplete={() => setPageView('detail')}
          onAddItems={handleBulkAddItems}
          onAssignToCompass={handleAssignRoutine}
        />
      </div>
    );
  }

  if (pageView === 'bulk_add' && selectedList) {
    return (
      <div className="page lists-page">
        <BulkAddItems
          listTitle={selectedList.title}
          onAddItems={handleBulkAddItems}
          onClose={() => setPageView('detail')}
        />
      </div>
    );
  }

  if (pageView === 'assign_routine' && selectedList) {
    return (
      <div className="page lists-page">
        <AssignRoutineModal
          listTitle={selectedList.title}
          onSave={handleAssignRoutine}
          onBack={() => setPageView('detail')}
        />
      </div>
    );
  }

  if (pageView === 'detail' && selectedList) {
    return (
      <div className="page lists-page">
        <ListDetail
          list={selectedList}
          items={items}
          onBack={handleBack}
          onUpdateList={updateList}
          onArchiveList={archiveList}
          onFetchItems={fetchListItems}
          onAddItem={addListItem}
          onToggleItem={toggleListItem}
          onDeleteItem={deleteListItem}
          onReorderItems={reorderListItems}
          onGenerateShareToken={generateShareToken}
          onUpdateItem={updateListItem}
          onResetRoutine={handleResetRoutine}
          onFetchHistory={fetchHistory}
          routineHistory={routineHistory}
          shouldAutoReset={shouldAutoReset}
          onConvertToTasks={handleConvertToTasks}
          onConvertToRecurringTasks={handleConvertToRecurringTasks}
          getItemHierarchy={getItemHierarchy}
          routineStats={routineHistory.length > 0 ? getCompletionStats(routineHistory, selectedList.reset_schedule || undefined) : undefined}
          onShowBulkAdd={() => setPageView('bulk_add')}
          assignment={getAssignmentForList(selectedList.id)}
          onAssignToCompass={() => setPageView('assign_routine')}
          onPauseAssignment={pauseAssignment}
          onResumeAssignment={resumeAssignment}
          onRemoveAssignment={removeAssignment}
          onCreateVictory={handleCreateVictory}
          onSendToCompass={handleSendToCompass}
          promotedItemIds={promotedItemIds}
        />
      </div>
    );
  }

  return (
    <div className="page lists-page">
      <div className="lists-page__header">
        <h1 className="lists-page__title">Lists</h1>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.lists} />

      <ListsMain
        lists={lists}
        loading={loading}
        error={error}
        onFetchLists={fetchLists}
        onListClick={handleListClick}
        onCreateClick={() => setPageView('create')}
      />

      <FloatingActionButton onClick={() => setPageView('create')} aria-label="New list">
        <Plus size={24} />
      </FloatingActionButton>
    </div>
  );
}
