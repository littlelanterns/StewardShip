import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../shared/Button';
import type { ReminderEntityType } from '../../lib/types';
import './Reminders.css';

interface CustomReminderModalProps {
  prefillTitle?: string;
  relatedEntityType?: ReminderEntityType;
  relatedEntityId?: string;
  onSave: (data: {
    title: string;
    body?: string;
    scheduledAt?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function CustomReminderModal({
  prefillTitle = '',
  relatedEntityType: _relatedEntityType,
  relatedEntityId: _relatedEntityId,
  onSave,
  onClose,
}: CustomReminderModalProps) {
  const [title, setTitle] = useState(prefillTitle);
  const [body, setBody] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    let scheduledAt: string | undefined;
    if (scheduledDate) {
      const time = scheduledTime || '09:00';
      scheduledAt = new Date(`${scheduledDate}T${time}:00`).toISOString();
    }

    await onSave({
      title: title.trim(),
      body: body.trim() || undefined,
      scheduledAt,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="custom-reminder-overlay" onClick={onClose}>
      <div className="custom-reminder-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="custom-reminder-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h3 className="custom-reminder-modal__title">Set a Reminder</h3>

        <div className="custom-reminder-modal__field">
          <label className="custom-reminder-modal__label">What to remember</label>
          <input
            type="text"
            className="custom-reminder-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reminder title"
            autoFocus
          />
        </div>

        <div className="custom-reminder-modal__field">
          <label className="custom-reminder-modal__label">Notes (optional)</label>
          <textarea
            className="custom-reminder-modal__textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Additional details..."
            rows={2}
          />
        </div>

        <div className="custom-reminder-modal__field">
          <label className="custom-reminder-modal__label">When (optional — default: next morning)</label>
          <div className="custom-reminder-modal__datetime">
            <input
              type="date"
              className="custom-reminder-modal__input custom-reminder-modal__input--date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            {scheduledDate && (
              <input
                type="time"
                className="custom-reminder-modal__input custom-reminder-modal__input--time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="custom-reminder-modal__actions">
          <Button variant="text" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : 'Save Reminder'}
          </Button>
        </div>
      </div>
    </div>
  );
}
