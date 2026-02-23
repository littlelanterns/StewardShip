import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { autoTagTask } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
import type { MastEntryType, KeelCategory } from '../../lib/types';
import { MAST_TYPE_LABELS, KEEL_CATEGORY_LABELS } from '../../lib/types';
import { Button } from './Button';
import './RoutingSelector.css';

interface RoutingSelectorProps {
  entryId: string;
  entryText: string;
  onRouted: (target: string, referenceId: string) => void;
  onClose: () => void;
}

type SubScreen = 'main' | 'mast' | 'keel';

export function RoutingSelector({ entryId, entryText, onRouted, onClose }: RoutingSelectorProps) {
  const { user } = useAuthContext();
  const { openDrawer, sendMessage } = useHelmContext();
  const [subScreen, setSubScreen] = useState<SubScreen>('main');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mast sub-screen state
  const [mastType, setMastType] = useState<MastEntryType>('value');

  // Keel sub-screen state
  const [keelCategory, setKeelCategory] = useState<KeelCategory>('general');

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

  const handleHelmProcess = () => {
    openDrawer();
    sendMessage(`Processing a Log entry:\n\n"${entryText}"`);
    onClose();
  };

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

  return (
    <div className="routing-selector">
      <h4 className="routing-selector__title">Do something with this entry?</h4>

      <div className="routing-selector__list">
        <button
          type="button"
          className="routing-selector__item"
          onClick={onClose}
        >
          <span className="routing-selector__item-label">Just save it</span>
          <span className="routing-selector__item-desc">Entry stays in the Log</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={handleRouteToCompass}
        >
          <span className="routing-selector__item-label">Create a task</span>
          <span className="routing-selector__item-desc">Add to your Compass</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={() => showToast('Lists coming in a later phase')}
        >
          <span className="routing-selector__item-label">Add to a list</span>
          <span className="routing-selector__item-desc">Save to a flexible list</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={() => showToast('Reminders coming in a later phase')}
        >
          <span className="routing-selector__item-label">Set a reminder</span>
          <span className="routing-selector__item-desc">Get nudged later</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={() => setSubScreen('mast')}
        >
          <span className="routing-selector__item-label">Save to Mast</span>
          <span className="routing-selector__item-desc">Add as a guiding principle</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={() => setSubScreen('keel')}
        >
          <span className="routing-selector__item-label">Save to Keel</span>
          <span className="routing-selector__item-desc">Add as self-knowledge</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={() => showToast('Victory Recorder coming in a later phase')}
        >
          <span className="routing-selector__item-label">This is a victory</span>
          <span className="routing-selector__item-desc">Record an accomplishment</span>
        </button>

        <button
          type="button"
          className="routing-selector__item"
          onClick={handleHelmProcess}
        >
          <span className="routing-selector__item-label">Do something else with it</span>
          <span className="routing-selector__item-desc">Process at The Helm</span>
        </button>
      </div>

      {toast && <div className="routing-selector__toast">{toast}</div>}
    </div>
  );
}
