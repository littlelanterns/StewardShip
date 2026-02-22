import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Helm() {
  usePageContext({ page: 'helm' });

  return (
    <div className="page">
      <h1>The Helm</h1>
      <EmptyState
        heading="Full Conversations"
        message="Your dedicated chat space for longer conversations, guided processes, and deep work with the AI. For quick questions, pull up the drawer from any page."
      />
    </div>
  );
}
