import { useEffect, useMemo, useCallback } from 'react';
import { X, BookOpen, Copy } from 'lucide-react';
import './CelebrationModal.css';

interface CelebrationModalProps {
  open: boolean;
  loading: boolean;
  narrative: string | null;
  period: string;
  accomplishmentCount: number;
  onSaveToLog: () => void;
  onCopy: () => void;
  onDismiss: () => void;
}

const FIREWORK_PARTICLES = 14;
const RAIN_PARTICLES = 35;

function generateFireworkParticles(count: number) {
  const angleStep = (2 * Math.PI) / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * angleStep;
    const distance = 50 + Math.random() * 60;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      xMid: Math.cos(angle) * distance * 0.5,
      yMid: Math.sin(angle) * distance * 0.5,
      size: 3 + Math.random() * 4,
      delay: Math.random() * 0.15,
    };
  });
}

function generateRainParticles(count: number) {
  return Array.from({ length: count }, () => ({
    left: 5 + Math.random() * 90,
    size: 3 + Math.random() * 2,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 3,
    sway: -15 + Math.random() * 30,
  }));
}

export function CelebrationModal({
  open,
  loading,
  narrative,
  period,
  accomplishmentCount,
  onSaveToLog,
  onCopy,
  onDismiss,
}: CelebrationModalProps) {
  const fireworkSets = useMemo(
    () => [
      generateFireworkParticles(FIREWORK_PARTICLES),
      generateFireworkParticles(FIREWORK_PARTICLES),
      generateFireworkParticles(FIREWORK_PARTICLES),
    ],
    // regenerate on each open
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const rainParticles = useMemo(
    () => generateRainParticles(RAIN_PARTICLES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onDismiss]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onDismiss();
    },
    [onDismiss]
  );

  if (!open) return null;

  const showRain = loading || !narrative;

  return (
    <div className="celebration-modal__overlay" onClick={handleOverlayClick}>
      <div className="celebration-modal" role="dialog" aria-label="Celebration">
        {/* Header */}
        <div className="celebration-modal__header">
          <div className="celebration-modal__header-content">
            <h2 className="celebration-modal__title">Celebrating Your Victories</h2>
            <p className="celebration-modal__meta">
              {period} — {accomplishmentCount}{' '}
              {accomplishmentCount === 1 ? 'accomplishment' : 'accomplishments'}
            </p>
          </div>
          <button
            type="button"
            className="celebration-modal__close"
            onClick={onDismiss}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="celebration-modal__body">
          {/* Firework bursts */}
          <div className="celebration-modal__fireworks">
            {fireworkSets.map((particles, burstIdx) => (
              <div
                key={burstIdx}
                className={`firework-burst firework-burst--${burstIdx + 1}`}
              >
                {particles.map((p, i) => (
                  <span
                    key={i}
                    className="firework-burst__particle"
                    style={
                      {
                        '--fw-x': `${p.x}px`,
                        '--fw-y': `${p.y}px`,
                        '--fw-x-mid': `${p.xMid}px`,
                        '--fw-y-mid': `${p.yMid}px`,
                        '--fw-size': `${p.size}px`,
                        '--fw-delay': `${p.delay}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Raining gold sparkles */}
          <div
            className={`celebration-modal__rain ${!showRain ? 'celebration-modal__rain--fading' : ''}`}
          >
            {rainParticles.map((p, i) => (
              <span
                key={i}
                className="rain-particle"
                style={
                  {
                    left: `${p.left}%`,
                    '--rain-size': `${p.size}px`,
                    '--rain-duration': `${p.duration}s`,
                    '--rain-delay': `${p.delay}s`,
                    '--rain-sway': `${p.sway}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="celebration-modal__loading">
              <span className="celebration-modal__loading-text">
                Reflecting on your accomplishments...
              </span>
            </div>
          )}

          {/* Narrative */}
          {narrative && !loading && (
            <div className="celebration-modal__narrative">
              <p className="celebration-modal__narrative-text">{narrative}</p>
            </div>
          )}
        </div>

        {/* Actions — only shown after narrative loaded */}
        {narrative && !loading && (
          <div className="celebration-modal__actions">
            <button
              type="button"
              className="celebration-modal__action-btn"
              onClick={onSaveToLog}
            >
              <BookOpen size={14} /> Save to Journal
            </button>
            <button
              type="button"
              className="celebration-modal__action-btn"
              onClick={onCopy}
            >
              <Copy size={14} /> Copy
            </button>
            <button
              type="button"
              className="celebration-modal__action-btn celebration-modal__action-btn--dismiss"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
