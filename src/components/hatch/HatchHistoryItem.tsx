import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import type { HatchTab, HatchRoutingDestination } from '../../lib/types';
import './HatchHistoryItem.css';

interface HatchHistoryItemProps {
  tab: HatchTab;
  onReopen: (tabId: string) => void;
  onDelete: (tabId: string) => void;
}

const DESTINATION_ROUTES: Partial<Record<HatchRoutingDestination, string>> = {
  journal: '/journal',
  compass_individual: '/compass',
  compass_single: '/compass',
  lists: '/compass',
  victory: '/victories',
  keel: '/keel',
  mast: '/mast',
  note: '/journal',
  agenda: '/meetings',
  charts: '/charts',
};

export default function HatchHistoryItem({
  tab,
  onReopen,
  onDelete,
}: HatchHistoryItemProps) {
  const navigate = useNavigate();

  const handleNavigateToDestination = useCallback(() => {
    if (tab.routed_to) {
      const route = DESTINATION_ROUTES[tab.routed_to as HatchRoutingDestination];
      if (route) navigate(route);
    }
  }, [tab.routed_to, navigate]);

  const destConfig = tab.routed_to
    ? HATCH_DESTINATION_CONFIG[tab.routed_to as HatchRoutingDestination]
    : null;

  const formattedDate = new Date(tab.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const preview =
    tab.content.length > 120
      ? tab.content.slice(0, 117) + '...'
      : tab.content;

  return (
    <div
      className={`hatch-history-item hatch-history-item--${tab.status}`}
    >
      <div className="hatch-history-item__header">
        <h4 className="hatch-history-item__title">{tab.title}</h4>
        <span className="hatch-history-item__date">{formattedDate}</span>
      </div>

      {preview && (
        <p className="hatch-history-item__preview">{preview}</p>
      )}

      <div className="hatch-history-item__footer">
        <div className="hatch-history-item__status">
          {tab.status === 'routed' && destConfig && (
            <span
              className="hatch-history-item__dest-tag"
              style={{ borderColor: destConfig.accentColor }}
            >
              Routed to {destConfig.label}
            </span>
          )}
          {tab.status === 'archived' && (
            <span className="hatch-history-item__archived-tag">Archived</span>
          )}
          {tab.status === 'active' && (
            <span className="hatch-history-item__active-tag">Active</span>
          )}
        </div>

        <div className="hatch-history-item__actions">
          {tab.status === 'routed' && tab.routed_to && (
            <button
              type="button"
              className="hatch-history-item__action-btn"
              onClick={handleNavigateToDestination}
              title="Go to destination"
            >
              <ExternalLink size={14} />
            </button>
          )}
          {tab.status === 'archived' && (
            <button
              type="button"
              className="hatch-history-item__action-btn"
              onClick={() => onReopen(tab.id)}
              title="Reopen as new tab"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {tab.status !== 'active' && (
            <button
              type="button"
              className="hatch-history-item__action-btn hatch-history-item__action-btn--delete"
              onClick={() => onDelete(tab.id)}
              title="Delete permanently"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
