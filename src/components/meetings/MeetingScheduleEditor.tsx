import { useState, useCallback } from 'react';
import { Button } from '../shared';
import type {
  MeetingType,
  MeetingFrequency,
  DayOfWeek,
  MeetingNotificationType,
  Person,
} from '../../lib/types';
import {
  MEETING_TYPE_LABELS,
  MEETING_FREQUENCY_LABELS,
  DAY_OF_WEEK_LABELS,
  MEETING_NOTIFICATION_LABELS,
} from '../../lib/types';

interface MeetingScheduleEditorProps {
  meetingType?: MeetingType;
  personId?: string;
  people: Person[];
  onSave: (data: {
    meeting_type: MeetingType;
    related_person_id?: string;
    custom_title?: string;
    frequency: MeetingFrequency;
    custom_interval_days?: number;
    preferred_day?: DayOfWeek;
    preferred_time?: string;
    notification_type?: MeetingNotificationType;
  }) => Promise<void>;
  onCancel: () => void;
}

export function MeetingScheduleEditor({
  meetingType: initialType,
  personId: initialPersonId,
  people,
  onSave,
  onCancel,
}: MeetingScheduleEditorProps) {
  const [meetingType, setMeetingType] = useState<MeetingType>(initialType || 'weekly_review');
  const [personId, setPersonId] = useState<string>(initialPersonId || '');
  const [frequency, setFrequency] = useState<MeetingFrequency>('weekly');
  const [customDays, setCustomDays] = useState<string>('7');
  const [preferredDay, setPreferredDay] = useState<DayOfWeek | ''>('');
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [notificationType, setNotificationType] = useState<MeetingNotificationType>('reveille');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        meeting_type: meetingType,
        related_person_id: personId || undefined,
        custom_title: customTitle || undefined,
        frequency,
        custom_interval_days: frequency === 'custom' ? parseInt(customDays, 10) || 7 : undefined,
        preferred_day: preferredDay || undefined,
        preferred_time: preferredTime || undefined,
        notification_type: notificationType,
      });
    } finally {
      setSaving(false);
    }
  }, [meetingType, personId, customTitle, frequency, customDays, preferredDay, preferredTime, notificationType, onSave]);

  const showPersonField = meetingType === 'couple' || meetingType === 'parent_child' || meetingType === 'mentor';

  return (
    <div className="schedule-editor">
      <h3 className="schedule-editor__title">Set Up Schedule</h3>

      {!initialType && (
        <div className="schedule-editor__field">
          <label className="schedule-editor__label">Meeting Type</label>
          <select
            className="schedule-editor__select"
            value={meetingType}
            onChange={e => setMeetingType(e.target.value as MeetingType)}
          >
            {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {meetingType === 'mentor' && (
        <div className="schedule-editor__field">
          <label className="schedule-editor__label">Meeting Title</label>
          <input
            type="text"
            className="schedule-editor__input"
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder="e.g., Piano Lesson with Mrs. Johnson"
          />
        </div>
      )}

      {showPersonField && (
        <div className="schedule-editor__field">
          <label className="schedule-editor__label">
            {meetingType === 'mentor' ? 'Mentor (optional)' : 'Person'}
          </label>
          <select
            className="schedule-editor__select"
            value={personId}
            onChange={e => setPersonId(e.target.value)}
          >
            <option value="">{meetingType === 'mentor' ? 'Select a mentor' : 'Select a person'}</option>
            {people
              .filter(p => meetingType !== 'mentor' || ['mentor', 'teacher', 'coach', 'spiritual_leader'].includes(p.relationship_type))
              .map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.relationship_type.replace(/_/g, ' ')})</option>
              ))}
          </select>
        </div>
      )}

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Frequency</label>
        <select
          className="schedule-editor__select"
          value={frequency}
          onChange={e => setFrequency(e.target.value as MeetingFrequency)}
        >
          {Object.entries(MEETING_FREQUENCY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {frequency === 'custom' && (
        <div className="schedule-editor__field">
          <label className="schedule-editor__label">Every X days</label>
          <input
            type="number"
            className="schedule-editor__input"
            value={customDays}
            onChange={e => setCustomDays(e.target.value)}
            min="1"
            max="365"
          />
        </div>
      )}

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Preferred Day (optional)</label>
        <select
          className="schedule-editor__select"
          value={preferredDay}
          onChange={e => setPreferredDay(e.target.value as DayOfWeek | '')}
        >
          <option value="">No preference</option>
          {Object.entries(DAY_OF_WEEK_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Preferred Time (optional)</label>
        <input
          type="time"
          className="schedule-editor__input"
          value={preferredTime}
          onChange={e => setPreferredTime(e.target.value)}
        />
      </div>

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Reminder</label>
        <select
          className="schedule-editor__select"
          value={notificationType}
          onChange={e => setNotificationType(e.target.value as MeetingNotificationType)}
        >
          {Object.entries(MEETING_NOTIFICATION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="schedule-editor__actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
}
