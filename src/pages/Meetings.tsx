import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useHelmContext } from '../contexts/HelmContext';
import { useMeetings } from '../hooks/useMeetings';
import type { ScheduleWithPerson } from '../hooks/useMeetings';
import { EmptyState, FloatingActionButton, LoadingSpinner } from '../components/shared';
import { UpcomingMeetings } from '../components/meetings/UpcomingMeetings';
import { MeetingTypeSection } from '../components/meetings/MeetingTypeSection';
import { MeetingHistory } from '../components/meetings/MeetingHistory';
import { MeetingScheduleEditor } from '../components/meetings/MeetingScheduleEditor';
import { CustomTemplateCreator } from '../components/meetings/CustomTemplateCreator';
import { CustomTemplateEditor } from '../components/meetings/CustomTemplateEditor';
import { supabase } from '../lib/supabase';
import type {
  MeetingType,
  MeetingEntryMode,
  Person,
  GuidedSubtype,
} from '../lib/types';
import '../components/meetings/Meetings.css';

type ViewMode = 'main' | 'history' | 'schedule' | 'template-create' | 'template-edit';

interface HistoryView {
  type: MeetingType;
  personId?: string;
  personName?: string;
}

export default function Meetings() {
  usePageContext({ page: 'meetings' });
  const { user, profile } = useAuthContext();
  const { startGuidedConversation } = useHelmContext();
  const {
    schedules,
    templates,
    loading,
    fetchSchedules,
    fetchTemplates,
    fetchUpcomingMeetings,
    createMeeting,
    createSchedule,
    createTemplate,
    skipMeeting,
    deleteSchedule,
  } = useMeetings();

  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleWithPerson[]>([]);
  const [historyView, setHistoryView] = useState<HistoryView | null>(null);
  const [scheduleType, setScheduleType] = useState<MeetingType | undefined>();
  const [schedulePersonId, setSchedulePersonId] = useState<string | undefined>();
  const [people, setPeople] = useState<Person[]>([]);
  const [children, setChildren] = useState<Person[]>([]);

  const isMarriedOrDating = profile?.relationship_status === 'married' || profile?.relationship_status === 'dating';

  // Load initial data
  useEffect(() => {
    if (!user) return;
    fetchSchedules();
    fetchTemplates();
    fetchUpcomingMeetings().then(setUpcomingSchedules);

    // Load people for schedule editor and type sections
    supabase
      .from('people')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('name')
      .then(({ data }) => {
        const allPeople = (data || []) as Person[];
        setPeople(allPeople);
        setChildren(allPeople.filter(p => p.relationship_type === 'child'));
      });
  }, [user, fetchSchedules, fetchTemplates, fetchUpcomingMeetings]);

  // Start a meeting at the Helm
  const handleStartMeeting = useCallback(async (
    type: MeetingType,
    mode: MeetingEntryMode,
    personId?: string,
    templateId?: string,
  ) => {
    const meeting = await createMeeting({
      meeting_type: type,
      entry_mode: mode,
      related_person_id: personId,
      template_id: templateId,
    });
    if (!meeting) return;

    const subtype = type as unknown as GuidedSubtype;
    await startGuidedConversation('meeting', subtype, meeting.id);
  }, [createMeeting, startGuidedConversation]);

  const handleStartFromSchedule = useCallback(async (
    schedule: ScheduleWithPerson,
    mode: MeetingEntryMode,
  ) => {
    await handleStartMeeting(
      schedule.meeting_type,
      mode,
      schedule.related_person_id || undefined,
      schedule.template_id || undefined,
    );
  }, [handleStartMeeting]);

  const handleSkip = useCallback(async (scheduleId: string) => {
    await skipMeeting(scheduleId);
    const updated = await fetchUpcomingMeetings();
    setUpcomingSchedules(updated);
  }, [skipMeeting, fetchUpcomingMeetings]);

  const handleViewHistory = useCallback((type: MeetingType, personId?: string) => {
    const person = personId ? people.find(p => p.id === personId) : undefined;
    setHistoryView({ type, personId, personName: person?.name });
    setViewMode('history');
  }, [people]);

  const handleSetupSchedule = useCallback((type: MeetingType, personId?: string) => {
    setScheduleType(type);
    setSchedulePersonId(personId);
    setViewMode('schedule');
  }, []);

  const handleSaveSchedule = useCallback(async (data: Parameters<typeof createSchedule>[0]) => {
    await createSchedule(data);
    const updated = await fetchUpcomingMeetings();
    setUpcomingSchedules(updated);
    setViewMode('main');
  }, [createSchedule, fetchUpcomingMeetings]);

  const handleCreateWithAI = useCallback(async () => {
    await startGuidedConversation('meeting', 'template_creation' as GuidedSubtype);
  }, [startGuidedConversation]);

  const handleSaveTemplate = useCallback(async (data: Parameters<typeof createTemplate>[0]) => {
    await createTemplate({ ...data, source: 'manual' });
    setViewMode('main');
  }, [createTemplate]);

  // FAB actions
  const handleFabPress = useCallback(() => {
    setViewMode('template-create');
  }, []);

  // Sub-views
  if (viewMode === 'history' && historyView) {
    return (
      <div className="page meetings-page">
        <MeetingHistory
          meetingType={historyView.type}
          personId={historyView.personId}
          personName={historyView.personName}
          onBack={() => setViewMode('main')}
        />
      </div>
    );
  }

  if (viewMode === 'schedule') {
    return (
      <div className="page meetings-page">
        <MeetingScheduleEditor
          meetingType={scheduleType}
          personId={schedulePersonId}
          people={people}
          onSave={handleSaveSchedule}
          onCancel={() => setViewMode('main')}
        />
      </div>
    );
  }

  if (viewMode === 'template-create') {
    return (
      <div className="page meetings-page">
        <CustomTemplateCreator
          onCreateWithAI={handleCreateWithAI}
          onWriteMyself={() => setViewMode('template-edit')}
        />
      </div>
    );
  }

  if (viewMode === 'template-edit') {
    return (
      <div className="page meetings-page">
        <CustomTemplateEditor
          onSave={handleSaveTemplate}
          onCancel={() => setViewMode('main')}
        />
      </div>
    );
  }

  // Determine which sections to show
  const hasBusinessSchedules = schedules.some(s => s.meeting_type === 'business');

  if (loading && schedules.length === 0) {
    return (
      <div className="page meetings-page">
        <LoadingSpinner />
      </div>
    );
  }

  const hasAnyContent = upcomingSchedules.length > 0 || schedules.length > 0 || templates.length > 0;

  return (
    <div className="page meetings-page">
      <div className="meetings-page__header">
        <h1 className="meetings-page__title">Meeting Frameworks</h1>
        <p className="meetings-page__subtitle">
          Structured conversations with follow-through
        </p>
      </div>

      {/* Upcoming Meetings */}
      <UpcomingMeetings
        schedules={upcomingSchedules}
        onStartMeeting={handleStartFromSchedule}
        onSkip={handleSkip}
      />

      {/* Meeting Type Sections */}
      {isMarriedOrDating && (
        <MeetingTypeSection
          meetingType="couple"
          schedules={schedules}
          onStartMeeting={handleStartMeeting}
          onViewHistory={handleViewHistory}
          onSetupSchedule={handleSetupSchedule}
        />
      )}

      {children.length > 0 && (
        <MeetingTypeSection
          meetingType="parent_child"
          schedules={schedules}
          children={children}
          onStartMeeting={handleStartMeeting}
          onViewHistory={handleViewHistory}
          onSetupSchedule={handleSetupSchedule}
        />
      )}

      <MeetingTypeSection
        meetingType="weekly_review"
        schedules={schedules}
        onStartMeeting={handleStartMeeting}
        onViewHistory={handleViewHistory}
        onSetupSchedule={handleSetupSchedule}
      />

      <MeetingTypeSection
        meetingType="monthly_review"
        schedules={schedules}
        onStartMeeting={handleStartMeeting}
        onViewHistory={handleViewHistory}
        onSetupSchedule={handleSetupSchedule}
      />

      {hasBusinessSchedules && (
        <MeetingTypeSection
          meetingType="business"
          schedules={schedules}
          onStartMeeting={handleStartMeeting}
          onViewHistory={handleViewHistory}
          onSetupSchedule={handleSetupSchedule}
        />
      )}

      {/* Custom Templates */}
      {templates.map(template => (
        <MeetingTypeSection
          key={template.id}
          meetingType="custom"
          schedules={schedules.filter(s => s.template_id === template.id)}
          templateName={template.name}
          onStartMeeting={(type, mode) => handleStartMeeting(type, mode, undefined, template.id)}
          onViewHistory={() => handleViewHistory('custom')}
          onSetupSchedule={() => handleSetupSchedule('custom')}
        />
      ))}

      {!hasAnyContent && (
        <EmptyState
          heading="No meetings set up yet"
          message="Set up recurring meetings or start an ad hoc session. Couple meetings, parent-child mentoring, personal reviews, and business reviews — all guided by AI."
        />
      )}

      {/* Schedule Management */}
      {schedules.length > 0 && (
        <div className="schedule-list">
          <h3 className="schedule-list__title">Active Schedules</h3>
          {schedules.filter(s => s.is_active).map(schedule => (
            <div key={schedule.id} className="schedule-item">
              <div className="schedule-item__info">
                <div className="schedule-item__type">
                  {schedule.person_name
                    ? `${schedule.person_name} — ${schedule.meeting_type.replace(/_/g, ' ')}`
                    : schedule.meeting_type.replace(/_/g, ' ')}
                </div>
                <div className="schedule-item__detail">
                  {schedule.frequency}
                  {schedule.next_due_date && ` — next: ${new Date(schedule.next_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
              </div>
              <div className="schedule-item__actions">
                <button
                  type="button"
                  className="schedule-item__btn schedule-item__btn--delete"
                  onClick={() => deleteSchedule(schedule.id)}
                  aria-label="Delete schedule"
                  title="Remove schedule"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="upcoming-card__btn upcoming-card__btn--secondary"
          onClick={() => handleSetupSchedule(undefined as unknown as MeetingType)}
        >
          + Add Schedule
        </button>
      </div>

      <FloatingActionButton
        icon={<Plus size={24} />}
        onPress={handleFabPress}
        label="Create Custom Meeting"
      />
    </div>
  );
}
