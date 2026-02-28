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

const ALL_DESTINATIONS: HatchRoutingDestination[] = [
  'log',
  'compass_individual',
  'compass_single',
  'lists',
  'victory',
  'keel',
  'mast',
  'note',
  'agenda',
  'charts',
];

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

  // Get top 3 favorites sorted by route_count
  const favorites = routingStats
    .sort((a, b) => b.route_count - a.route_count)
    .slice(0, 3)
    .map((s) => s.destination as HatchRoutingDestination)
    .filter((d) => ALL_DESTINATIONS.includes(d));

  const handleDestinationClick = useCallback(
    async (destination: HatchRoutingDestination) => {
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
        {ALL_DESTINATIONS.map((dest) => (
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
