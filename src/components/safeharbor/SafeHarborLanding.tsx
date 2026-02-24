import { Button } from '../shared';
import './SafeHarborLanding.css';

interface SafeHarborLandingProps {
  onStartConversation: () => void;
}

export function SafeHarborLanding({ onStartConversation }: SafeHarborLandingProps) {
  return (
    <div className="safe-harbor-landing">
      <div className="safe-harbor-landing__content">
        <h1 className="safe-harbor-landing__heading">Safe Harbor</h1>
        <p className="safe-harbor-landing__subtext">
          A space to process what's heavy. No judgment. No agenda.
        </p>

        <div className="safe-harbor-landing__reassurance">
          <p>Whatever you bring here stays here.</p>
          <p>There's no wrong way to start.</p>
          <p>Take your time.</p>
        </div>

        <Button
          onClick={onStartConversation}
          className="safe-harbor-landing__cta"
        >
          Start a Conversation
        </Button>
      </div>
    </div>
  );
}
