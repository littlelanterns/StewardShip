import { useState, useCallback } from 'react';
import { useHatchContext } from '../../contexts/HatchContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import HatchDestinationButton from './HatchDestinationButton';
import HatchInlinePickerOverlay from './HatchInlinePickerOverlay';
import HatchUndoToast from './HatchUndoToast';
import { LoadingSpinner } from '../shared';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';
import type { HatchRoutingDestination, MastEntryType, KeelCategory, JournalEntryType } from '../../lib/types';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import './HatchSendToGrid.css';

interface HatchSendToGridProps {
  tabId: string;
  onClose: () => void;
}

// Destinations that need an inline picker
const PICKER_DESTINATIONS: HatchRoutingDestination[] = ['mast', 'keel', 'journal', 'agenda', 'charts'];

// Destinations that support bulk add
const BULK_DESTINATIONS: HatchRoutingDestination[] = ['mast', 'keel', 'victory'];

// 'compass' is a virtual button that opens the task sub-picker
type GridDestination = HatchRoutingDestination | 'compass';

const ALL_GRID_DESTINATIONS: GridDestination[] = [
  'journal',
  'compass',
  'lists',
  'victory',
  'keel',
  'mast',
  'note',
  'agenda',
  'charts',
];

// For favorites, map compass_individual and compass_single to 'compass'
const normalizeFavorite = (dest: string): GridDestination => {
  if (dest === 'compass_individual' || dest === 'compass_single') return 'compass';
  return dest as GridDestination;
};

// Bulk add configuration per destination
const BULK_CONFIG: Record<string, {
  title: string;
  placeholder: string;
  parsePrompt: string;
  categories?: { value: string; label: string }[];
}> = {
  mast: {
    title: 'Bulk Add to Mast',
    placeholder: 'Paste your values, principles, declarations...',
    parsePrompt: 'You are parsing a list of personal values, principles, or declarations into individual Mast entries. Each item should be a distinct value, declaration, faith foundation, scripture/quote, or vision statement. Return a JSON array of objects with "text" and "category" fields.',
    categories: [
      { value: 'value', label: 'Value' },
      { value: 'declaration', label: 'Declaration' },
      { value: 'faith_foundation', label: 'Faith Foundation' },
      { value: 'scripture_quote', label: 'Scripture / Quote' },
      { value: 'vision', label: 'Vision' },
    ],
  },
  keel: {
    title: 'Bulk Add to Keel',
    placeholder: 'Paste your personality traits, strengths, growth areas...',
    parsePrompt: 'You are parsing a list of personality traits, self-knowledge, or personal characteristics into individual Keel entries. Each item should be a distinct trait, assessment result, strength, or growth area. Return a JSON array of objects with "text" and "category" fields.',
    categories: [
      { value: 'personality_assessment', label: 'Personality Assessment' },
      { value: 'trait_tendency', label: 'Trait / Tendency' },
      { value: 'strength', label: 'Strength' },
      { value: 'growth_area', label: 'Growth Area' },
      { value: 'you_inc', label: 'You, Inc.' },
      { value: 'general', label: 'General' },
    ],
  },
  victory: {
    title: 'Bulk Add Victories',
    placeholder: 'Paste your accomplishments, wins, milestones...',
    parsePrompt: 'You are parsing a list of accomplishments or victories. Each item should be a distinct achievement or win worth recording. Return a JSON array of strings, one per victory.',
  },
};

