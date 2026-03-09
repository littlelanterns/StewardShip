import { useState, useCallback, useEffect } from 'react';
import { Shield, RefreshCw, Eraser, UserMinus, Trash2, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminBook {
  id: string;
  title: string;
  file_type: string;
  extraction_status: string | null;
  processing_status: string;
  created_at: string;
  clone_count: number;
}

interface AdminBookManagerProps {
  onBooksChanged?: () => void;
}

export function AdminBookManager({ onBooksChanged }: AdminBookManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({}); // bookId → action
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // bookId awaiting confirmation
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manifest-admin', {
        body: { action: 'list_books' },
      });
      if (error) throw error;
      setBooks(data?.books || []);
    } catch (err) {
      console.error('[admin] Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && books.length === 0) {
      fetchBooks();
    }
  }, [expanded, books.length, fetchBooks]);

  const runAction = useCallback(async (bookId: string, action: string, label: string) => {
    setActionLoading((prev) => ({ ...prev, [bookId]: action }));
    setStatusMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('manifest-admin', {
        body: { action, manifest_item_id: bookId },
      });
      if (error) throw error;
      setStatusMessage(`${label}: ${data?.message || 'Done'}`);

      // Refresh list after destructive actions
      if (action === 'remove_clones' || action === 'remove_book' || action === 'clear_extractions') {
        await fetchBooks();
        onBooksChanged?.();
      }
    } catch (err) {
      setStatusMessage(`${label} failed: ${(err as Error).message}`);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[bookId];
        return next;
      });
      setConfirmDelete(null);
    }
  }, [fetchBooks, onBooksChanged]);

  const getStatusBadge = (status: string | null) => {
    if (!status || status === 'none') return 'none';
    if (status === 'completed') return 'done';
    if (status === 'in_progress') return 'extracting';
    return status;
  };

  return (
    <div className="admin-book-manager">
      <button
        type="button"
        className="admin-book-manager__header"
        onClick={() => setExpanded(!expanded)}
      >
        <Shield size={16} />
        <span>Admin: Book Manager</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <div className="admin-book-manager__content">
          <div className="admin-book-manager__toolbar">
            <button
              type="button"
              className="admin-book-manager__refresh"
              onClick={fetchBooks}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'admin-book-manager__spin' : ''} />
              Refresh
            </button>
            <span className="admin-book-manager__count">{books.length} books</span>
          </div>

          {statusMessage && (
            <div className="admin-book-manager__status">{statusMessage}</div>
          )}

          {loading && books.length === 0 ? (
            <div className="admin-book-manager__loading">
              <Loader size={16} className="admin-book-manager__spin" /> Loading...
            </div>
          ) : (
            <div className="admin-book-manager__list">
              {books.map((book) => {
                const isActing = !!actionLoading[book.id];
                const currentAction = actionLoading[book.id];

                return (
                  <div key={book.id} className="admin-book-manager__row">
                    <div className="admin-book-manager__row-info">
                      <span className="admin-book-manager__row-title">{book.title}</span>
                      <div className="admin-book-manager__row-meta">
                        <span className={`admin-book-manager__badge admin-book-manager__badge--${getStatusBadge(book.extraction_status)}`}>
                          {getStatusBadge(book.extraction_status)}
                        </span>
                        <span className="admin-book-manager__clone-count">
                          {book.clone_count} clone{book.clone_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {confirmDelete === book.id ? (
                      <div className="admin-book-manager__confirm">
                        <span className="admin-book-manager__confirm-text">Delete everywhere?</span>
                        <button
                          type="button"
                          className="admin-book-manager__confirm-yes"
                          onClick={() => runAction(book.id, 'remove_book', 'Delete everywhere')}
                          disabled={isActing}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className="admin-book-manager__confirm-no"
                          onClick={() => setConfirmDelete(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="admin-book-manager__actions">
                        <button
                          type="button"
                          className="admin-book-manager__action"
                          title="Re-push extractions to all users"
                          onClick={() => runAction(book.id, 'repush', 'Re-push')}
                          disabled={isActing}
                        >
                          {currentAction === 'repush' ? <Loader size={14} className="admin-book-manager__spin" /> : <RefreshCw size={14} />}
                        </button>
                        <button
                          type="button"
                          className="admin-book-manager__action"
                          title="Clear own extractions"
                          onClick={() => runAction(book.id, 'clear_extractions', 'Clear extractions')}
                          disabled={isActing}
                        >
                          {currentAction === 'clear_extractions' ? <Loader size={14} className="admin-book-manager__spin" /> : <Eraser size={14} />}
                        </button>
                        <button
                          type="button"
                          className="admin-book-manager__action"
                          title="Remove from all other users"
                          onClick={() => runAction(book.id, 'remove_clones', 'Remove clones')}
                          disabled={isActing || book.clone_count === 0}
                        >
                          {currentAction === 'remove_clones' ? <Loader size={14} className="admin-book-manager__spin" /> : <UserMinus size={14} />}
                        </button>
                        <button
                          type="button"
                          className="admin-book-manager__action admin-book-manager__action--danger"
                          title="Delete everywhere (original + all clones)"
                          onClick={() => setConfirmDelete(book.id)}
                          disabled={isActing}
                        >
                          {currentAction === 'remove_book' ? <Loader size={14} className="admin-book-manager__spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {books.length === 0 && !loading && (
                <div className="admin-book-manager__empty">No original books found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
