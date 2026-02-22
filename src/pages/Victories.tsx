import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Victories() {
  usePageContext({ page: 'victories' });

  return (
    <div className="page">
      <h1>Victory Recorder</h1>
      <EmptyState
        heading="Accomplishments"
        message="Record and revisit your wins. Victories are tied to your identity and principles — not just what you did, but who you are becoming."
      />
    </div>
  );
}
