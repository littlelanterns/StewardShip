import { useState, useCallback, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  BookOpen,
  Menu,
  Library,
  Archive,
  Layers,
  Heart,
  X,
} from 'lucide-react';
import './BottomTabBar.css';

interface BottomTabBarProps {
  onMorePress: () => void;
  moreOpen: boolean;
}

export default function BottomTabBar({ onMorePress, moreOpen }: BottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [arcOpen, setArcOpen] = useState(false);

  const isLibraryActive = location.pathname === '/manifest' || location.pathname.startsWith('/library/');

  // Close arc menu on navigation
  useEffect(() => {
    setArcOpen(false);
  }, [location.pathname]);

  const toggleArc = useCallback(() => {
    setArcOpen((prev) => !prev);
  }, []);

  const handleArcOption = useCallback((path: string) => {
    setArcOpen(false);
    navigate(path);
  }, [navigate]);

  return (
    <>
      {/* Arc menu backdrop */}
      {arcOpen && (
        <div
          className="bottom-tab-bar__arc-backdrop"
          onClick={() => setArcOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="bottom-tab-bar" aria-label="Main navigation">
        <NavLink to="/" end className="bottom-tab-bar__tab">
          <LayoutDashboard size={22} strokeWidth={1.5} />
          <span className="bottom-tab-bar__label">Crow's Nest</span>
        </NavLink>

        <NavLink to="/compass" className="bottom-tab-bar__tab">
          <Compass size={22} strokeWidth={1.5} />
          <span className="bottom-tab-bar__label">Compass</span>
        </NavLink>

        {/* Library center button with arc menu */}
        <div className="bottom-tab-bar__center-wrapper">
          {/* Arc menu options */}
          <div className={`bottom-tab-bar__arc ${arcOpen ? 'bottom-tab-bar__arc--open' : ''}`}>
            <button
              type="button"
              className="bottom-tab-bar__arc-option"
              onClick={() => handleArcOption('/manifest')}
              aria-label="Manifest"
            >
              <span className="bottom-tab-bar__arc-icon">
                <Archive size={18} strokeWidth={1.5} />
              </span>
              <span className="bottom-tab-bar__arc-label">Manifest</span>
            </button>
            <button
              type="button"
              className="bottom-tab-bar__arc-option"
              onClick={() => handleArcOption('/library/extractions')}
              aria-label="Extractions"
            >
              <span className="bottom-tab-bar__arc-icon">
                <Layers size={18} strokeWidth={1.5} />
              </span>
              <span className="bottom-tab-bar__arc-label">Extractions</span>
            </button>
            <button
              type="button"
              className="bottom-tab-bar__arc-option"
              onClick={() => handleArcOption('/library/favorites')}
              aria-label="Favorites"
            >
              <span className="bottom-tab-bar__arc-icon">
                <Heart size={18} strokeWidth={1.5} />
              </span>
              <span className="bottom-tab-bar__arc-label">Favorites</span>
            </button>
          </div>

          <button
            type="button"
            className={`bottom-tab-bar__tab bottom-tab-bar__tab--library ${
              isLibraryActive || arcOpen ? 'bottom-tab-bar__tab--active' : ''
            }`}
            onClick={toggleArc}
            aria-label="Library menu"
          >
            <span className="bottom-tab-bar__library-icon">
              {arcOpen ? <X size={24} strokeWidth={1.5} /> : <Library size={24} strokeWidth={1.5} />}
            </span>
            <span className="bottom-tab-bar__label">Library</span>
          </button>
        </div>

        <NavLink to="/journal" className="bottom-tab-bar__tab">
          <BookOpen size={22} strokeWidth={1.5} />
          <span className="bottom-tab-bar__label">Journal</span>
        </NavLink>

        <button
          type="button"
          className={`bottom-tab-bar__tab ${moreOpen ? 'bottom-tab-bar__tab--active' : ''}`}
          onClick={onMorePress}
          aria-label="More menu"
        >
          <Menu size={22} strokeWidth={1.5} />
          <span className="bottom-tab-bar__label">More</span>
        </button>
      </nav>
    </>
  );
}
