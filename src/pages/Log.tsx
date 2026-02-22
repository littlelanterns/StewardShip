import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Log() {
  usePageContext({ page: 'log' });

  return (
    <div className="page">
      <h1>The Log</h1>
      <EmptyState
        heading="Journal and Commonplace Book"
        message="Capture anything — thoughts, quotes, observations, notes. Entries can be routed to tasks, principles, victories, or simply kept as a journal record."
      />
    </div>
  );
}
