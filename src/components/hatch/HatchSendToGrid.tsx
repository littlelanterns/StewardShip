import { useState, useCallback } from 'react';
import { useHatchContext } from '../../contexts/HatchContext';
import HatchDestinationButton from './HatchDestinationButton';
import HatchInlinePickerOverlay from './HatchInlinePickerOverlay';
import HatchUndoToast from './HatchUndoToast';
import { LoadingSpinner } from '../shared';
import type { HatchRoutingDestination, MastEntryType, KeelCategory } from '../../lib/types';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import './HatchSendToGrid.css';

interface HatchSendToGridProps {
  tabId: string;
  onClose: () => void;
}

// Destinations that need an inline picker
const PICKER_DESTINATIONS: HatchRoutingDestination[] = ['mast', 'keel', 'agenda', 'charts'];

// 'compass' is a virtual button that opens the task sub-picker
type GridDestination = HatchRoutingDestination | 'compass';

const ALL_GRID_DESTINATIONS: GridDestination[] = [
  'log',
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

export default function HatchSendToGrid({ tabId, onClose }: HatchSendToGridProps) {
  const { routeTab, routingStats, tabs, undoRoute } = useHatchContext();
  const [routing, setRouting] = useState(false);
  const [pickerDestination, setPickerDestination] = useState<HatchRoutingDestination | null>(null);
  const [undoData, setUndoData] = useState<{
    tabId: string;
    destination: HatchRoutingDestination;
    destinationId?: string;
    tabTitle: string;
  } | null>(null);

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

  const handlePickerRoute = useCallback(
    async (
      destination: HatchRoutingDestination,
      options: { mastType?: MastEntryType; keelCategory?: KeelCategory; meetingId?: string; trackerId?: string },
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
