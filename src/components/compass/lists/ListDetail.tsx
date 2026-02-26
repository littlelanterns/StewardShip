import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, MoreVertical, Trash2, GripVertical, ChevronDown, ChevronUp, History, RotateCcw } from 'lucide-react';
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
import { Button } from '../../shared/Button';
import { Card } from '../../shared/Card';
import type { List, ListItem, RoutineCompletionHistory } from '../../../lib/types';
import { LIST_TYPE_LABELS, RESET_SCHEDULE_LABELS } from '../../../lib/types';
import type { ResetSchedule } from '../../../lib/types';
import './ListDetail.css';

interface ListDetailProps {
  list: List;
  items: ListItem[];
  onBack: () => void;
  onUpdateList: (id: string, updates: Partial<List>) => Promise<List | null>;
  onArchiveList: (id: string) => void;
  onFetchItems: (listId: string) => Promise<ListItem[]>;
  onAddItem: (listId: string, text: string) => Promise<ListItem | null>;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onReorderItems: (listId: string, orderedIds: string[]) => void;
  onGenerateShareToken: (listId: string) => Promise<string | null>;
  onUpdateItem?: (id: string, updates: Partial<ListItem>) => Promise<ListItem | null>;
  onResetRoutine?: (listId: string, items: ListItem[]) => Promise<RoutineCompletionHistory | null>;
  onFetchHistory?: (listId: string) => void;
  routineHistory?: RoutineCompletionHistory[];
  shouldAutoReset?: (list: List) => boolean;
  onConvertToTasks?: (items: ListItem[], listTitle: string, listId: string) => Promise<number>;
  onConvertToRecurringTasks?: (items: ListItem[], listTitle: string, listId: string, recurrenceRule: string) => Promise<number>;
}

