import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Crew() {
  usePageContext({ page: 'crew' });

  return (
    <div className="page">
      <h1>Crew</h1>
      <EmptyState
        heading="People Profiles"
        message="Your people — family, friends, colleagues, mentors. Add context about each person so the AI can help you navigate relationships wisely."
      />
    </div>
  );
}
