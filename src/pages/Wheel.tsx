import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Wheel() {
  usePageContext({ page: 'wheel' });

  return (
    <div className="page">
      <h1>The Wheel</h1>
      <EmptyState
        heading="Change Processes"
        message="For the big changes — character, identity, deep patterns. Each Wheel walks you through a guided process with a hub and six spokes, then periodic check-ins."
      />
    </div>
  );
}
