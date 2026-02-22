import { X } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import './ArchivedView.css';

interface ArchivedItem {
  id: string;
  text: string;
  badge: string;
  archived_at: string | null;
}

interface ArchivedViewProps {
  items: ArchivedItem[];
  onRestore: (id: string) => void;
  onClose: () => void;
  loading?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ArchivedView({ items, onRestore, onClose, loading }: ArchivedViewProps) {
  return (
    <>
      <div className="archived-overlay" onClick={onClose} />
      <div className="archived-panel" role="dialog" aria-label="Archived entries">
        <div className="archived-panel__header">
          <h2 className="archived-panel__title">Archived</h2>
          <button className="archived-panel__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="archived-panel__body">
          {loading ? (
            <EmptyState heading="Loading..." />
          ) : items.length === 0 ? (
            <EmptyState
              heading="No archived entries"
              message="Entries you archive will appear here. You can restore them at any time."
            />
          ) : (
            <div className="archived-panel__list">
              {items.map((item) => (
                <div key={item.id} className="archived-item">
                  <div className="archived-item__body">
                    <p className="archived-item__text">{item.text}</p>
                    <div className="archived-item__meta">
                      <span className="archived-item__badge">{item.badge}</span>
                      {item.archived_at && (
                        <span className="archived-item__date">
                          Archived {formatDate(item.archived_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="archived-item__restore"
                    onClick={() => onRestore(item.id)}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
