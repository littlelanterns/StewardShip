import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Manifest() {
  usePageContext({ page: 'manifest' });

  return (
    <div className="page">
      <h1>The Manifest</h1>
      <EmptyState
        heading="Knowledge Base"
        message="Upload books, articles, notes, and transcripts. The AI draws from your library to give you advice grounded in the wisdom you trust."
      />
    </div>
  );
}
