import { X } from 'lucide-react';
import { Button } from '../shared/Button';
import './VictoryPrompt.css';

interface VictoryPromptProps {
  taskTitle: string;
  onYes: () => void;
  onDismiss: () => void;
}

export function VictoryPrompt({ taskTitle, onYes, onDismiss }: VictoryPromptProps) {
  return (
    <div className="victory-prompt">
      <div className="victory-prompt__content">
        <p className="victory-prompt__text">
          Is this a victory worth recording?
        </p>
        <p className="victory-prompt__task">{taskTitle}</p>
        <div className="victory-prompt__actions">
          <Button onClick={onYes} className="victory-prompt__yes">Record Victory</Button>
          <button type="button" className="victory-prompt__dismiss" onClick={onDismiss} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
