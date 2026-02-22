import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Charts() {
  usePageContext({ page: 'charts' });

  return (
    <div className="page">
      <h1>Charts</h1>
      <EmptyState
        heading="Progress Tracking"
        message="Visualize your streaks, completion rates, and growth trends. Charts will come alive as you add tasks, habits, and goals."
      />
    </div>
  );
}
