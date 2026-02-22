import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Reckoning() {
  usePageContext({ page: 'reckoning' });

  return (
    <div className="page">
      <h1>Reckoning</h1>
      <EmptyState
        heading="Evening Review"
        message="Reflect on the day. Review what you accomplished, capture victories, set tomorrow's priorities, and close with a thought from your Mast."
      />
    </div>
  );
}
