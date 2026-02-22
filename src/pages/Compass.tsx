import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Compass() {
  usePageContext({ page: 'compass' });

  return (
    <div className="page">
      <h1>The Compass</h1>
      <EmptyState
        heading="Task Management"
        message="Your tasks and prioritization views will appear here. Multiple frameworks to view the same tasks — Eisenhower, Eat the Frog, 1/3/9, Big Rocks, Ivy Lee, and more."
      />
    </div>
  );
}
