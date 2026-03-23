import { useState, useCallback, useRef } from 'react';
import { Search } from 'lucide-react';
import './SearchFab.css';

interface SearchFabProps {
  onClick: () => void;
}

const SS_KEY = 'manifest-search-fab-pos';

function getDefaultPos(): { x: number; y: number } {
  // Bottom-right, above the main FAB
  return { x: window.innerWidth - 64, y: window.innerHeight - 160 };
}

function loadPos(): { x: number; y: number } {
  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored) {
      const p = JSON.parse(stored);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch { /* */ }
  return getDefaultPos();
}

export function SearchFab({ onClick }: SearchFabProps) {
  const [pos, setPos] = useState(loadPos);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; dragged: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      dragged: false,
    };
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.dragged = true;
    }
    if (dragRef.current.dragged) {
      const newX = Math.max(0, Math.min(window.innerWidth - 44, dragRef.current.startPosX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 44, dragRef.current.startPosY + dy));
      setPos({ x: newX, y: newY });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current) {
      if (!dragRef.current.dragged) {
        onClick();
      } else {
        // Save position
        try { sessionStorage.setItem(SS_KEY, JSON.stringify(pos)); } catch { /* */ }
      }
      dragRef.current = null;
    }
  }, [onClick, pos]);

  return (
    <button
      type="button"
      className="search-fab"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Search library knowledge"
    >
      <Search size={18} />
    </button>
  );
}
