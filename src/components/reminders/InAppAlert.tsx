import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import './Reminders.css';

interface InAppAlertProps {
  title: string;
  body?: string;
  onDismiss: () => void;
  onClick?: () => void;
  autoDismissMs?: number;
}

export function InAppAlert({
  title,
  body,
  onDismiss,
  onClick,
  autoDismissMs = 8000,
}: InAppAlertProps) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, handleDismiss]);

  return (
    <div
      className={`in-app-alert ${exiting ? 'in-app-alert--exiting' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="in-app-alert__content">
        <div className="in-app-alert__title">{title}</div>
        {body && <div className="in-app-alert__body">{body}</div>}
      </div>
      <button
        type="button"
        className="in-app-alert__dismiss"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
