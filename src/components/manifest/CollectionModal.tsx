import { useState, useCallback, useMemo } from 'react';
import { X, GripVertical, BookOpen, Download, Trash2 } from 'lucide-react';
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
import type { ManifestCollection, ManifestCollectionItem, ManifestItem } from '../../lib/types';
import './CollectionModal.css';

interface CollectionModalProps {
  collection: ManifestCollection;
  collectionItems: ManifestCollectionItem[];
  allItems: ManifestItem[];
  onClose: () => void;
  onReorder: (collectionId: string, orderedManifestItemIds: string[]) => void;
  onRemove: (collectionId: string, manifestItemId: string) => void;
  onUpdateCollection: (id: string, updates: { name?: string }) => void;
  onViewExtractions: (collectionId: string) => void;
  onExportCollection: (collectionId: string) => void;
}

function SortableBookRow({
  manifestItemId,
  title,
  onRemove,
}: {
  manifestItemId: string;
  title: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: manifestItemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="collection-modal__row">
      <button
        type="button"
        className="collection-modal__drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span className="collection-modal__row-title">{title}</span>
      <button
        type="button"
        className="collection-modal__row-remove"
        onClick={onRemove}
        title="Remove from collection"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function CollectionModal({
  collection,
  collectionItems,
  allItems,
  onClose,
  onReorder,
  onRemove,
  onUpdateCollection,
  onViewExtractions,
  onExportCollection,
}: CollectionModalProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(collection.name);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedIds = useMemo(
    () => collectionItems.map((ci) => ci.manifest_item_id),
    [collectionItems],
  );

  const resolveTitle = useCallback(
    (manifestItemId: string) => {
      const item = allItems.find((i) => i.id === manifestItemId);
      return item?.title || 'Unknown';
    },
    [allItems],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = orderedIds.indexOf(active.id as string);
      const newIndex = orderedIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
      onReorder(collection.id, newOrder);
    },
    [orderedIds, onReorder, collection.id],
  );

  const handleSaveName = useCallback(() => {
    if (nameValue.trim() && nameValue.trim() !== collection.name) {
      onUpdateCollection(collection.id, { name: nameValue.trim() });
    }
    setEditingName(false);
  }, [nameValue, collection, onUpdateCollection]);

  return (
    <>
      <div className="collection-modal__backdrop" onClick={onClose} />
      <div className="collection-modal">
        <div className="collection-modal__header">
          {editingName ? (
            <input
              type="text"
              className="collection-modal__name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setNameValue(collection.name); setEditingName(false); }
              }}
              autoFocus
            />
          ) : (
            <h2
              className="collection-modal__title"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {collection.name}
            </h2>
          )}
          <button
            type="button"
            className="collection-modal__close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <p className="collection-modal__subtitle">
          {collectionItems.length} book{collectionItems.length !== 1 ? 's' : ''} — drag to reorder
        </p>

        <div className="collection-modal__list">
          {collectionItems.length === 0 ? (
            <p className="collection-modal__empty">
              No books in this collection yet. Drag books from the library or use Select mode.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {orderedIds.map((mid) => (
                  <SortableBookRow
                    key={mid}
                    manifestItemId={mid}
                    title={resolveTitle(mid)}
                    onRemove={() => onRemove(collection.id, mid)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {collectionItems.length > 0 && (
          <div className="collection-modal__actions">
            <button
              type="button"
              className="collection-modal__action-btn"
              onClick={() => { onViewExtractions(collection.id); onClose(); }}
            >
              <BookOpen size={16} />
              View Extractions
            </button>
            <button
              type="button"
              className="collection-modal__action-btn"
              onClick={() => { onExportCollection(collection.id); onClose(); }}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        )}
      </div>
    </>
  );
}
