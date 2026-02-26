import { useEffect } from 'react';
import { EmptyState, LoadingSpinner } from '../../shared';
import { Button } from '../../shared/Button';
import { Card } from '../../shared/Card';
import type { List } from '../../../lib/types';
import { LIST_TYPE_LABELS, RESET_SCHEDULE_LABELS } from '../../../lib/types';
import './ListsMain.css';

interface ListsMainProps {
  lists: List[];
  loading: boolean;
  error: string | null;
  onFetchLists: () => void;
  onListClick: (list: List) => void;
  onCreateClick: () => void;
}

export default function ListsMain({
  lists,
  loading,
  error,
  onFetchLists,
  onListClick,
  onCreateClick,
}: ListsMainProps) {
  useEffect(() => {
    onFetchLists();
  }, [onFetchLists]);

  if (loading && lists.length === 0) {
    return (
      <div className="lists-main__loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        heading="Something went wrong"
        message={error}
        action={<Button onClick={onFetchLists}>Try again</Button>}
      />
    );
  }

  if (lists.length === 0) {
    return (
      <EmptyState
        heading="No lists yet"
        message="Create one to get started."
        action={<Button onClick={onCreateClick}>New List</Button>}
      />
    );
  }

  return (
    <div className="lists-main">
      {lists.map((list) => (
        <button
          key={list.id}
          type="button"
          className="lists-main__card-btn"
          onClick={() => onListClick(list)}
        >
          <Card className="lists-main__card">
            <div className="lists-main__card-header">
              <span className="lists-main__card-title">{list.title}</span>
              <div className="lists-main__card-badges">
                <span className="lists-main__card-badge">
                  {LIST_TYPE_LABELS[list.list_type]}
                </span>
                {list.list_type === 'routine' && list.reset_schedule && (
                  <span className="lists-main__card-badge lists-main__card-badge--schedule">
                    {RESET_SCHEDULE_LABELS[list.reset_schedule]}
                  </span>
                )}
              </div>
            </div>
            <div className="lists-main__card-meta">
              <span className="lists-main__card-date">
                Updated {new Date(list.updated_at).toLocaleDateString()}
              </span>
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
