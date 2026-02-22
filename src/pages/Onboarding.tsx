import { useAuthContext } from '../contexts/AuthContext';
import { Card, EmptyState } from '../components/shared';

export default function Onboarding() {
  const { profile } = useAuthContext();
  const name = profile?.display_name || 'Steward';

  return (
    <div className="page">
      <Card>
        <h1>Welcome aboard, {name}.</h1>
      </Card>

      <EmptyState
        heading="Charting Your Course"
        message="Your onboarding experience is being prepared. Soon you'll set your guiding principles, discover your strengths, and chart your first goals."
      />
    </div>
  );
}
