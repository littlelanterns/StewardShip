import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  heading: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ heading, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <h3 className="empty-state__heading">{heading}</h3>
      {message && <p className="empty-state__message">{message}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