function SortableListItemRow({
  item,
  onToggle,
  onDelete,
  onUpdateNotes,
}: {
  item: ListItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateNotes?: (id: string, notes: string | null) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState(item.notes || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleNotesBlur = () => {
    const trimmed = notesText.trim();
    if (onUpdateNotes && trimmed !== (item.notes || '')) {
      onUpdateNotes(item.id, trimmed || null);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="list-detail__item-wrapper">
      <div className="list-detail__item-row">
        <button
          type="button"
          className="list-detail__item-drag"
          {...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          {...(listeners as React.DOMAttributes<HTMLButtonElement>)}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <label className="list-detail__item-check-wrapper">
          <input
            type="checkbox"
            className="list-detail__item-checkbox"
            checked={item.checked}
            onChange={() => onToggle(item.id)}
          />
          <span className="list-detail__item-checkmark" />
        </label>

        <span className={`list-detail__item-text ${item.checked ? 'list-detail__item-text--checked' : ''}`}>
          {item.text}
        </span>

        {onUpdateNotes && (
          <button
            type="button"
            className="list-detail__item-notes-toggle"
            onClick={() => setShowNotes(!showNotes)}
            aria-label={showNotes ? 'Hide notes' : 'Show notes'}
          >
            {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        <button
          type="button"
          className="list-detail__item-delete"
          onClick={() => onDelete(item.id)}
          aria-label="Delete item"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showNotes && onUpdateNotes && (
        <div className="list-detail__item-notes">
          <input
            type="text"
            className="list-detail__notes-input"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add a note..."
          />
        </div>
      )}
    </div>
  );
}

export default function ListDetail({
  list,
  items,
  onBack,
  onUpdateList,
  onArchiveList,
  onFetchItems,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onReorderItems,
  onGenerateShareToken,
  onUpdateItem,
  onResetRoutine,
  onFetchHistory,
  routineHistory,
  shouldAutoReset,
  onConvertToTasks,
  onConvertToRecurringTasks,
}: ListDetailProps) {
  const [title, setTitle] = useState(list.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resetBanner, setResetBanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isRoutine = list.list_type === 'routine';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    onFetchItems(list.id);
  }, [list.id, onFetchItems]);

  // Check auto-reset on mount
  useEffect(() => {
    if (isRoutine && shouldAutoReset && shouldAutoReset(list)) {
      setResetBanner(true);
    }
  }, [isRoutine, shouldAutoReset, list]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleTitleSave = async () => {
    if (title.trim() && title !== list.title) {
      await onUpdateList(list.id, { title: title.trim() });
    }
    setEditingTitle(false);
  };

  const handleAddItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    await onAddItem(list.id, text);
    setNewItemText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(items, oldIndex, newIndex);
    onReorderItems(list.id, newOrder.map((i) => i.id));
  }, [items, list.id, onReorderItems]);

  const handleShare = async () => {
    const token = await onGenerateShareToken(list.id);
    if (token) {
      const url = `${window.location.origin}/lists/shared/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copied to clipboard');
      } catch {
        setShareMessage(`Share link: ${url}`);
      }
      setTimeout(() => setShareMessage(null), 3000);
    }
    setShowMenu(false);
  };

  const handleExport = async () => {
    const text = items.map((i) => `${i.checked ? '[x]' : '[ ]'} ${i.text}${i.notes ? ` (${i.notes})` : ''}`).join('\n');
    try {
      await navigator.clipboard.writeText(`${list.title}\n\n${text}`);
      setShareMessage('List copied to clipboard');
    } catch {
      // Fallback
    }
    setTimeout(() => setShareMessage(null), 3000);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onArchiveList(list.id);
      onBack();
    } else {
      setConfirmDelete(true);
      setShowMenu(false);
    }
  };

  const handleReset = async () => {
    if (onResetRoutine) {
      await onResetRoutine(list.id, items);
      await onFetchItems(list.id);
      setResetBanner(false);
      setShareMessage('Routine reset - items unchecked');
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  const handleShowHistory = () => {
    if (onFetchHistory) {
      onFetchHistory(list.id);
    }
    setShowHistory(!showHistory);
    setShowMenu(false);
  };

  const handleConvertToTasks = async () => {
    if (!onConvertToTasks) return;
    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length === 0) {
      setShareMessage('No unchecked items to convert');
      setTimeout(() => setShareMessage(null), 3000);
      setShowMenu(false);
      return;
    }
    const count = await onConvertToTasks(unchecked, list.title, list.id);
    setShareMessage(`${count} task${count !== 1 ? 's' : ''} added to Compass`);
    setTimeout(() => setShareMessage(null), 3000);
    setShowMenu(false);
  };

  const handleConvertToRecurring = async () => {
    if (!onConvertToRecurringTasks) return;
    const unchecked = items.filter((i) => !i.checked);
    if (unchecked.length === 0) {
      setShareMessage('No unchecked items to convert');
      setTimeout(() => setShareMessage(null), 3000);
      setShowMenu(false);
      return;
    }
    // Use the list's reset schedule to determine recurrence
    const recurrence = list.reset_schedule === 'weekdays' ? 'weekdays' : list.reset_schedule === 'weekly' ? 'weekly' : 'daily';
    const count = await onConvertToRecurringTasks(unchecked, list.title, list.id, recurrence);
    setShareMessage(`${count} recurring task${count !== 1 ? 's' : ''} added to Compass`);
    setTimeout(() => setShareMessage(null), 3000);
    setShowMenu(false);
  };

  const handleUpdateNotes = useCallback((id: string, notes: string | null) => {
    if (onUpdateItem) {
      onUpdateItem(id, { notes });
    }
  }, [onUpdateItem]);

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);
  const completionPct = items.length > 0 ? Math.round((checkedItems.length / items.length) * 100) : 0;

  return (
    <div className="list-detail">
      <div className="list-detail__top-bar">
        <button type="button" className="list-detail__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>

        {editingTitle ? (
          <input
            type="text"
            className="list-detail__title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="list-detail__title-btn"
            onClick={() => setEditingTitle(true)}
          >
            {list.title}
          </button>
        )}

        <span className="list-detail__badge">{LIST_TYPE_LABELS[list.list_type]}</span>

        <div className="list-detail__menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className="list-detail__menu-btn"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="More actions"
          >
            <MoreVertical size={20} />
          </button>

          {showMenu && (
            <div className="list-detail__menu">
              <button type="button" className="list-detail__menu-item" onClick={handleShare}>
                Share List
              </button>
              <button type="button" className="list-detail__menu-item" onClick={handleExport}>
                Export List
              </button>
              {onConvertToTasks && (
                <button type="button" className="list-detail__menu-item" onClick={handleConvertToTasks}>
                  Convert to Tasks
                </button>
              )}
              {isRoutine && onConvertToRecurringTasks && (
                <button type="button" className="list-detail__menu-item" onClick={handleConvertToRecurring}>
                  Add to Compass as Recurring
                </button>
              )}
              {isRoutine && onResetRoutine && (
                <button type="button" className="list-detail__menu-item" onClick={handleReset}>
                  Reset Routine
                </button>
              )}
              {isRoutine && onFetchHistory && (
                <button type="button" className="list-detail__menu-item" onClick={handleShowHistory}>
                  {showHistory ? 'Hide History' : 'View History'}
                </button>
              )}
              <button
                type="button"
                className="list-detail__menu-item list-detail__menu-item--danger"
                onClick={handleDelete}
              >
                Delete List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Routine stats header */}
      {isRoutine && items.length > 0 && (
        <div className="list-detail__routine-stats">
          <span className="list-detail__routine-progress">
            {checkedItems.length}/{items.length} ({completionPct}%)
          </span>
          {list.reset_schedule && (
            <span className="list-detail__routine-schedule">
              Resets {RESET_SCHEDULE_LABELS[list.reset_schedule as ResetSchedule]}
            </span>
          )}
        </div>
      )}

      {/* Auto-reset banner */}
      {resetBanner && (
        <div className="list-detail__reset-banner">
          <RotateCcw size={16} />
          <span>Time to reset this routine.</span>
          <Button onClick={handleReset}>Reset Now</Button>
          <button
            type="button"
            className="list-detail__reset-dismiss"
            onClick={() => setResetBanner(false)}
          >
            Not Now
          </button>
        </div>
      )}

      {shareMessage && (
        <div className="list-detail__toast">{shareMessage}</div>
      )}

      {confirmDelete && (
        <div className="list-detail__confirm-bar">
          <span>Delete this list?</span>
          <Button variant="secondary" onClick={handleDelete}>Confirm</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={uncheckedItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="list-detail__items">
            {uncheckedItems.map((item) => (
              <SortableListItemRow
                key={item.id}
                item={item}
                onToggle={onToggleItem}
                onDelete={onDeleteItem}
                onUpdateNotes={onUpdateItem ? handleUpdateNotes : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {checkedItems.length > 0 && (
        <div className="list-detail__checked-section">
          <span className="list-detail__checked-label">
            Checked ({checkedItems.length})
          </span>
          {checkedItems.map((item) => (
            <div key={item.id} className="list-detail__item-wrapper">
              <div className="list-detail__item-row list-detail__item-row--checked">
                <label className="list-detail__item-check-wrapper">
                  <input
                    type="checkbox"
                    className="list-detail__item-checkbox"
                    checked={item.checked}
                    onChange={() => onToggleItem(item.id)}
                  />
                  <span className="list-detail__item-checkmark" />
                </label>
                <span className="list-detail__item-text list-detail__item-text--checked">
                  {item.text}
                </span>
                <button
                  type="button"
                  className="list-detail__item-delete"
                  onClick={() => onDeleteItem(item.id)}
                  aria-label="Delete item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {item.notes && (
                <div className="list-detail__item-notes list-detail__item-notes--static">
                  <span className="list-detail__notes-display">{item.notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="list-detail__add-item">
        <input
          ref={inputRef}
          type="text"
          className="list-detail__add-input"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item..."
        />
        <Button
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
        >
          Add
        </Button>
      </div>

      {/* History view */}
      {showHistory && routineHistory && (
        <div className="list-detail__history">
          <h3 className="list-detail__history-title">
            <History size={16} /> Completion History
          </h3>
          {routineHistory.length === 0 ? (
            <p className="list-detail__history-empty">No history yet.</p>
          ) : (
            routineHistory.map((h) => (
              <Card key={h.id} className="list-detail__history-card">
                <div className="list-detail__history-header">
                  <span className="list-detail__history-date">
                    {new Date(h.completed_at).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </span>
                  <span className="list-detail__history-score">
                    {h.completed_items}/{h.total_items}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
