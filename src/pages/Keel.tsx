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
import { CollapsibleGroup, EntryCard, EmptyState, LoadingSpinner, ArchivedView, FloatingActionButton, Button } from '../components/shared';
import { KeelAddModal } from '../components/keel/KeelAddModal';
import { useKeel } from '../hooks/useKeel';
import { usePageContext } from '../hooks/usePageContext';
import type { KeelEntry, KeelCategory } from '../lib/types';
import { KEEL_CATEGORY_LABELS, KEEL_CATEGORY_ORDER } from '../lib/types';
import './Keel.css';

function SortableEntryCard({
  entry,
  onSave,
  onArchive,
}: {
  entry: KeelEntry;
  onSave: (id: string, updates: Partial<KeelEntry>) => Promise<void>;
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
  const [editCategory, setEditCategory] = useState<KeelCategory>(entry.category);
  const [editSource, setEditSource] = useState(entry.source || '');

  useEffect(() => {
    setEditText(entry.text);
    setEditCategory(entry.category);
    setEditSource(entry.source || '');
  }, [entry.text, entry.category, entry.source]);

  const badges = [
    { label: 'Category', value: KEEL_CATEGORY_LABELS[entry.category] },
    ...(entry.source ? [{ label: 'Source', value: entry.source }] : []),
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
            category: editCategory,
            source: editSource.trim() || 'self-observed',
          });
        }}
        onArchive={() => onArchive(entry.id)}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
        editFields={
          <>
            <div className="entry-card__field-group">
              <label className="entry-card__field-label">Category</label>
              <select
                className="entry-card__select"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as KeelCategory)}
              >
                {KEEL_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{KEEL_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="entry-card__field-group">
              <label className="entry-card__field-label">Source</label>
              <input
                className="entry-card__select"
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                placeholder='e.g., "Enneagram Type 1", "therapist"'
              />
            </div>
          </>
        }
      />
    </div>
  );
}

export default function Keel() {
  usePageContext({ page: 'keel' });

  const {
    entriesByCategory,
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
  } = useKeel();

  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedCategory, setPreselectedCategory] = useState<KeelCategory | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleAddForCategory(category: KeelCategory) {
    setPreselectedCategory(category);
    setShowAddModal(true);
  }

  function handleFabClick() {
    setPreselectedCategory(null);
    setShowAddModal(true);
  }

  async function handleShowArchived() {
    setShowArchived(true);
    setArchivedLoading(true);
    await fetchArchivedEntries();
    setArchivedLoading(false);
  }

  function handleDragEnd(category: KeelCategory) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const items = entriesByCategory[category];
      const oldIndex = items.findIndex((e) => e.id === active.id);
      const newIndex = items.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(items, oldIndex, newIndex);
      reorderEntries(category, newOrder.map((e) => e.id));
    };
  }

  const totalEntries = KEEL_CATEGORY_ORDER.reduce(
    (sum, cat) => sum + entriesByCategory[cat].length,
    0
  );

  if (loading) {
    return (
      <div className="page">
        <h1>The Keel</h1>
        <div className="keel-loading">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>The Keel</h1>
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
      <h1>The Keel</h1>
      <p className="keel-subtitle">
        What you're made of.
      </p>

      {totalEntries === 0 ? (
        <EmptyState
          heading="Your Keel is empty"
          message="Add your personality traits, strengths, growth areas, and self-knowledge so the AI can give you more personalized advice."
          action={<Button onClick={handleFabClick}>Add your first entry</Button>}
        />
      ) : (
        KEEL_CATEGORY_ORDER.map((category) => {
          const items = entriesByCategory[category];
          return (
            <CollapsibleGroup
              key={category}
              label={KEEL_CATEGORY_LABELS[category]}
              count={items.length}
            >
              {items.length === 0 ? (
                <EmptyState
                  heading={`No ${KEEL_CATEGORY_LABELS[category].toLowerCase()} yet`}
                  message="Add one below or discover insights at The Helm."
                />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(category)}
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
                onClick={() => handleAddForCategory(category)}
              >
                + Add {KEEL_CATEGORY_LABELS[category].replace(/s$/, '')}
              </Button>
            </CollapsibleGroup>
          );
        })
      )}

      <div className="keel-archived-link">
        <Button variant="text" onClick={handleShowArchived}>
          View Archived
        </Button>
      </div>

      <FloatingActionButton onClick={handleFabClick} aria-label="Add to Keel">
        <Plus size={24} />
      </FloatingActionButton>

      {showAddModal && (
        <KeelAddModal
          onClose={() => setShowAddModal(false)}
          onCreate={createEntry}
          preselectedCategory={preselectedCategory}
        />
      )}

      {showArchived && (
        <ArchivedView
          items={archivedEntries.map((e) => ({
            id: e.id,
            text: e.text,
            badge: KEEL_CATEGORY_LABELS[e.category],
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
