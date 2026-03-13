import { useState, useCallback } from 'react';
import { X, Plus, Trash2, ChevronLeft, BookOpen, Download, Maximize2, Send } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { ManifestCollection, ManifestItem } from '../../lib/types';
import type { ManifestCollectionItem } from '../../lib/types';
import './CollectionSidebar.css';

interface CollectionSidebarProps {
  collections: ManifestCollection[];
  collectionItemsMap: Map<string, ManifestCollectionItem[]>;
  items: ManifestItem[];
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (name: string) => Promise<ManifestCollection | null>;
  onArchiveCollection: (id: string) => void;
  onUpdateCollection: (id: string, updates: { name?: string }) => void;
  onRemoveFromCollection: (collectionId: string, manifestItemId: string) => void;
  onViewExtractions: (collectionId: string) => void;
  onExportCollection: (collectionId: string) => void;
  onOpenModal: (collectionId: string) => void;
  onClose: () => void;
  isAdmin?: boolean;
  onPushCollection?: (collectionId: string) => void;
  pushLoading?: boolean;
}

function DroppableCollection({
  collection,
  count,
  isActive,
  onSelect,
  onArchive,
}: {
  collection: ManifestCollection;
  count: number;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: collection.id });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={`collection-sidebar__item${isActive ? ' collection-sidebar__item--active' : ''}${isOver ? ' collection-sidebar__item--over' : ''}`}
    >
      <button
        type="button"
        className="collection-sidebar__item-btn"
        onClick={onSelect}
      >
        <span className="collection-sidebar__item-name">{collection.name}</span>
        {collection.source_collection_id && (
          <span className="collection-sidebar__shared-badge">Shared</span>
        )}
        <span className="collection-sidebar__item-count">{count}</span>
      </button>
      {confirmDelete ? (
        <div className="collection-sidebar__confirm">
          <button
            type="button"
            className="collection-sidebar__confirm-yes"
            onClick={() => { onArchive(); setConfirmDelete(false); }}
          >
            Delete
          </button>
          <button
            type="button"
            className="collection-sidebar__confirm-no"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="collection-sidebar__delete-btn"
          onClick={() => setConfirmDelete(true)}
          title="Delete collection"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export function CollectionSidebar({
  collections,
  collectionItemsMap,
  items,
  activeCollectionId,
  onSelectCollection,
  onCreateCollection,
  onArchiveCollection,
  onUpdateCollection,
  onRemoveFromCollection,
  onViewExtractions,
  onExportCollection,
  onOpenModal,
  onClose,
  isAdmin,
  onPushCollection,
  pushLoading,
}: CollectionSidebarProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const activeItems = activeCollectionId
    ? (collectionItemsMap.get(activeCollectionId) || [])
    : [];

  const resolveItem = useCallback((manifestItemId: string) => {
    return items.find((i) => i.id === manifestItemId);
  }, [items]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateCollection(newName.trim());
      setNewName('');
    } finally {
      setCreating(false);
    }
  }, [newName, creating, onCreateCollection]);

  const handleSaveRename = useCallback(() => {
    if (!editingName || !editValue.trim()) return;
    onUpdateCollection(editingName, { name: editValue.trim() });
    setEditingName(null);
  }, [editingName, editValue, onUpdateCollection]);

  return (
    <div className="collection-sidebar">
      <div className="collection-sidebar__header">
        <h3 className="collection-sidebar__title">Collections</h3>
        <button
          type="button"
          className="collection-sidebar__close"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Collection detail view */}
      {activeCollection ? (
        <div className="collection-sidebar__detail">
          <div className="collection-sidebar__detail-header">
            <button
              type="button"
              className="collection-sidebar__back"
              onClick={() => onSelectCollection(null)}
            >
              <ChevronLeft size={14} />
              All Collections
            </button>
            <button
              type="button"
              className="collection-sidebar__expand-btn"
              onClick={() => onOpenModal(activeCollection.id)}
              title="Open full view to reorder"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {editingName === activeCollection.id ? (
            <div className="collection-sidebar__rename">
              <input
                type="text"
                className="collection-sidebar__rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setEditingName(null);
                }}
                autoFocus
              />
              <button
                type="button"
                className="collection-sidebar__rename-save"
                onClick={handleSaveRename}
              >
                Save
              </button>
            </div>
          ) : (
            <h4
              className="collection-sidebar__detail-name"
              onClick={() => {
                setEditingName(activeCollection.id);
                setEditValue(activeCollection.name);
              }}
              title="Click to rename"
            >
              {activeCollection.name}
            </h4>
          )}

          <div className="collection-sidebar__books">
            {activeItems.length === 0 ? (
              <p className="collection-sidebar__empty-detail">
                Drag books here to add them.
              </p>
            ) : (
              activeItems.map((ci) => {
                const item = resolveItem(ci.manifest_item_id);
                if (!item) return null;
                return (
                  <div key={ci.id} className="collection-sidebar__book-row">
                    <span className="collection-sidebar__book-title">
                      {item.title}
                    </span>
                    <button
                      type="button"
                      className="collection-sidebar__book-remove"
                      onClick={() => onRemoveFromCollection(activeCollection.id, ci.manifest_item_id)}
                      title="Remove from collection"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {activeItems.length > 0 && (
            <div className="collection-sidebar__actions">
              <button
                type="button"
                className="collection-sidebar__action-btn"
                onClick={() => onViewExtractions(activeCollection.id)}
              >
                <BookOpen size={14} />
                View Extractions
              </button>
              <button
                type="button"
                className="collection-sidebar__action-btn"
                onClick={() => onExportCollection(activeCollection.id)}
              >
                <Download size={14} />
                Export
              </button>
              {isAdmin && onPushCollection && (
                <button
                  type="button"
                  className="collection-sidebar__action-btn collection-sidebar__action-btn--admin"
                  onClick={() => onPushCollection(activeCollection.id)}
                  disabled={pushLoading}
                >
                  <Send size={14} />
                  {pushLoading ? 'Pushing...' : 'Push to All Users'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Collection list */}
          <div className="collection-sidebar__list">
            {collections.length === 0 ? (
              <div className="collection-sidebar__empty">
                <p className="collection-sidebar__empty-text">
                  Name a collection below, then drag books into it.
                </p>
              </div>
            ) : (
              collections.map((col) => (
                <DroppableCollection
                  key={col.id}
                  collection={col}
                  count={(collectionItemsMap.get(col.id) || []).length}
                  isActive={col.id === activeCollectionId}
                  onSelect={() => onSelectCollection(col.id)}
                  onArchive={() => onArchiveCollection(col.id)}
                />
              ))
            )}
          </div>

          {/* New collection input */}
          <div className="collection-sidebar__new">
            <input
              type="text"
              className="collection-sidebar__new-input"
              placeholder="New collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              autoFocus={collections.length === 0}
            />
            <button
              type="button"
              className="collection-sidebar__new-btn"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
