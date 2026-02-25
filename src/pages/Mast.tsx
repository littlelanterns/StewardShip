import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CollapsibleGroup, EntryCard, EmptyState, LoadingSpinner, ArchivedView, FloatingActionButton, Button, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { MastAddModal } from '../components/mast/MastAddModal';
import { useMast } from '../hooks/useMast';
import { usePageContext } from '../hooks/usePageContext';
import type { MastEntry, MastEntryType } from '../lib/types';
import { MAST_TYPE_LABELS, MAST_TYPE_ORDER } from '../lib/types';
import './Mast.css';

function SortableEntryCard({
  entry,
  onSave,
  onArchive,
}: {
  entry: MastEntry;
  onSave: (id: string, updates: Partial<MastEntry>) => Promise<void>;
  onArchive: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editText, setEditText] = useState(entry.text);
  const [editType, setEditType] = useState<MastEntryType>(entry.type);
  const [editCategory, setEditCategory] = useState(entry.category || '');

  // Sync with entry if it changes externally
  useEffect(() => {
    setEditText(entry.text);
    setEditType(entry.type);
    setEditCategory(entry.category || '');
  }, [entry.text, entry.type, entry.category]);

  const badges = [
    { label: 'Type', value: MAST_TYPE_LABELS[entry.type] },
    ...(entry.category ? [{ label: 'Category', value: entry.category }] : []),
  ];

  return (
    <div ref={setNodeRef} style={style}>
      <EntryCard
        id={entry.id}
        text={entry.text}
        badges={badges}
        editText={editText}
        onEditTextChange={setEditText}
        onSave={async (text) => {
          await onSave(entry.id, {
            text,
            type: editType,
            category: editCategory.trim() || null,
          });
        }}
        onArchive={() => onArchive(entry.id)}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
        editFields={
          <>
            <div className="entry-card__field-group">
              <label className="entry-card__field-label">Type</label>
              <select
                className="entry-card__select"
                value={editType}
                onChange={(e) => setEditType(e.target.value as MastEntryType)}
              >
                {MAST_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="entry-card__field-group">
              <label className="entry-card__field-label">Category (optional)</label>
              <input
                className="entry-card__select"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder='e.g., "Marriage", "Work"'
              />
            </div>
          </>
        }
      />
    </div>
  );
}

export default function Mast() {
  usePageContext({ page: 'mast' });

  const {
    entriesByType,
    archivedEntries,
    loading,
    error,
    fetchEntries,
    fetchArchivedEntries,
    createEntry,
    updateEntry,
    archiveEntry,
    restoreEntry,
    reorderEntries,
  } = useMast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedType, setPreselectedType] = useState<MastEntryType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAddForType(type: MastEntryType) {
    setPreselectedType(type);
    setShowAddModal(true);
  }

  function handleFabClick() {
    setPreselectedType(null);
    setShowAddModal(true);
  }

  async function handleShowArchived() {
    setShowArchived(true);
    setArchivedLoading(true);
    await fetchArchivedEntries();
    setArchivedLoading(false);
  }

  function handleDragEnd(type: MastEntryType) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const items = entriesByType[type];
      const oldIndex = items.findIndex((e) => e.id === active.id);
      const newIndex = items.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(items, oldIndex, newIndex);
      reorderEntries(type, newOrder.map((e) => e.id));
    };
  }

  const totalEntries = MAST_TYPE_ORDER.reduce(
    (sum, type) => sum + entriesByType[type].length,
    0
  );

  if (loading) {
    return (
      <div className="page">
        <h1>The Mast</h1>
        <div className="mast-loading">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>The Mast</h1>
        <EmptyState
          heading="Something went wrong"
          message={error}
          action={<Button onClick={fetchEntries}>Try again</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>The Mast</h1>
      <p className="mast-subtitle">
        What holds everything up.
      </p>

      <FeatureGuide {...FEATURE_GUIDES.mast} />

      {totalEntries === 0 ? (
        <EmptyState
          heading="Your Mast is empty"
          message="Add your guiding principles — values, declarations, faith foundations, scriptures, and vision — to anchor every AI conversation."
          action={<Button onClick={handleFabClick}>Add your first principle</Button>}
        />
      ) : (
        MAST_TYPE_ORDER.map((type) => {
          const items = entriesByType[type];
          return (
            <CollapsibleGroup
              key={type}
              label={MAST_TYPE_LABELS[type]}
              count={items.length}
            >
              {items.length === 0 ? (
                <EmptyState
                  heading={`No ${MAST_TYPE_LABELS[type].toLowerCase()} yet`}
                  message="Add one below or craft one at The Helm."
                />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(type)}
                >
                  <SortableContext
                    items={items.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map((entry) => (
                      <SortableEntryCard
                        key={entry.id}
                        entry={entry}
                        onSave={updateEntry}
                        onArchive={archiveEntry}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              <Button
                variant="text"
                onClick={() => handleAddForType(type)}
              >
                + Add {MAST_TYPE_LABELS[type].replace(/s$/, '')}
              </Button>
            </CollapsibleGroup>
          );
        })
      )}

      <div className="mast-archived-link">
        <Button variant="text" onClick={handleShowArchived}>
          View Archived
        </Button>
      </div>

      <FloatingActionButton onClick={handleFabClick} aria-label="Add principle">
        <Plus size={24} />
      </FloatingActionButton>

      {showAddModal && (
        <MastAddModal
          onClose={() => setShowAddModal(false)}
          onCreate={createEntry}
          preselectedType={preselectedType}
        />
      )}

      {showArchived && (
        <ArchivedView
          items={archivedEntries.map((e) => ({
            id: e.id,
            text: e.text,
            badge: MAST_TYPE_LABELS[e.type],
            archived_at: e.archived_at,
          }))}
          onRestore={restoreEntry}
          onClose={() => setShowArchived(false)}
          loading={archivedLoading}
        />
      )}
    </div>
  );
}