export default function HatchSendToGrid({ tabId, onClose }: HatchSendToGridProps) {
  const { user } = useAuthContext();
  const { routeTab, bulkRouteTab, routingStats, tabs, undoRoute } = useHatchContext();
  const [routing, setRouting] = useState(false);
  const [pickerDestination, setPickerDestination] = useState<HatchRoutingDestination | null>(null);
  const [undoData, setUndoData] = useState<{
    tabId: string;
    destination: HatchRoutingDestination;
    destinationId?: string;
    tabTitle: string;
  } | null>(null);

  // Bulk routing state
  const [bulkPickerDest, setBulkPickerDest] = useState<HatchRoutingDestination | null>(null);
  const [bulkAddDest, setBulkAddDest] = useState<HatchRoutingDestination | null>(null);

  const tabContent = tabs.find((t) => t.id === tabId)?.content || '';

  // Get top 3 favorites sorted by route_count, dedup compass variants
  const favorites = (() => {
    const seen = new Set<GridDestination>();
    const result: GridDestination[] = [];
    for (const s of [...routingStats].sort((a, b) => b.route_count - a.route_count)) {
      const norm = normalizeFavorite(s.destination);
      if (!seen.has(norm) && ALL_GRID_DESTINATIONS.includes(norm)) {
        seen.add(norm);
        result.push(norm);
        if (result.length >= 3) break;
      }
    }
    return result;
  })();

  const [compassPickerOpen, setCompassPickerOpen] = useState(false);

  const handleDestinationClick = useCallback(
    async (destination: GridDestination) => {
      // Compass opens the task mode sub-picker
      if (destination === 'compass') {
        setCompassPickerOpen(true);
        return;
      }

      // Bulk-capable destinations show one/bulk choice
      if (BULK_DESTINATIONS.includes(destination)) {
        setBulkPickerDest(destination);
        return;
      }

      // Destinations needing a sub-picker
      if (PICKER_DESTINATIONS.includes(destination)) {
        setPickerDestination(destination);
        return;
      }

      setRouting(true);
      const tab = tabs.find((t) => t.id === tabId);
      const result = await routeTab(tabId, destination);
      setRouting(false);

      if (result.success) {
        setUndoData({
          tabId,
          destination,
          destinationId: result.destinationId,
          tabTitle: tab?.title || 'Tab',
        });
      }
    },
    [tabId, routeTab, tabs],
  );

  // "Send as one" from bulk picker — route to existing single-item flow
  const handleBulkPickerSendAsOne = useCallback((dest: HatchRoutingDestination) => {
    setBulkPickerDest(null);
    // mast/keel need the inline picker for type/category
    if (PICKER_DESTINATIONS.includes(dest)) {
      setPickerDestination(dest);
    } else {
      // victory routes directly
      setRouting(true);
      const tab = tabs.find((t) => t.id === tabId);
      routeTab(tabId, dest).then((result) => {
        setRouting(false);
        if (result.success) {
          setUndoData({
            tabId,
            destination: dest,
            destinationId: result.destinationId,
            tabTitle: tab?.title || 'Tab',
          });
        }
      });
    }
  }, [tabId, routeTab, tabs]);

  // "Bulk sort" from bulk picker — open BulkAddWithAISort
  const handleBulkPickerBulkSort = useCallback((dest: HatchRoutingDestination) => {
    setBulkPickerDest(null);
    setBulkAddDest(dest);
  }, []);

  // Save handler for bulk add
  const handleBulkSave = useCallback(async (items: ParsedBulkItem[]) => {
    if (!user || !bulkAddDest) return;

    const selected = items.filter((item) => item.selected && item.text.trim().length > 0);
    if (selected.length === 0) return;

    switch (bulkAddDest) {
      case 'mast':
        for (let i = 0; i < selected.length; i++) {
          await supabase.from('mast_entries').insert({
            user_id: user.id,
            type: selected[i].category || 'value',
            text: selected[i].text,
            source: 'hatch',
            source_reference_id: tabId,
            sort_order: i,
          });
        }
        break;

      case 'keel':
        for (let i = 0; i < selected.length; i++) {
          await supabase.from('keel_entries').insert({
            user_id: user.id,
            category: selected[i].category || 'general',
            text: selected[i].text,
            source: 'hatch',
            source_type: 'hatch',
            source_reference_id: tabId,
            sort_order: i,
          });
        }
        break;

      case 'victory':
        for (const item of selected) {
          await supabase.from('victories').insert({
            user_id: user.id,
            description: item.text,
            source: 'hatch',
            source_reference_id: tabId,
          });
        }
        break;
    }

    // Mark tab as routed and clean up
    await bulkRouteTab(tabId, bulkAddDest);
    setBulkAddDest(null);
    onClose();
  }, [user, bulkAddDest, tabId, bulkRouteTab, onClose]);

  const handlePickerRoute = useCallback(
    async (
      destination: HatchRoutingDestination,
      options: { mastType?: MastEntryType; keelCategory?: KeelCategory; journalEntryType?: JournalEntryType; meetingId?: string; trackerId?: string },
    ) => {
      setRouting(true);
      const tab = tabs.find((t) => t.id === tabId);
      const result = await routeTab(tabId, destination, options);
      setRouting(false);
      setPickerDestination(null);

      if (result.success) {
        setUndoData({
          tabId,
          destination,
          destinationId: result.destinationId,
          tabTitle: tab?.title || 'Tab',
        });
      }
    },
    [tabId, routeTab, tabs],
  );

  const handleUndo = useCallback(async () => {
    if (!undoData) return;
    await undoRoute(undoData.tabId, undoData.destination, undoData.destinationId);
    setUndoData(null);
    onClose();
  }, [undoData, undoRoute, onClose]);

  const handleUndoDismiss = useCallback(() => {
    setUndoData(null);
    onClose();
  }, [onClose]);

  // Show undo toast after routing
  if (undoData) {
    const destLabel = HATCH_DESTINATION_CONFIG[undoData.destination]?.label || undoData.destination;
    return (
      <HatchUndoToast
        message={`"${undoData.tabTitle}" sent to ${destLabel}`}
        onUndo={handleUndo}
        onDismiss={handleUndoDismiss}
      />
    );
  }

  // Show compass task mode picker
  if (compassPickerOpen) {
    return (
      <div className="hatch-send-grid">
        <div className="hatch-send-grid__header">
          <h4 className="hatch-send-grid__title">How should we handle these tasks?</h4>
        </div>
        <div className="hatch-send-grid__compass-options">
          <button
            type="button"
            className="hatch-send-grid__compass-option"
            onClick={() => { setCompassPickerOpen(false); handleDestinationClick('compass_individual'); }}
          >
            <span className="hatch-send-grid__compass-option-title">Break into individual tasks</span>
            <span className="hatch-send-grid__compass-option-desc">Each line becomes its own task</span>
          </button>
          <button
            type="button"
            className="hatch-send-grid__compass-option"
            onClick={() => { setCompassPickerOpen(false); handleDestinationClick('compass_single'); }}
          >
            <span className="hatch-send-grid__compass-option-title">Save as one task</span>
            <span className="hatch-send-grid__compass-option-desc">The whole note becomes a single task</span>
          </button>
          <button
            type="button"
            className="hatch-send-grid__compass-option"
            onClick={() => { setCompassPickerOpen(false); handleDestinationClick('compass_individual'); }}
          >
            <span className="hatch-send-grid__compass-option-title">AI auto-sort into tasks</span>
            <span className="hatch-send-grid__compass-option-desc">Let AI break down and organize</span>
          </button>
        </div>
        <button
          type="button"
          className="hatch-send-grid__cancel"
          onClick={() => setCompassPickerOpen(false)}
        >
          Back
        </button>
      </div>
    );
  }

  // Show bulk mode picker (send as one vs bulk sort)
  if (bulkPickerDest) {
    const destLabel = HATCH_DESTINATION_CONFIG[bulkPickerDest]?.label || bulkPickerDest;
    return (
      <div className="hatch-send-grid">
        <div className="hatch-send-grid__header">
          <h4 className="hatch-send-grid__title">Send to {destLabel}</h4>
        </div>
        <div className="hatch-send-grid__compass-options">
          <button
            type="button"
            className="hatch-send-grid__compass-option"
            onClick={() => handleBulkPickerSendAsOne(bulkPickerDest)}
          >
            <span className="hatch-send-grid__compass-option-title">Send as one item</span>
            <span className="hatch-send-grid__compass-option-desc">The whole note becomes a single entry</span>
          </button>
          <button
            type="button"
            className="hatch-send-grid__compass-option"
            onClick={() => handleBulkPickerBulkSort(bulkPickerDest)}
          >
            <span className="hatch-send-grid__compass-option-title">Bulk sort into multiple</span>
            <span className="hatch-send-grid__compass-option-desc">AI parses into separate entries</span>
          </button>
        </div>
        <button
          type="button"
          className="hatch-send-grid__cancel"
          onClick={() => setBulkPickerDest(null)}
        >
          Back
        </button>
      </div>
    );
  }

  // Show bulk add with AI sort
  if (bulkAddDest) {
    const config = BULK_CONFIG[bulkAddDest];
    if (config) {
      return (
        <div className="hatch-send-grid">
          <BulkAddWithAISort
            title={config.title}
            placeholder={config.placeholder}
            parsePrompt={config.parsePrompt}
            categories={config.categories}
            initialText={tabContent}
            onSave={handleBulkSave}
            onClose={() => setBulkAddDest(null)}
          />
        </div>
      );
    }
  }

  // Show inline picker
  if (pickerDestination) {
    return (
      <HatchInlinePickerOverlay
        destination={pickerDestination}
        onRoute={handlePickerRoute}
        onBack={() => setPickerDestination(null)}
      />
    );
  }

  // Show loading
  if (routing) {
    return (
      <div className="hatch-send-grid">
        <div className="hatch-send-grid__loading">
          <LoadingSpinner />
          <span>Routing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="hatch-send-grid">
      <div className="hatch-send-grid__header">
        <h4 className="hatch-send-grid__title">Send to...</h4>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <>
          <span className="hatch-send-grid__section-label">Favorites</span>
          <div className="hatch-send-grid__grid">
            {favorites.map((dest) => (
              <HatchDestinationButton
                key={dest}
                destination={dest}
                variant="favorite"
                onClick={handleDestinationClick}
              />
            ))}
          </div>
        </>
      )}

      {/* All destinations */}
      <span className="hatch-send-grid__section-label">All Destinations</span>
      <div className="hatch-send-grid__grid">
        {ALL_GRID_DESTINATIONS.map((dest) => (
          <HatchDestinationButton
            key={dest}
            destination={dest}
            onClick={handleDestinationClick}
          />
        ))}
      </div>

      <button
        type="button"
        className="hatch-send-grid__cancel"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}
