import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Meetings() {
  usePageContext({ page: 'meetings' });

  return (
    <div className="page">
      <h1>Meeting Frameworks</h1>
      <EmptyState
        heading="Structured Meetings"
        message="Couple meetings, parent-child mentoring, personal reviews, and business reviews — all guided by AI with structured agendas and follow-through."
      />
    </div>
  );
}
