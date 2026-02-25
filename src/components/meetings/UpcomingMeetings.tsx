import { useCallback } from 'react';
import { Calendar, Users, BarChart3, Briefcase, Layout } from 'lucide-react';
import type { MeetingType, MeetingEntryMode } from '../../lib/types';
import { MEETING_TYPE_LABELS } from '../../lib/types';
import type { ScheduleWithPerson } from '../../hooks/useMeetings';

const TYPE_ICONS: Record<MeetingType, typeof Calendar> = {
  couple: Calendar,
  parent_child: Users,
  weekly_review: BarChart3,
  monthly_review: BarChart3,
  quarterly_inventory: BarChart3,
  business: Briefcase,
  custom: Layout,
};

interface UpcomingMeetingsProps {
  schedules: ScheduleWithPerson[];
  onStartMeeting: (schedule: ScheduleWithPerson, mode: MeetingEntryMode) => void;
  onSkip: (scheduleId: string) => void;
}

export function UpcomingMeetings({ schedules, onStartMeeting, onSkip }: UpcomingMeetingsProps) {
  const today = new Date().toISOString().split('T')[0];

  const getStatus = useCallback((nextDue: string | null) => {
    if (!nextDue) return 'no-schedule';
    if (nextDue < today) return 'overdue';
    if (nextDue === today) return 'due-today';
    return 'upcoming';
  }, [today]);

  const getDaysSince = useCallback((lastDate: string | null) => {
    if (!lastDate) return null;
    const diff = Math.floor(
      (new Date().getTime() - new Date(lastDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }, []);

  if (schedules.length === 0) return null;

  return (
    <div className="upcoming-meetings">
      <h2 className="upcoming-meetings__title">Upcoming</h2>
      {schedules.map(schedule => {
        const status = getStatus(schedule.next_due_date);
        const daysSince = getDaysSince(schedule.last_completed_date);
        const Icon = TYPE_ICONS[schedule.meeting_type] || Layout;

        return (
          <div
            key={schedule.id}
            className={`upcoming-card ${status === 'overdue' ? 'upcoming-card--overdue' : ''} ${status === 'due-today' ? 'upcoming-card--due-today' : ''}`}
          >
            <div className="upcoming-card__icon">
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <div className="upcoming-card__content">
              <p className="upcoming-card__name">
                {MEETING_TYPE_LABELS[schedule.meeting_type]}
              </p>
              {schedule.person_name && (
                <p className="upcoming-card__person">with {schedule.person_name}</p>
              )}
              <p className="upcoming-card__meta">
                {status === 'overdue' && daysSince !== null && (
                  <>Last met: {daysSince} day{daysSince !== 1 ? 's' : ''} ago</>
                )}
                {status === 'due-today' && 'Due today'}
                {status === 'upcoming' && schedule.next_due_date && (
                  <>Due {new Date(schedule.next_due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</>
                )}
                {!schedule.last_completed_date && status === 'overdue' && 'Not yet started'}
              </p>
              <div className="upcoming-card__actions">
                <button
                  type="button"
                  className="upcoming-card__btn upcoming-card__btn--primary"
                  onClick={() => onStartMeeting(schedule, 'live')}
                >
                  Start Meeting
                </button>
                <button
                  type="button"
                  className="upcoming-card__btn upcoming-card__btn--secondary"
                  onClick={() => onStartMeeting(schedule, 'record_after')}
                >
                  Record Notes
                </button>
                <button
                  type="button"
                  className="upcoming-card__btn upcoming-card__btn--skip"
                  onClick={() => onSkip(schedule.id)}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
