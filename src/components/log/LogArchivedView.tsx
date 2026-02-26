import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { LogEntry } from '../../lib/types';
import { LOG_ENTRY_TYPE_LABELS } from '../../lib/types';
import { Button, LoadingSpinner } from '../shared';
import './LogArchivedView.css';

interface LogArchivedViewProps {
  entries: LogEntry[];
  loading: boolean;
  onRestore: (id: string) => void;
  onDelete?: (id: string) => void;
  onLoad: () => void;
  onBack: () => void;
}

export default function LogArchivedView({ entries, loading, onRestore, onDelete, onLoad, onBack }: LogArchivedViewProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(id: string) {
    if (confirmingId === id) {
      onDelete?.(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  }

  return (
    <div className="log-archived">
      <div className="log-archived__top-bar">
        <button type="button" className="log-archived__back" onClick={onBack} aria-label="Back to Log">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="log-archived__title">Archived Entries</span>
      </div>

      {loading && (
        <div className="log-archived__loading">
          <LoadingSpinner size="md" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="log-archived__empty">No archived entries.</p>
      )}

      <div className="log-archived__list">
        {entries.map((entry) => (
          <div key={entry.id} className="log-archived__item">
            <div className="log-archived__item-content">
              <span className="log-archived__item-type">
                {LOG_ENTRY_TYPE_LABELS[entry.entry_type]}
              </span>
              <p className="log-archived__item-text">
                {entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text}
              </p>
              <span className="log-archived__item-date">
                Archived {new Date(entry.archived_at!).toLocaleDateString()}
              </span>
            </div>
            <div className="log-archived__item-actions">
              <Button variant="text" onClick={() => onRestore(entry.id)}>
                Restore
              </Button>
              {onDelete && (
                confirmingId === entry.id ? (
                  <div className="log-archived__confirm">
                    <span className="log-archived__confirm-text">Delete permanently?</span>
                    <Button variant="text" className="log-archived__delete-confirm" onClick={() => handleDelete(entry.id)}>
                      Confirm
                    </Button>
                    <Button variant="text" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    className="log-archived__delete-btn"
                    onClick={() => handleDelete(entry.id)}
                    title="Delete permanently"
                  >
                    Delete
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
