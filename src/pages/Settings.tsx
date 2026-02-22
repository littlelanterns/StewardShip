import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function Settings() {
  usePageContext({ page: 'settings' });

  return (
    <div className="page">
      <h1>Settings</h1>
      <EmptyState
        heading="Configuration"
        message="Account, AI preferences, daily rhythms, notifications, meeting schedules, and data management. All in one place."
      />
    </div>
  );
}
