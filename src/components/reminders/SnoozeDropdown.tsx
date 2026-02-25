import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { SnoozePreset } from '../../lib/types';
import { SNOOZE_PRESET_LABELS } from '../../lib/types';

interface SnoozeDropdownProps {
  onSnooze: (preset: SnoozePreset) => void;
  snoozeCount: number;
}

export function SnoozeDropdown({ onSnooze, snoozeCount }: SnoozeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="snooze-dropdown" ref={ref}>
      <button
        type="button"
        className="snooze-dropdown__trigger"
        onClick={() => setOpen(!open)}
        aria-label="Snooze"
        title={snoozeCount >= 2 ? 'Last snooze — will dismiss after this' : 'Snooze'}
      >
        <Clock size={14} />
      </button>
      {open && (
        <div className="snooze-dropdown__menu">
          {snoozeCount >= 2 && (
            <div className="snooze-dropdown__warning">Last snooze available</div>
          )}
          {(Object.keys(SNOOZE_PRESET_LABELS) as SnoozePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              className="snooze-dropdown__item"
              onClick={() => { onSnooze(preset); setOpen(false); }}
            >
              {SNOOZE_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
