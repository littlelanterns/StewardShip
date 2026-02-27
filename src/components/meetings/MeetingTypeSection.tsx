import { useState, useCallback } from 'react';
import { Calendar, Users, BarChart3, Briefcase, Layout, ChevronDown } from 'lucide-react';
import type { MeetingType, MeetingEntryMode, Person, MeetingAgendaItem } from '../../lib/types';
import { MEETING_TYPE_LABELS, MEETING_FREQUENCY_LABELS } from '../../lib/types';
import type { ScheduleWithPerson } from '../../hooks/useMeetings';
import { AgendaItemsList } from './AgendaItemsList';

const TYPE_ICONS: Record<MeetingType, typeof Calendar> = {
  couple: Calendar,
  parent_child: Users,
  weekly_review: BarChart3,
  monthly_review: BarChart3,
  quarterly_inventory: BarChart3,
  business: Briefcase,
  custom: Layout,
};

interface MeetingTypeSectionProps {
  meetingType: MeetingType;
  schedules: ScheduleWithPerson[];
  children?: Person[];
  templateName?: string;
  templateId?: string;
  onStartMeeting: (type: MeetingType, mode: MeetingEntryMode, personId?: string, templateId?: string) => void;
  onViewHistory: (type: MeetingType, personId?: string) => void;
  onSetupSchedule: (type: MeetingType, personId?: string) => void;
  agendaItems: MeetingAgendaItem[];
  onFetchAgendaItems: (meetingType: string, relatedPersonId?: string | null, templateId?: string | null) => Promise<MeetingAgendaItem[]>;
  onAddAgendaItem: (meetingType: string, text: string, relatedPersonId?: string | null, templateId?: string | null, notes?: string | null) => Promise<MeetingAgendaItem | null>;
  onUpdateAgendaItem: (id: string, updates: Partial<Pick<MeetingAgendaItem, 'text' | 'notes'>>) => Promise<void>;
  onDeleteAgendaItem: (id: string) => Promise<void>;
}

export function MeetingTypeSection({
  meetingType,
  schedules,
  children,
  templateName,
  templateId,
  onStartMeeting,
  onViewHistory,
  onSetupSchedule,
  agendaItems,
  onFetchAgendaItems,
  onAddAgendaItem,
  onUpdateAgendaItem,
  onDeleteAgendaItem,
}: MeetingTypeSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = TYPE_ICONS[meetingType] || Layout;

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const typeSchedules = schedules.filter(s => s.meeting_type === meetingType);
  const hasSchedule = typeSchedules.length > 0;

  const label = templateName || MEETING_TYPE_LABELS[meetingType];

  // Count pending agenda items for this meeting type (no person filter for the header badge)
  const pendingCount = agendaItems.filter(i =>
    i.status === 'pending' && i.meeting_type === meetingType
  ).length;

  return (
    <div className="meeting-type-section">
      <div
        className="meeting-type-section__header"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggle(); }}
      >
        <div className="meeting-type-section__icon">
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <h3 className="meeting-type-section__title">
          {label}
          {pendingCount > 0 && (
            <span className="agenda-badge">{pendingCount}</span>
          )}
        </h3>
        <ChevronDown
          size={16}
          className={`meeting-type-section__chevron ${isOpen ? 'meeting-type-section__chevron--open' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="meeting-type-section__body">
          {hasSchedule && typeSchedules.map(s => (
            <p key={s.id} className="meeting-type-section__schedule-info">
              {MEETING_FREQUENCY_LABELS[s.frequency]}
              {s.person_name ? ` with ${s.person_name}` : ''}
              {s.last_completed_date
                ? ` — last met ${new Date(s.last_completed_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : ' — not started yet'}
            </p>
          ))}

          {/* Parent-child: one sub per child */}
          {meetingType === 'parent_child' && children && children.length > 0 ? (
            children.map(child => (
              <div key={child.id} className="meeting-person-sub">
                <p className="meeting-person-sub__name">
                  {child.name}
                  {child.age && <span className="meeting-person-sub__age"> (age {child.age})</span>}
                </p>
                <div className="meeting-type-section__actions">
                  <button
                    type="button"
                    className="upcoming-card__btn upcoming-card__btn--primary"
                    onClick={() => onStartMeeting(meetingType, 'live', child.id)}
                  >
                    Start Meeting
                  </button>
                  <button
                    type="button"
                    className="upcoming-card__btn upcoming-card__btn--secondary"
                    onClick={() => onStartMeeting(meetingType, 'record_after', child.id)}
                  >
                    Record Notes
                  </button>
                  <button
                    type="button"
                    className="meeting-type-section__history-link"
                    onClick={() => onViewHistory(meetingType, child.id)}
                  >
                    View History
                  </button>
                </div>

                <AgendaItemsList
                  meetingType={meetingType}
                  relatedPersonId={child.id}
                  items={agendaItems}
                  onFetchItems={onFetchAgendaItems}
                  onAddItem={onAddAgendaItem}
                  onUpdateItem={onUpdateAgendaItem}
                  onDeleteItem={onDeleteAgendaItem}
                />
              </div>
            ))
          ) : (
            <>
              <div className="meeting-type-section__actions">
                <button
                  type="button"
                  className="upcoming-card__btn upcoming-card__btn--primary"
                  onClick={() => onStartMeeting(meetingType, 'live')}
                >
                  Start Meeting
                </button>
                <button
                  type="button"
                  className="upcoming-card__btn upcoming-card__btn--secondary"
                  onClick={() => onStartMeeting(meetingType, 'record_after')}
                >
                  Record Notes
                </button>
              </div>
              <button
                type="button"
                className="meeting-type-section__history-link"
                onClick={() => onViewHistory(meetingType)}
              >
                View History
              </button>

              <AgendaItemsList
                meetingType={meetingType}
                relatedPersonId={null}
                templateId={templateId}
                items={agendaItems}
                onFetchItems={onFetchAgendaItems}
                onAddItem={onAddAgendaItem}
                onUpdateItem={onUpdateAgendaItem}
                onDeleteItem={onDeleteAgendaItem}
              />
            </>
          )}

          {!hasSchedule && (
            <button
              type="button"
              className="meeting-type-section__history-link"
              onClick={() => onSetupSchedule(meetingType)}
              style={{ marginTop: '0.5rem', display: 'block' }}
            >
              Set up a schedule
            </button>
          )}
        </div>
      )}
    </div>
  );
}
