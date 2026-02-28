import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { autoTagTask } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
import { useReminders } from '../../hooks/useReminders';
import type { MastEntryType, KeelCategory, List } from '../../lib/types';
import { MAST_TYPE_LABELS, KEEL_CATEGORY_LABELS } from '../../lib/types';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import { RecordVictory } from '../victories/RecordVictory';
import { CustomReminderModal } from '../reminders/CustomReminderModal';
import { useVictories } from '../../hooks/useVictories';
import './RoutingSelector.css';

interface RoutingSelectorProps {
  entryId: string;
  entryText: string;
  onRouted: (target: string, referenceId: string) => void;
  onClose: () => void;
}

type SubScreen = 'main' | 'mast' | 'keel' | 'lists' | 'victory' | 'reminder';

type RouteKey = 'compass' | 'victory' | 'reminder' | 'mast' | 'keel' | 'list';

function getSuggestedRoutes(text: string): RouteKey[] {
  const suggestions: RouteKey[] = [];
  const lower = text.toLowerCase();

  if (/\b(need to|should|have to|must|todo|deadline|by friday|this week|get done|take care of)\b/.test(lower)) {
    suggestions.push('compass');
  }
  if (/\b(accomplished|achieved|finished|completed|proud|victory|milestone|success|nailed|crushed it)\b/.test(lower)) {
    suggestions.push('victory');
  }
  if (/\b(remind me|don't forget|remember to|next week|tomorrow|on monday|don't let me)\b/.test(lower)) {
    suggestions.push('reminder');
  }
  if (/\b(i believe|i value|my principle|i commit|i will always|i stand for|i choose to)\b/.test(lower)) {
    suggestions.push('mast');
  }
  if (/\b(i tend to|i'm the type|my personality|i realize about myself|pattern|i notice that i)\b/.test(lower)) {
    suggestions.push('keel');
  }
  if (/\b(buy|pick up|grocery|shopping|list of|items|supplies)\b/.test(lower)) {
    suggestions.push('list');
  }

  return suggestions;
}

export function RoutingSelector({ entryId, entryText, onRouted, onClose }: RoutingSelectorProps) {
  const { user } = useAuthContext();
  const { openDrawer, sendMessage } = useHelmContext();
  const { createVictory } = useVictories();
  const { createCustomReminder } = useReminders();
  const [subScreen, setSubScreen] = useState<SubScreen>('main');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mast sub-screen state
  const [mastType, setMastType] = useState<MastEntryType>('value');

  // Keel sub-screen state
  const [keelCategory, setKeelCategory] = useState<KeelCategory>('general');

  // Lists sub-screen state
  const [userLists, setUserLists] = useState<List[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRouteToMast = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('mast_entries')
        .insert({
          user_id: user.id,
          type: mastType,
          text: entryText,
          source: 'log_routed',
          source_reference_id: entryId,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      onRouted('mast_entry', data.id);
      showToast('Saved to The Mast');
      setSubScreen('main');
    } catch {
      showToast('Failed to save to Mast');
    } finally {
      setSaving(false);
    }
  };

  const handleRouteToKeel = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('keel_entries')
        .insert({
          user_id: user.id,
          category: keelCategory,
          text: entryText,
          source: 'log_routed',
          source_type: 'log_routed',
          source_reference_id: entryId,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      onRouted('keel_entry', data.id);
      showToast('Saved to The Keel');
      setSubScreen('main');
    } catch {
      showToast('Failed to save to Keel');
    } finally {
      setSaving(false);
    }
  };

  const handleRouteToCompass = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Extract title: first line or first ~100 chars
      const firstLine = entryText.split('\n')[0];
      const title = firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine;
      const description = entryText.length > title.length ? entryText : null;
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('compass_tasks')
        .insert({
          user_id: user.id,
          title,
          description,
          source: 'log_routed',
          source_reference_id: entryId,
          due_date: today,
          status: 'pending',
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;

      onRouted('compass_task', data.id);

      // Trigger auto-tag in background
      autoTagTask(title, description, user.id).then((tag) => {
        if (tag) {
          supabase
            .from('compass_tasks')
            .update({ life_area_tag: tag })
            .eq('id', data.id)
            .eq('user_id', user.id)
            .then(() => {});
        }
      });

      showToast('Task created in Compass');
    } catch {
      showToast('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLists = async () => {
    if (!user) return;
    setSubScreen('lists');
    setListsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (err) throw err;
      setUserLists((data as List[]) || []);
    } catch {
      showToast('Failed to load lists');
      setSubScreen('main');
    } finally {
      setListsLoading(false);
    }
  };

  const handleRouteToList = async (list: List) => {
    if (!user) return;
    setSaving(true);
    try {
      // Get current max sort_order
      const { data: existingItems } = await supabase
        .from('list_items')
        .select('sort_order')
        .eq('list_id', list.id)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const maxSort = existingItems && existingItems.length > 0 ? existingItems[0].sort_order : -1;

      const { data, error: err } = await supabase
        .from('list_items')
        .insert({
          list_id: list.id,
          user_id: user.id,
          text: entryText,
          checked: false,
          sort_order: maxSort + 1,
        })
        .select()
        .single();

      if (err) throw err;
      onRouted('list_item', data.id);
      showToast(`Added to "${list.title}"`);
      setSubScreen('main');
    } catch {
      showToast('Failed to add to list');
    } finally {
      setSaving(false);
    }
  };

  const handleHelmProcess = () => {
    openDrawer();
    sendMessage(`Processing a Journal entry:\n\n"${entryText}"`);
    onClose();
  };

  if (subScreen === 'victory') {
    return (
      <RecordVictory
        prefill={{
          description: entryText,
          source: 'log_entry',
          source_reference_id: entryId,
        }}
        onSave={async (data) => {
          const victory = await createVictory(data);
          if (victory) {
            onRouted('victory', victory.id);
            showToast('Victory recorded');
          }
        }}
        onClose={() => setSubScreen('main')}
      />
    );
  }

  if (subScreen === 'mast') {
    return (
      <div className="routing-selector">
        <h4 className="routing-selector__title">Save to The Mast</h4>
        <p className="routing-selector__subtitle">What type of principle is this?</p>

        <div className="routing-selector__options">
          {(Object.keys(MAST_TYPE_LABELS) as MastEntryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`routing-selector__option ${mastType === type ? 'routing-selector__option--selected' : ''}`}
              onClick={() => setMastType(type)}
            >
              {MAST_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="routing-selector__actions">
          <Button variant="text" onClick={() => setSubScreen('main')}>Back</Button>
          <Button onClick={handleRouteToMast} disabled={saving}>
            {saving ? 'Saving...' : 'Save to Mast'}
          </Button>
        </div>

        {toast && <div className="routing-selector__toast">{toast}</div>}
      </div>
    );
  }

  if (subScreen === 'keel') {
    return (
      <div className="routing-selector">
        <h4 className="routing-selector__title">Save to The Keel</h4>
        <p className="routing-selector__subtitle">What category of self-knowledge?</p>

        <div className="routing-selector__options">
          {(Object.keys(KEEL_CATEGORY_LABELS) as KeelCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`routing-selector__option ${keelCategory === cat ? 'routing-selector__option--selected' : ''}`}
              onClick={() => setKeelCategory(cat)}
            >
              {KEEL_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="routing-selector__actions">
          <Button variant="text" onClick={() => setSubScreen('main')}>Back</Button>
          <Button onClick={handleRouteToKeel} disabled={saving}>
            {saving ? 'Saving...' : 'Save to Keel'}
          </Button>
        </div>

        {toast && <div className="routing-selector__toast">{toast}</div>}
      </div>
    );
  }

  if (subScreen === 'lists') {
    return (
      <div className="routing-selector">
        <h4 className="routing-selector__title">Add to a List</h4>
        <p className="routing-selector__subtitle">Which list?</p>

        {listsLoading ? (
          <div className="routing-selector__loading"><LoadingSpinner /></div>
        ) : userLists.length === 0 ? (
          <p className="routing-selector__empty">No lists yet. Create one from the Compass page.</p>
        ) : (
          <div className="routing-selector__list">
            {userLists.map((list) => (
              <button
                key={list.id}
                type="button"
                className="routing-selector__item"
                onClick={() => handleRouteToList(list)}
                disabled={saving}
              >
                <span className="routing-selector__item-label">{list.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="routing-selector__actions">
          <Button variant="text" onClick={() => setSubScreen('main')}>Back</Button>
        </div>

        {toast && <div className="routing-selector__toast">{toast}</div>}
      </div>
    );
  }

  if (subScreen === 'reminder') {
    return (
      <CustomReminderModal
        prefillTitle={entryText.split('\n')[0].slice(0, 80)}
        relatedEntityType="log_entry"
        relatedEntityId={entryId}
        onSave={async (data) => {
          const reminder = await createCustomReminder(
            data.title,
            data.body,
            data.scheduledAt,
            'log_entry',
            entryId,
          );
          if (reminder) {
            onRouted('reminder', reminder.id);
            showToast('Reminder set');
          }
          setSubScreen('main');
        }}
        onClose={() => setSubScreen('main')}
      />
    );
  }

  const suggestions = getSuggestedRoutes(entryText);

  const routeItems: { key: RouteKey | 'save' | 'helm'; label: string; desc: string; action: () => void }[] = [
    { key: 'save', label: 'Just save it', desc: 'Entry stays in the Journal', action: onClose },
    { key: 'compass', label: 'Create a task', desc: 'Add to your Compass', action: handleRouteToCompass },
    { key: 'list', label: 'Add to a list', desc: 'Save to a flexible list', action: handleOpenLists },
    { key: 'reminder', label: 'Set a reminder', desc: 'Get nudged later', action: () => setSubScreen('reminder') },
    { key: 'mast', label: 'Save to Mast', desc: 'Add as a guiding principle', action: () => setSubScreen('mast') },
    { key: 'keel', label: 'Save to Keel', desc: 'Add as self-knowledge', action: () => setSubScreen('keel') },
    { key: 'victory', label: 'This is a victory', desc: 'Record an accomplishment', action: () => setSubScreen('victory') },
    { key: 'helm', label: 'Do something else with it', desc: 'Process at The Helm', action: handleHelmProcess },
  ];

  return (
    <div className="routing-selector">
      <h4 className="routing-selector__title">Do something with this entry?</h4>

      {suggestions.length > 0 && (
        <p className="routing-selector__suggested-label">Suggested</p>
      )}

      <div className="routing-selector__list">
        {routeItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`routing-selector__item ${suggestions.includes(item.key as RouteKey) ? 'routing-selector__item--suggested' : ''}`}
            onClick={item.action}
          >
            <span className="routing-selector__item-label">{item.label}</span>
            <span className="routing-selector__item-desc">{item.desc}</span>
          </button>
        ))}
      </div>

      {toast && <div className="routing-selector__toast">{toast}</div>}
    </div>
  );
}
