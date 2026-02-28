import { useEffect, useRef } from 'react';
import './HatchUndoToast.css';

interface HatchUndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function HatchUndoToast({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}: HatchUndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss, duration]);

  return (
    <div className="hatch-undo-toast" style={{ position: 'relative' }}>
      <span className="hatch-undo-toast__message">{message}</span>
      <button
        type="button"
        className="hatch-undo-toast__btn"
        onClick={onUndo}
      >
        Undo
      </button>
      <div className="hatch-undo-toast__progress" />
    </div>
  );
}
