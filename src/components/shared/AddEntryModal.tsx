import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import './AddEntryModal.css';

interface AddEntryModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function AddEntryModal({ title, children, onClose }: AddEntryModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
