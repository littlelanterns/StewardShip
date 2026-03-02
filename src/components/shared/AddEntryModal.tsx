import { type ReactNode, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import './AddEntryModal.css';

interface AddEntryModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** When true, overlay-click dismiss is completely disabled (e.g. during file upload). */
  suppressDismiss?: boolean;
}

export function AddEntryModal({ title, children, onClose, suppressDismiss }: AddEntryModalProps) {
  // Guard against phantom events from mobile file pickers.
  // When a native file dialog opens/closes on mobile, browsers can fire
  // synthetic mouse/touch events that hit the overlay and close the modal.
  const dismissSuppressedUntil = useRef(0);

  useEffect(() => {
    // Suppress on page visibility return (file picker closing on mobile)
    function handleVisibilityChange() {
      if (!document.hidden) {
        dismissSuppressedUntil.current = Math.max(
          dismissSuppressedUntil.current,
          Date.now() + 1500,
        );
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Overlay dismiss temporarily disabled for mobile file picker debugging.
  // Only the X button closes the modal.
  void suppressDismiss; // keep prop used
  void dismissSuppressedUntil; // keep ref used

  return (
    <div className="modal-overlay">
      <div className="modal-panel" role="dialog" aria-label={title}>
        <div className="modal-panel__header">
          <h2 className="modal-panel__title">{title}</h2>
          <button className="modal-panel__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-panel__body">
          {children}
        </div>
      </div>
    </div>
  );
}
