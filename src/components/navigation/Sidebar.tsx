import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  MessageCircle,
  BookOpen,
  BarChart3,
  Trophy,
  Anchor,
  Brain,
  RefreshCw,
  ClipboardList,
  Map,
  Heart,
  Users,
  ShieldCheck,
  Archive,
  FileText,
  Calendar,
  ListChecks,
  PackageOpen,
  Inbox,
  Sun,
  Moon,
  Settings,
} from 'lucide-react';
import { useHelm } from '../../contexts/HelmContext';
import { useHatchContext } from '../../contexts/HatchContext';
import { useAuthContext } from '../../contexts/AuthContext';
import './Sidebar.css';

export default function Sidebar() {
  const { toggleDrawer, drawerState, startGuidedConversation } = useHelm();
  const { toggleHatch, isOpen: hatchOpen } = useHatchContext();
  const { profile } = useAuthContext();
  const showFirstMate = profile?.relationship_status && profile.relationship_status !== 'single';

  const handleUnloadTheHold = () => {
    startGuidedConversation('unload_the_hold');
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar__brand">
        <h2 className="sidebar__title">StewardShip</h2>
      </div>

      <nav className="sidebar__nav">
        {/* Primary */}
        <ul className="sidebar__group">
          <li>
            <NavLink to="/" end className="sidebar__link">
              <LayoutDashboard size={18} strokeWidth={1.5} />
              <span>Crow's Nest</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/compass" className="sidebar__link">
              <Compass size={18} strokeWidth={1.5} />
              <span>Compass</span>
            </NavLink>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar__link sidebar__link--button ${
                drawerState !== 'closed' ? 'sidebar__link--active' : ''
              }`}
              onClick={toggleDrawer}
            >
              <MessageCircle size={18} strokeWidth={1.5} />
              <span>Helm</span>
            </button>
          </li>
          <li>
            <NavLink to="/log" className="sidebar__link">
              <BookOpen size={18} strokeWidth={1.5} />
              <span>Log</span>
            </NavLink>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar__link sidebar__link--button ${
                hatchOpen ? 'sidebar__link--active' : ''
              }`}
              onClick={toggleHatch}
            >
              <Inbox size={18} strokeWidth={1.5} />
              <span>Hatch</span>
            </button>
          </li>
        </ul>

        {/* Progress & Tracking */}
        <div className="sidebar__section-label">Progress</div>
        <ul className="sidebar__group">
          <li>
            <NavLink to="/charts" className="sidebar__link">
              <BarChart3 size={18} strokeWidth={1.5} />
              <span>Charts</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/victories" className="sidebar__link">
              <Trophy size={18} strokeWidth={1.5} />
              <span>Victories</span>
            </NavLink>
          </li>
        </ul>

        {/* Identity & Growth */}
        <div className="sidebar__section-label">Identity</div>
        <ul className="sidebar__group">
          <li>
            <NavLink to="/mast" className="sidebar__link">
              <Anchor size={18} strokeWidth={1.5} />
              <span>Mast</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/keel" className="sidebar__link">
              <Brain size={18} strokeWidth={1.5} />
              <span>Keel</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/wheel" className="sidebar__link">
              <RefreshCw size={18} strokeWidth={1.5} />
              <span>Wheel</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/life-inventory" className="sidebar__link">
              <ClipboardList size={18} strokeWidth={1.5} />
              <span>Life Inventory</span>
            </NavLink>
          </li>
        </ul>

        {/* Planning & Action */}
        <div className="sidebar__section-label">Planning</div>
        <ul className="sidebar__group">
          <li>
            <button
              type="button"
              className="sidebar__link sidebar__link--button"
              onClick={handleUnloadTheHold}
            >
              <PackageOpen size={18} strokeWidth={1.5} />
              <span>Unload the Hold</span>
            </button>
          </li>
          <li>
            <NavLink to="/rigging" className="sidebar__link">
              <Map size={18} strokeWidth={1.5} />
              <span>Rigging</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/lists" className="sidebar__link">
              <ListChecks size={18} strokeWidth={1.5} />
              <span>Lists</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/meetings" className="sidebar__link">
              <Calendar size={18} strokeWidth={1.5} />
              <span>Meetings</span>
            </NavLink>
          </li>
        </ul>

        {/* Relationships */}
        <div className="sidebar__section-label">Relationships</div>
        <ul className="sidebar__group">
          {showFirstMate && (
            <li>
              <NavLink to="/first-mate" className="sidebar__link">
                <Heart size={18} strokeWidth={1.5} />
                <span>First Mate</span>
              </NavLink>
            </li>
          )}
          <li>
            <NavLink to="/crew" className="sidebar__link">
              <Users size={18} strokeWidth={1.5} />
              <span>Crew</span>
            </NavLink>
          </li>
        </ul>

        {/* Daily Rhythms */}
        <div className="sidebar__section-label">Daily Rhythms</div>
        <ul className="sidebar__group">
          <li>
            <NavLink to="/reveille" className="sidebar__link">
              <Sun size={18} strokeWidth={1.5} />
              <span>Reveille</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/reckoning" className="sidebar__link">
              <Moon size={18} strokeWidth={1.5} />
              <span>Reckoning</span>
            </NavLink>
          </li>
        </ul>

        {/* Resources */}
        <div className="sidebar__section-label">Resources</div>
        <ul className="sidebar__group">
          <li>
            <NavLink to="/safe-harbor" className="sidebar__link">
              <ShieldCheck size={18} strokeWidth={1.5} />
              <span>Safe Harbor</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/manifest" className="sidebar__link">
              <Archive size={18} strokeWidth={1.5} />
              <span>Manifest</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/reports" className="sidebar__link">
              <FileText size={18} strokeWidth={1.5} />
              <span>Reports</span>
            </NavLink>
          </li>
        </ul>

        {/* Settings */}
        <ul className="sidebar__group sidebar__group--bottom">
          <li>
            <NavLink to="/settings" className="sidebar__link">
              <Settings size={18} strokeWidth={1.5} />
              <span>Settings</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
