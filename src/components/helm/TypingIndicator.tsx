import './TypingIndicator.css';

export default function TypingIndicator() {
  return (
    <div className="typing-indicator" aria-label="AI is thinking">
      <span className="typing-indicator__dot" />
      <span className="typing-indicator__dot" />
      <span className="typing-indicator__dot" />
    </div>
  );
}
