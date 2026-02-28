import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  MessageCircle,
  BookOpen,
  Menu,
} from 'lucide-react';
import { useHelm } from '../../contexts/HelmContext';
import './BottomTabBar.css';

interface BottomTabBarProps {
  onMorePress: () => void;
  moreOpen: boolean;
}

export default function BottomTabBar({ onMorePress, moreOpen }: BottomTabBarProps) {
  const { toggleDrawer, drawerState } = useHelm();

  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      <NavLink to="/" end className="bottom-tab-bar__tab">
        <LayoutDashboard size={22} strokeWidth={1.5} />
        <span className="bottom-tab-bar__label">Crow's Nest</span>
      </NavLink>

      <NavLink to="/compass" className="bottom-tab-bar__tab">
        <Compass size={22} strokeWidth={1.5} />
        <span className="bottom-tab-bar__label">Compass</span>
      </NavLink>

      <button
        type="button"
        className={`bottom-tab-bar__tab bottom-tab-bar__tab--helm ${
          drawerState !== 'closed' ? 'bottom-tab-bar__tab--active' : ''
        }`}
        onClick={toggleDrawer}
        aria-label="Toggle Helm chat"
      >
        <span className="bottom-tab-bar__helm-icon">
          <MessageCircle size={24} strokeWidth={1.5} />
        </span>
        <span className="bottom-tab-bar__label">Helm</span>
      </button>

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
  );
}
