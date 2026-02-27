import { useEffect, useState } from 'react';
import './SparkleOverlay.css';

interface SparkleOverlayProps {
  show: boolean;
  size?: 'quick' | 'full';
  onComplete?: () => void;
}

const QUICK_PARTICLES = 8;
const FULL_PARTICLES = 24;
const QUICK_DURATION = 800;
const FULL_DURATION = 1600;

export function SparkleOverlay({ show, size = 'quick', onComplete }: SparkleOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const duration = size === 'quick' ? QUICK_DURATION : FULL_DURATION;
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, size, onComplete]);

  if (!visible) return null;

  const count = size === 'quick' ? QUICK_PARTICLES : FULL_PARTICLES;
  const angleStep = 360 / count;
  const isQuick = size === 'quick';

  return (
    <div className={`sparkle-overlay sparkle-overlay--${size}`}>
      <div className="sparkle-overlay__burst">
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className="sparkle-overlay__particle"
            style={{
              '--angle': `${i * angleStep}deg`,
              '--delay': `${Math.random() * (isQuick ? 0.15 : 0.3)}s`,
              '--distance': `${(isQuick ? 40 : 60) + Math.random() * (isQuick ? 60 : 100)}px`,
              '--size': `${(isQuick ? 3 : 4) + Math.random() * (isQuick ? 4 : 6)}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={`sparkle-overlay__ring sparkle-overlay__ring--${size}`} />
    </div>
  );
}
