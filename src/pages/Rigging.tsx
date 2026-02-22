import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Rigging() {
  usePageContext({ page: 'rigging' });

  return (
    <div className="page">
      <h1>Rigging</h1>
      <EmptyState
        heading="Planning"
        message="For goals and projects bigger than a single task. Create plans with milestones, break them into tasks, and track progress over time."
      />
    </div>
  );
}
