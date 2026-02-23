import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../shared/Button';
import type { ListType, ListAiAction } from '../../../lib/types';
import { LIST_TYPE_LABELS, LIST_AI_ACTION_LABELS } from '../../../lib/types';
import './CreateListModal.css';

interface CreateListModalProps {
  onSave: (data: { title: string; list_type: ListType; ai_action: ListAiAction }) => Promise<unknown>;
  onBack: () => void;
}

const LIST_TYPES: ListType[] = ['shopping', 'wishlist', 'expenses', 'todo', 'custom'];
const AI_ACTIONS: ListAiAction[] = ['store_only', 'remind', 'schedule', 'prioritize'];

export default function CreateListModal({ onSave, onBack }: CreateListModalProps) {
  const [title, setTitle] = useState('');
  const [listType, setListType] = useState<ListType>('todo');
  const [aiAction, setAiAction] = useState<ListAiAction>('store_only');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onSave({ title: title.trim(), list_type: listType, ai_action: aiAction });
    setSaving(false);
  };

  return (
    <div className="create-list">
      <div className="create-list__top-bar">
        <button type="button" className="create-list__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="create-list__top-title">New List</span>
      </div>

      <div className="create-list__form">
        <div className="create-list__field">
          <label className="create-list__label">Title</label>
          <input
            type="text"
            className="create-list__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="List name..."
            autoFocus
          />
        </div>

        <div className="create-list__field">
          <label className="create-list__label">Type</label>
          <div className="create-list__option-row">
            {LIST_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`create-list__option-btn ${listType === type ? 'create-list__option-btn--active' : ''}`}
                onClick={() => setListType(type)}
              >
                {LIST_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="create-list__field">
          <label className="create-list__label">What should I do with this?</label>
          <div className="create-list__option-row create-list__option-row--wrap">
            {AI_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                className={`create-list__option-btn ${aiAction === action ? 'create-list__option-btn--active' : ''}`}
                onClick={() => setAiAction(action)}
              >
                {LIST_AI_ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={!title.trim() || saving}>
        {saving ? 'Creating...' : 'Create List'}
      </Button>
    </div>
  );
}
