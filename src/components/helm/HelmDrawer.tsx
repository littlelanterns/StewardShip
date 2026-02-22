import { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import { useHelm } from '../../contexts/HelmContext';
import './HelmDrawer.css';

export default function HelmDrawer() {
  const { drawerState, closeDrawer, expandDrawer, setDrawerState } = useHelm();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartState = useRef(drawerState);

  const handleExpandToFullPage = useCallback(() => {
    closeDrawer();
    navigate('/helm');
  }, [closeDrawer, navigate]);

  // Close on Escape
  useEffect(() => {
    if (drawerState === 'closed') return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerState, closeDrawer]);

  // Touch drag handling
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      dragStartState.current = drawerState;
    },
    [drawerState],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - dragStartY.current;
      dragStartY.current = null;

      const threshold = 60;

      if (deltaY < -threshold) {
        // Swiped up
        if (dragStartState.current === 'closed') setDrawerState('peek');
        else if (dragStartState.current === 'peek') expandDrawer();
      } else if (deltaY > threshold) {
        // Swiped down
        if (dragStartState.current === 'full') setDrawerState('peek');
        else if (dragStartState.current === 'peek') closeDrawer();
      }
    },
    [setDrawerState, expandDrawer, closeDrawer],
  );

  const handleHandleClick = useCallback(() => {
    if (drawerState === 'closed') setDrawerState('peek');
    else if (drawerState === 'peek') closeDrawer();
    else closeDrawer();
  }, [drawerState, setDrawerState, closeDrawer]);

  return (
    <>
      {/* Backdrop for peek/full states */}
      {drawerState !== 'closed' && (
        <div
          className="helm-drawer__backdrop"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        className={`helm-drawer helm-drawer--${drawerState}`}
        role="dialog"
        aria-label="Helm chat drawer"
        aria-hidden={drawerState === 'closed'}
      >
        {/* Drag handle */}
        <div
          className="helm-drawer__handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleClick}
          role="button"
          tabIndex={0}
          aria-label={drawerState === 'closed' ? 'Open Helm chat' : 'Close Helm chat'}
        >
          <div className="helm-drawer__handle-bar" />
        </div>

        {/* Header with controls */}
        {drawerState !== 'closed' && (
          <div className="helm-drawer__header">
            <h3 className="helm-drawer__title">The Helm</h3>
            <div className="helm-drawer__controls">
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={handleExpandToFullPage}
                aria-label="Expand to full page"
              >
                <Maximize2 size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="helm-drawer__control-btn"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Chat content placeholder */}
        {drawerState !== 'closed' && (
          <div className="helm-drawer__content">
            <div className="helm-drawer__messages">
              <p className="helm-drawer__placeholder">
                How can I help you navigate today?
              </p>
            </div>

            {/* Input bar placeholder */}
            <div className="helm-drawer__input-bar">
              <input
                type="text"
                className="helm-drawer__input"
                placeholder="Ask the Helm..."
                disabled
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
