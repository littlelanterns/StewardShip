import { type ReactNode, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import './AddEntryModal.css';

interface AddEntryModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function AddEntryModal({ title, children, onClose }: AddEntryModalProps) {
  // Guard against phantom events from mobile file pickers.
  // When a native file dialog opens/closes on mobile, browsers can fire
  // synthetic mouse/touch events that hit the overlay and close the modal.
  // We suppress overlay dismiss for a short window after any file input interaction.
  const dismissSuppressedUntil = useRef(0);

  useEffect(() => {
    // Listen for file input clicks anywhere inside this modal.
    // When detected, suppress overlay dismiss for 2 seconds to survive
    // the file picker open/close cycle on mobile.
    function handleFileInputClick(e: Event) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') {
        dismissSuppressedUntil.current = Date.now() + 2000;
      }
    }
    // Also suppress on focus return (file picker closing)
    function handleVisibilityChange() {
      if (!document.hidden) {
        // Page became visible again (file picker closed) — extend suppression
        dismissSuppressedUntil.current = Math.max(
          dismissSuppressedUntil.current,
          Date.now() + 500,
        );
      }
    }
    document.addEventListener('click', handleFileInputClick, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('click', handleFileInputClick, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleOverlayDismiss = useCallback((e: React.MouseEvent) => {
    const suppressed = Date.now() < dismissSuppressedUntil.current;
    console.log('[AddEntryModal] overlay dismiss fired', {
      target: (e.target as HTMLElement).className,
      currentTarget: (e.currentTarget as HTMLElement).className,
      suppressed,
      timestamp: Date.now(),
    });
    if (e.target !== e.currentTarget) return;
    if (suppressed) return;
    console.log('[AddEntryModal] overlay dismiss — calling onClose');
    onClose();
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayDismiss}>
      <div className="modal-panel" role="dialog" aria-label={title}>
        <div className="modal-panel__header">
          <h2 className="modal-panel__title">{title}</h2>
          <button className="modal-panel__close" onClick={() => { console.log('[AddEntryModal] X button close fired'); onClose(); }} aria-label="Close">
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
