import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function FirstMate() {
  usePageContext({ page: 'firstmate' });

  return (
    <div className="page">
      <h1>First Mate</h1>
      <EmptyState
        heading="Spouse Profile and Relationship Tools"
        message="Build a rich understanding of your spouse through conversation, uploads, and guided prompts. The AI uses this context to help you love well."
      />
    </div>
  );
}
