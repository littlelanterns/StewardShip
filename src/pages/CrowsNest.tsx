import { useAuthContext } from '../contexts/AuthContext';
import { Button, Card, EmptyState } from '../components/shared';
import './CrowsNest.css';

function getGreeting(timezone: string): string {
  try {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(hour, 10);
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  } catch {
    return 'Welcome aboard';
  }
}

export default function CrowsNest() {
  const { profile, signOut } = useAuthContext();
  const greeting = getGreeting(profile?.timezone || 'America/Chicago');
  const name = profile?.display_name || 'Steward';

  return (
    <div className="page crowsnest">
      <Card>
        <h1 className="crowsnest__greeting">
          {greeting}, {name}.
        </h1>
        <p className="crowsnest__subtitle">Your voyage starts here.</p>
      </Card>

      <EmptyState
        heading="The Crow's Nest"
        message="Your command center is taking shape. As you add entries, tasks, and goals, this dashboard will come alive."
      />

      <div className="crowsnest__signout">
        <Button variant="text" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
