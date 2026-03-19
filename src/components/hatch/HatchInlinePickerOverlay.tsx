import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../shared';
import type { HatchRoutingDestination, MastEntryType, KeelCategory, JournalEntryType, MeetingType } from '../../lib/types';
import { MAST_TYPE_LABELS, KEEL_CATEGORY_LABELS, MEETING_TYPE_LABELS } from '../../lib/types';
import './HatchInlinePickerOverlay.css';

interface HatchInlinePickerOverlayProps {
  destination: HatchRoutingDestination;
  onRoute: (
    destination: HatchRoutingDestination,
    options: {
      mastType?: MastEntryType;
      keelCategory?: KeelCategory;
      journalEntryType?: JournalEntryType;
      meetingId?: string;
      meetingType?: string;
      relatedPersonId?: string;
      trackerId?: string;
    },
  ) => Promise<void>;
  onBack: () => void;
}

interface PickerItem {
  id: string;
  label: string;
}

// Meeting types that need a person picker
const PERSON_MEETING_TYPES: MeetingType[] = ['couple', 'parent_child', 'mentor'];

// Agenda meeting type options (exclude quarterly_inventory — not a standalone meeting)
const AGENDA_MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: 'couple', label: 'Couple Meeting' },
  { value: 'parent_child', label: 'Parent-Child Meeting' },
  { value: 'family_council', label: 'Family Council' },
  { value: 'mentor', label: 'Mentor Meeting' },
  { value: 'weekly_review', label: 'Weekly Review' },
  { value: 'monthly_review', label: 'Monthly Review' },
  { value: 'business', label: 'Business Review' },
  { value: 'custom', label: 'Custom Meeting' },
];

