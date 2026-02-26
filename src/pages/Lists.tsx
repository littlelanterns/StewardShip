import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useLists } from '../hooks/useLists';
import { useRoutineReset } from '../hooks/useRoutineReset';
import { useCompass } from '../hooks/useCompass';
import { FloatingActionButton, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import ListsMain from '../components/compass/lists/ListsMain';
import ListDetail from '../components/compass/lists/ListDetail';
import CreateListModal from '../components/compass/lists/CreateListModal';
import type { List, ListItem } from '../lib/types';
import './Lists.css';

type ListsPageView = 'main' | 'detail' | 'create';

export default function Lists() {
  usePageContext({ page: 'lists' });

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
  } = useLists();

  const {
    history: routineHistory,
    shouldAutoReset,
    resetRoutine,
    fetchHistory,
  } = useRoutineReset();

  const { createTask } = useCompass();

  const [pageView, setPageView] = useState<ListsPageView>('main');
  const [selectedList, setSelectedList] = useState<List | null>(null);

  const handleListClick = useCallback((list: List) => {
    setSelectedList(list);
    setPageView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setPageView('main');
    setSelectedList(null);
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

  if (pageView === 'create') {
    return (
      <div className="page lists-page">
        <CreateListModal
          onSave={async (data) => {
            const list = await createList(data);
            if (list) {
              setSelectedList(list);
              setPageView('detail');
            }
          }}
          onBack={() => setPageView('main')}
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
          onResetRoutine={resetRoutine}
          onFetchHistory={fetchHistory}
          routineHistory={routineHistory}
          shouldAutoReset={shouldAutoReset}
          onConvertToTasks={handleConvertToTasks}
          onConvertToRecurringTasks={handleConvertToRecurringTasks}
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
