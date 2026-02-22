import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Reveille() {
  usePageContext({ page: 'reveille' });

  return (
    <div className="page">
      <h1>Reveille</h1>
      <EmptyState
        heading="Morning Briefing"
        message="Start your day grounded. A morning thought from your Mast, today's priorities, active streaks, and a reading from your library."
      />
    </div>
  );
}
