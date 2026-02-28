import { useEffect, useState, useCallback } from 'react';
import { X, Copy, Trash2 } from 'lucide-react';
import { useCelebrationArchive } from '../../hooks/useCelebrationArchive';
import './CelebrationArchive.css';

interface CelebrationArchiveProps {
  onClose: () => void;
}

export function CelebrationArchive({ onClose }: CelebrationArchiveProps) {
  const { celebrations, loading, fetchCelebrations, deleteCelebration } = useCelebrationArchive();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchCelebrations();
  }, [fetchCelebrations]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Copied to clipboard');
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCelebration(id);
    setConfirmDeleteId(null);
  }, [deleteCelebration]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className="celebration-archive__overlay" onClick={handleOverlayClick}>
      <div className="celebration-archive" role="dialog" aria-label="Past Celebrations">
        <div className="celebration-archive__header">
          <h2 className="celebration-archive__title">Past Celebrations</h2>
          <button
            type="button"
            className="celebration-archive__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="celebration-archive__body">
          {loading ? (
            <div className="celebration-archive__loading">Loading...</div>
          ) : celebrations.length === 0 ? (
            <div className="celebration-archive__empty">
              No celebrations yet. Record some victories and celebrate!
            </div>
          ) : (
            celebrations.map((c) => (
              <div key={c.id} className="celebration-archive__card">
                <div className="celebration-archive__card-header">
                  <div className="celebration-archive__card-meta">
                    <span className="celebration-archive__card-period">{c.period}</span>
                    <span className="celebration-archive__card-date">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <span className="celebration-archive__card-count">
                    {c.accomplishment_count}{' '}
                    {c.accomplishment_count === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <p className="celebration-archive__card-narrative">{c.narrative}</p>

                <div className="celebration-archive__card-actions">
                  <button
                    type="button"
                    className="celebration-archive__card-btn"
                    onClick={() => handleCopy(c.narrative)}
                  >
                    <Copy size={12} /> Copy
                  </button>

                  {confirmDeleteId === c.id ? (
                    <div className="celebration-archive__confirm">
                      <span>Delete?</span>
                      <button
                        type="button"
                        className="celebration-archive__confirm-btn celebration-archive__confirm-btn--yes"
                        onClick={() => handleDelete(c.id)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="celebration-archive__confirm-btn celebration-archive__confirm-btn--no"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="celebration-archive__card-btn celebration-archive__card-btn--delete"
                      onClick={() => setConfirmDeleteId(c.id)}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {toast && <div className="victories__toast">{toast}</div>}
      </div>
    </div>
  );
}
