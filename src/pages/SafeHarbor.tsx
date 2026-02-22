import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function SafeHarbor() {
  usePageContext({ page: 'safeharbor' });

  return (
    <div className="page">
      <h1>Safe Harbor</h1>
      <EmptyState
        heading="Stress Relief and Advice"
        message="When things get hard, Safe Harbor provides a space to process. Validation first, frameworks second, action when you are ready."
      />
    </div>
  );
}
