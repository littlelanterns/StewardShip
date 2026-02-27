import { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, Plus } from 'lucide-react';
import type { MeetingAgendaItem } from '../../lib/types';

interface AgendaItemsListProps {
  meetingType: string;
  relatedPersonId?: string | null;
  templateId?: string | null;
  items: MeetingAgendaItem[];
  onFetchItems: (meetingType: string, relatedPersonId?: string | null, templateId?: string | null) => Promise<MeetingAgendaItem[]>;
  onAddItem: (meetingType: string, text: string, relatedPersonId?: string | null, templateId?: string | null, notes?: string | null) => Promise<MeetingAgendaItem | null>;
  onUpdateItem: (id: string, updates: Partial<Pick<MeetingAgendaItem, 'text' | 'notes'>>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export function AgendaItemsList({
  meetingType,
  relatedPersonId,
  templateId,
  items,
  onFetchItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: AgendaItemsListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [fetched, setFetched] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Fetch items on first render
  useEffect(() => {
    if (!fetched) {
      onFetchItems(meetingType, relatedPersonId, templateId);
      setFetched(true);
    }
  }, [fetched, meetingType, relatedPersonId, templateId, onFetchItems]);

  const handleAdd = useCallback(async () => {
    const text = addText.trim();
    if (!text) return;
    await onAddItem(meetingType, text, relatedPersonId, templateId);
    setAddText('');
    addInputRef.current?.focus();
  }, [addText, meetingType, relatedPersonId, templateId, onAddItem]);

  const handleAddKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setShowAdd(false);
      setAddText('');
    }
  }, [handleAdd]);

  const startEdit = useCallback((item: MeetingAgendaItem) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditNotes(item.notes || '');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;
    const notes = editNotes.trim() || null;
    await onUpdateItem(editingId, { text, notes });
    setEditingId(null);
  }, [editingId, editText, editNotes, onUpdateItem]);

  const pendingItems = items.filter(i => i.status === 'pending');

  return (
    <div className="agenda-items">
      {pendingItems.length > 0 && (
        <div className="agenda-items__list">
          {pendingItems.map(item => (
            <div key={item.id} className="agenda-items__item">
              {editingId === item.id ? (
                <div className="agenda-items__edit">
                  <input
                    type="text"
                    className="agenda-items__edit-input"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="agenda-items__edit-notes"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                    placeholder="Notes (optional)"
                  />
                  <div className="agenda-items__edit-actions">
                    <button type="button" className="agenda-items__save-btn" onClick={saveEdit}>Save</button>
                    <button type="button" className="agenda-items__cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="agenda-items__item-row">
                  <button
                    type="button"
                    className="agenda-items__item-text"
                    onClick={() => startEdit(item)}
                    title="Click to edit"
                  >
                    {item.text}
                  </button>
                  {item.notes && (
                    <span className="agenda-items__notes-icon" title={item.notes}>
                      <FileText size={12} />
                    </span>
                  )}
                  <button
                    type="button"
                    className="agenda-items__delete-btn"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="agenda-items__add-form">
          <input
            ref={addInputRef}
            type="text"
            className="agenda-items__add-input"
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="What to discuss..."
            autoFocus
          />
          <button
            type="button"
            className="agenda-items__add-confirm"
            onClick={handleAdd}
            disabled={!addText.trim()}
          >
            Add
          </button>
          <button
            type="button"
            className="agenda-items__add-cancel"
            onClick={() => { setShowAdd(false); setAddText(''); }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="agenda-items__add-btn"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} />
          Add to Agenda
        </button>
      )}
    </div>
  );
}
