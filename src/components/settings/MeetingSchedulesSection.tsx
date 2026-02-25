import { useState, useEffect, useCallback } from 'react';
import { Button } from '../shared';
import { MeetingScheduleEditor } from '../meetings/MeetingScheduleEditor';
import { useMeetings, type ScheduleWithPerson } from '../../hooks/useMeetings';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import {
  MEETING_TYPE_LABELS,
  MEETING_FREQUENCY_LABELS,
  MEETING_NOTIFICATION_LABELS,
} from '../../lib/types';
import type { Person } from '../../lib/types';

export function MeetingSchedulesSection() {
  const { user } = useAuthContext();
  const {
    schedules,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useMeetings();
  const [people, setPeople] = useState<Person[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    fetchSchedules();
    setLoaded(true);
  }, [fetchSchedules, loaded]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('people')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('name')
      .then(({ data }) => {
        if (data) setPeople(data as Person[]);
      });
  }, [user]);

  const handleToggleActive = useCallback((schedule: ScheduleWithPerson) => {
    updateSchedule(schedule.id, { is_active: !schedule.is_active });
  }, [updateSchedule]);

  const handleDelete = useCallback((id: string) => {
    deleteSchedule(id);
  }, [deleteSchedule]);

  const handleSaveNew = useCallback(async (data: Parameters<typeof createSchedule>[0]) => {
    await createSchedule(data);
    setShowEditor(false);
  }, [createSchedule]);

  return (
    <div className="settings-section__body">
      {schedules.length === 0 && !showEditor && (
        <p className="settings-section__empty">No meeting schedules set up yet.</p>
      )}

      {schedules.length > 0 && (
        <div className="settings-schedules-list">
          {schedules.map(schedule => (
            <div key={schedule.id} className={`settings-schedule-card ${!schedule.is_active ? 'settings-schedule-card--paused' : ''}`}>
              <div className="settings-schedule-card__info">
                <span className="settings-schedule-card__type">
                  {MEETING_TYPE_LABELS[schedule.meeting_type]}
                </span>
                {schedule.person_name && (
                  <span className="settings-schedule-card__person">
                    with {schedule.person_name}
                  </span>
                )}
                <span className="settings-schedule-card__freq">
                  {MEETING_FREQUENCY_LABELS[schedule.frequency]}
                  {schedule.preferred_day && ` on ${schedule.preferred_day.charAt(0).toUpperCase() + schedule.preferred_day.slice(1)}s`}
                  {schedule.preferred_time && ` at ${schedule.preferred_time}`}
                </span>
                <span className="settings-schedule-card__notify">
                  Reminder: {MEETING_NOTIFICATION_LABELS[schedule.notification_type]}
                </span>
                {!schedule.is_active && (
                  <span className="settings-badge settings-badge--neutral">Paused</span>
                )}
              </div>
              <div className="settings-schedule-card__actions">
                <Button variant="secondary" onClick={() => handleToggleActive(schedule)}>
                  {schedule.is_active ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="secondary" className="settings-btn--danger-text" onClick={() => handleDelete(schedule.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor ? (
        <MeetingScheduleEditor
          people={people}
          onSave={handleSaveNew}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setShowEditor(true)}>
          Add Meeting Schedule
        </Button>
      )}
    </div>
  );
}