export default function HatchInlinePickerOverlay({
  destination,
  onRoute,
  onBack,
}: HatchInlinePickerOverlayProps) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCommonplaceTooltip, setShowCommonplaceTooltip] = useState(false);

  // Agenda: meeting type + person picker state
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | null>(null);
  const [agendaPeople, setAgendaPeople] = useState<PickerItem[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  // Load data for charts picker
  useEffect(() => {
    if (!user) return;
    if (destination === 'charts') {
      loadTrackers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, destination]);

  const loadTrackers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, title')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setItems((data || []).map((g: { id: string; title: string }) => ({ id: g.id, label: g.title })));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load people for meeting types that need them
  const loadPeopleForType = useCallback(async (meetingType: MeetingType) => {
    if (!user) return;
    setLoadingPeople(true);
    try {
      let query = supabase
        .from('people')
        .select('id, name')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .neq('hidden_from_meetings', true)
        .order('name');

      // Filter by relationship type based on meeting type
      if (meetingType === 'couple') {
        query = query.eq('is_first_mate', true);
      } else if (meetingType === 'parent_child') {
        query = query.in('relationship_type', ['child', 'stepchild']);
      } else if (meetingType === 'mentor') {
        query = query.in('relationship_type', ['mentor', 'teacher', 'coach', 'spiritual_leader']);
      }

      const { data, error } = await query.limit(30);
      if (error) throw error;
      setAgendaPeople((data || []).map((p: { id: string; name: string }) => ({ id: p.id, label: p.name })));
    } catch {
      setAgendaPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  }, [user]);

  // Agenda: select meeting type
  const handleAgendaTypeSelect = useCallback((meetingType: MeetingType) => {
    if (PERSON_MEETING_TYPES.includes(meetingType)) {
      setSelectedMeetingType(meetingType);
      loadPeopleForType(meetingType);
    } else {
      // No person needed — route directly
      onRoute('agenda', { meetingType });
    }
  }, [onRoute, loadPeopleForType]);

  // Agenda: select person for the chosen meeting type
  const handleAgendaPersonSelect = useCallback((personId: string) => {
    if (!selectedMeetingType) return;
    onRoute('agenda', { meetingType: selectedMeetingType, relatedPersonId: personId });
  }, [onRoute, selectedMeetingType]);

  // Agenda: route without person (for types that need one but user wants general)
  const handleAgendaNoPersonRoute = useCallback(() => {
    if (!selectedMeetingType) return;
    onRoute('agenda', { meetingType: selectedMeetingType });
  }, [onRoute, selectedMeetingType]);

  const handleTrackerSelect = useCallback(
    (trackerId: string) => {
      onRoute('charts', { trackerId });
    },
    [onRoute],
  );

  const getTitle = () => {
    switch (destination) {
      case 'mast': return 'Save to The Mast';
      case 'keel': return 'Save to The Keel';
      case 'journal': return 'Save to Journal';
      case 'agenda': return 'Add to Agenda';
      case 'charts': return 'Track Progress';
      default: return 'Select';
    }
  };

  return (
    <div className="hatch-picker">
      <div className="hatch-picker__header">
        <button
          type="button"
          className="hatch-picker__back"
          onClick={selectedMeetingType ? () => { setSelectedMeetingType(null); setAgendaPeople([]); } : onBack}
          aria-label={selectedMeetingType ? 'Back to meeting types' : 'Back to destinations'}
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <h4 className="hatch-picker__title">
          {selectedMeetingType
            ? `${MEETING_TYPE_LABELS[selectedMeetingType]} — Who with?`
            : getTitle()
          }
        </h4>
      </div>

      {/* Mast type picker */}
      {destination === 'mast' && (
        <div className="hatch-picker__options">
          {(Object.keys(MAST_TYPE_LABELS) as MastEntryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className="hatch-picker__option"
              onClick={() => onRoute('mast', { mastType: type })}
            >
              {MAST_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {/* Keel category picker */}
      {destination === 'keel' && (
        <div className="hatch-picker__options">
          {(Object.keys(KEEL_CATEGORY_LABELS) as KeelCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className="hatch-picker__option"
              onClick={() => onRoute('keel', { keelCategory: cat })}
            >
              {KEEL_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Journal entry type picker */}
      {destination === 'journal' && (
        <div className="hatch-picker__options">
          {([
            ['journal_entry', 'Journal Entry'],
            ['reflection', 'Reflection'],
            ['gratitude', 'Gratitude'],
            ['quick_note', 'Quick Note'],
            ['commonplace', 'Commonplace'],
            ['kid_quips', 'Kid Quips'],
            ['custom', 'Custom'],
          ] as [JournalEntryType, string][]).map(([type, label]) => (
            <div key={type} style={{ position: 'relative' }}>
              <button
                type="button"
                className="hatch-picker__option"
                onClick={() => onRoute('journal', { journalEntryType: type })}
                onMouseEnter={() => type === 'commonplace' && setShowCommonplaceTooltip(true)}
                onMouseLeave={() => type === 'commonplace' && setShowCommonplaceTooltip(false)}
              >
                {label}
              </button>
              {type === 'commonplace' && showCommonplaceTooltip && (
                <div className="hatch-picker__tooltip">
                  A centuries-old practice of collecting quotes, observations, and passages that resonate with you.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meeting type picker for agenda — Step 1: Select meeting type */}
      {destination === 'agenda' && !selectedMeetingType && (
        <div className="hatch-picker__options">
          <p className="hatch-picker__hint">What kind of meeting is this for?</p>
          {AGENDA_MEETING_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="hatch-picker__option"
              onClick={() => handleAgendaTypeSelect(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Meeting type picker for agenda — Step 2: Select person (for types that need one) */}
      {destination === 'agenda' && selectedMeetingType && (
        loadingPeople ? (
          <div className="hatch-picker__loading"><LoadingSpinner /></div>
        ) : (
          <div className="hatch-picker__options">
            {agendaPeople.length > 0 ? (
              agendaPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="hatch-picker__option"
                  onClick={() => handleAgendaPersonSelect(person.id)}
                >
                  {person.label}
                </button>
              ))
            ) : (
              <p className="hatch-picker__hint">
                No matching people found in your Crew.
              </p>
            )}
            <button
              type="button"
              className="hatch-picker__option"
              style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}
              onClick={handleAgendaNoPersonRoute}
            >
              Save without a person
            </button>
          </div>
        )
      )}

      {/* Tracker picker for charts */}
      {destination === 'charts' && (
        loading ? (
          <div className="hatch-picker__loading"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="hatch-picker__empty">No trackers found. Create one from the Charts page.</p>
        ) : (
          <div className="hatch-picker__options">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hatch-picker__option"
                onClick={() => handleTrackerSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
