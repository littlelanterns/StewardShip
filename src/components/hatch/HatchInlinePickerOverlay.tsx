import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../shared';
import type { HatchRoutingDestination, MastEntryType, KeelCategory } from '../../lib/types';
import { MAST_TYPE_LABELS, KEEL_CATEGORY_LABELS } from '../../lib/types';
import './HatchInlinePickerOverlay.css';

interface HatchInlinePickerOverlayProps {
  destination: HatchRoutingDestination;
  onRoute: (
    destination: HatchRoutingDestination,
    options: {
      mastType?: MastEntryType;
      keelCategory?: KeelCategory;
      meetingId?: string;
      trackerId?: string;
    },
  ) => Promise<void>;
  onBack: () => void;
}

interface PickerItem {
  id: string;
  label: string;
}

export default function HatchInlinePickerOverlay({
  destination,
  onRoute,
  onBack,
}: HatchInlinePickerOverlayProps) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMastType, setSelectedMastType] = useState<MastEntryType>('value');
  const [selectedKeelCategory, setSelectedKeelCategory] = useState<KeelCategory>('general');

  // Load data for agenda and charts pickers
  useEffect(() => {
    if (!user) return;
    if (destination === 'agenda') {
      loadMeetings();
    } else if (destination === 'charts') {
      loadTrackers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, destination]);

  const loadMeetings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setItems((data || []).map((m: { id: string; title: string }) => ({ id: m.id, label: m.title })));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleMastConfirm = useCallback(() => {
    onRoute('mast', { mastType: selectedMastType });
  }, [onRoute, selectedMastType]);

  const handleKeelConfirm = useCallback(() => {
    onRoute('keel', { keelCategory: selectedKeelCategory });
  }, [onRoute, selectedKeelCategory]);

  const handleMeetingSelect = useCallback(
    (meetingId: string) => {
      onRoute('agenda', { meetingId });
    },
    [onRoute],
  );

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
          onClick={onBack}
          aria-label="Back to destinations"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <h4 className="hatch-picker__title">{getTitle()}</h4>
      </div>

      {/* Mast type picker */}
      {destination === 'mast' && (
        <div className="hatch-picker__options">
          {(Object.keys(MAST_TYPE_LABELS) as MastEntryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`hatch-picker__option ${selectedMastType === type ? 'hatch-picker__option--selected' : ''}`}
              onClick={() => setSelectedMastType(type)}
            >
              {MAST_TYPE_LABELS[type]}
            </button>
          ))}
          <button
            type="button"
            className="hatch-picker__option"
            style={{ marginTop: 'var(--spacing-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-cognac)' }}
            onClick={handleMastConfirm}
          >
            Save to Mast
          </button>
        </div>
      )}

      {/* Keel category picker */}
      {destination === 'keel' && (
        <div className="hatch-picker__options">
          {(Object.keys(KEEL_CATEGORY_LABELS) as KeelCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`hatch-picker__option ${selectedKeelCategory === cat ? 'hatch-picker__option--selected' : ''}`}
              onClick={() => setSelectedKeelCategory(cat)}
            >
              {KEEL_CATEGORY_LABELS[cat]}
            </button>
          ))}
          <button
            type="button"
            className="hatch-picker__option"
            style={{ marginTop: 'var(--spacing-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-cognac)' }}
            onClick={handleKeelConfirm}
          >
            Save to Keel
          </button>
        </div>
      )}

      {/* Meeting picker for agenda */}
      {destination === 'agenda' && (
        loading ? (
          <div className="hatch-picker__loading"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="hatch-picker__empty">No meetings found. Create one from the Meetings page.</p>
        ) : (
          <div className="hatch-picker__options">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hatch-picker__option"
                onClick={() => handleMeetingSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
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
