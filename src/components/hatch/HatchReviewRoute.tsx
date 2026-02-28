import { useState, useCallback } from 'react';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { LoadingSpinner } from '../shared';
import { useHatchContext } from '../../contexts/HatchContext';
import HatchExtractedCard from './HatchExtractedCard';
import type {
  HatchExtractedItem,
  HatchRoutingDestination,
} from '../../lib/types';
import './HatchReviewRoute.css';

interface HatchReviewRouteProps {
  tabId: string;
  onClose: () => void;
}

export default function HatchReviewRoute({
  tabId,
  onClose,
}: HatchReviewRouteProps) {
  const {
    extractItems,
    routeExtractedItem,
    skipExtractedItem,
    updateExtractedItemText,
  } = useHatchContext();

  const [items, setItems] = useState<HatchExtractedItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);

  const handleExtract = useCallback(async () => {
    setExtracting(true);
    setError(null);
    try {
      const result = await extractItems(tabId);
      setItems(result);
      setExtracted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to extract items',
      );
    } finally {
      setExtracting(false);
    }
  }, [tabId, extractItems]);

  const handleRoute = useCallback(
    async (itemId: string, destination: HatchRoutingDestination) => {
      setRouting(true);
      try {
        await routeExtractedItem(itemId, destination);
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, status: 'routed' as const, actual_destination: destination }
              : i,
          ),
        );
      } catch {
        // Route failure — item stays pending
      } finally {
        setRouting(false);
      }
    },
    [routeExtractedItem],
  );

  const handleSkip = useCallback(
    async (itemId: string) => {
      try {
        await skipExtractedItem(itemId);
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, status: 'skipped' as const } : i,
          ),
        );
      } catch {
        // Skip failure is non-critical
      }
    },
    [skipExtractedItem],
  );

  const handleEditText = useCallback(
    async (itemId: string, newText: string) => {
      try {
        await updateExtractedItemText(itemId, newText);
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, extracted_text: newText } : i,
          ),
        );
      } catch {
        // Edit failure is non-critical
      }
    },
    [updateExtractedItemText],
  );

  const handleRouteAllPending = useCallback(async () => {
    setRouting(true);
    const pending = items.filter((i) => i.status === 'pending');
    for (const item of pending) {
      try {
        await routeExtractedItem(item.id, item.suggested_destination);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'routed' as const,
                  actual_destination: item.suggested_destination,
                }
              : i,
          ),
        );
      } catch {
        // Continue with remaining items
      }
    }
    setRouting(false);
  }, [items, routeExtractedItem]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const routedCount = items.filter((i) => i.status === 'routed').length;
  const allDone = extracted && pendingCount === 0;

  return (
    <div className="hatch-review-route">
      <div className="hatch-review-route__header">
        <button
          type="button"
          className="hatch-review-route__back"
          onClick={onClose}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h3 className="hatch-review-route__title">Review & Route</h3>
      </div>

      {!extracted && !extracting && (
        <div className="hatch-review-route__start">
          <Wand2 size={32} className="hatch-review-route__start-icon" />
          <p className="hatch-review-route__start-text">
            The AI will scan your content and extract individual items with
            suggested destinations.
          </p>
          <button
            type="button"
            className="hatch-review-route__start-btn"
            onClick={handleExtract}
          >
            Extract Items
          </button>
        </div>
      )}

      {extracting && (
        <div className="hatch-review-route__loading">
          <LoadingSpinner />
          <p>Analyzing content...</p>
        </div>
      )}

      {error && (
        <div className="hatch-review-route__error">
          <p>{error}</p>
          <button
            type="button"
            className="hatch-review-route__retry-btn"
            onClick={handleExtract}
          >
            Try Again
          </button>
        </div>
      )}

      {extracted && items.length === 0 && !extracting && (
        <div className="hatch-review-route__empty">
          <p>No discrete items found to extract.</p>
          <button
            type="button"
            className="hatch-review-route__back-btn"
            onClick={onClose}
          >
            Go Back
          </button>
        </div>
      )}

      {extracted && items.length > 0 && (
        <>
          <div className="hatch-review-route__summary">
            <span>
              {items.length} item{items.length !== 1 ? 's' : ''} found
            </span>
            {routedCount > 0 && (
              <span className="hatch-review-route__routed-count">
                {routedCount} routed
              </span>
            )}
          </div>

          <div className="hatch-review-route__items">
            {items.map((item) => (
              <HatchExtractedCard
                key={item.id}
                item={item}
                onRoute={handleRoute}
                onSkip={handleSkip}
                onEditText={handleEditText}
                disabled={routing}
              />
            ))}
          </div>

          {pendingCount > 0 && (
            <div className="hatch-review-route__bulk-actions">
              <button
                type="button"
                className="hatch-review-route__route-all"
                onClick={handleRouteAllPending}
                disabled={routing}
              >
                {routing ? 'Routing...' : `Route All ${pendingCount} Items`}
              </button>
            </div>
          )}

          {allDone && (
            <div className="hatch-review-route__done">
              <p className="hatch-review-route__done-text">
                All items have been processed.
              </p>
              <button
                type="button"
                className="hatch-review-route__done-btn"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
