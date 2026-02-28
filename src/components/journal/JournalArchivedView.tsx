import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { JournalEntry } from '../../lib/types';
import { JOURNAL_ENTRY_TYPE_LABELS } from '../../lib/types';
import { Button, LoadingSpinner } from '../shared';
import './JournalArchivedView.css';

interface JournalArchivedViewProps {
  entries: JournalEntry[];
  loading: boolean;
  onRestore: (id: string) => void;
  onDelete?: (id: string) => void;
  onLoad: () => void;
  onBack: () => void;
}

export default function JournalArchivedView({ entries, loading, onRestore, onDelete, onLoad, onBack }: JournalArchivedViewProps) {
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
    <div className="journal-archived">
      <div className="journal-archived__top-bar">
        <button type="button" className="journal-archived__back" onClick={onBack} aria-label="Back to Journal">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="journal-archived__title">Archived Entries</span>
      </div>

      {loading && (
        <div className="journal-archived__loading">
          <LoadingSpinner size="md" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="journal-archived__empty">No archived entries.</p>
      )}

      <div className="journal-archived__list">
        {entries.map((entry) => (
          <div key={entry.id} className="journal-archived__item">
            <div className="journal-archived__item-content">
              <span className="journal-archived__item-type">
                {JOURNAL_ENTRY_TYPE_LABELS[entry.entry_type]}
              </span>
              <p className="journal-archived__item-text">
                {entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text}
              </p>
              <span className="journal-archived__item-date">
                Archived {new Date(entry.archived_at!).toLocaleDateString()}
              </span>
            </div>
            <div className="journal-archived__item-actions">
              <Button variant="text" onClick={() => onRestore(entry.id)}>
                Restore
              </Button>
              {onDelete && (
                confirmingId === entry.id ? (
                  <div className="journal-archived__confirm">
                    <span className="journal-archived__confirm-text">Delete permanently?</span>
                    <Button variant="text" className="journal-archived__delete-confirm" onClick={() => handleDelete(entry.id)}>
                      Confirm
                    </Button>
                    <Button variant="text" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    className="journal-archived__delete-btn"
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
