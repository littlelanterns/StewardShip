import { useState, useCallback } from 'react';
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
  Clock,
  ChevronDown,
  Lightbulb,
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

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed-sections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      localStorage.setItem('sidebar-collapsed-sections', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleUnloadTheHold = () => {
    startGuidedConversation('unload_the_hold');
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar__brand">
        <h2 className="sidebar__title">StewardShip</h2>
      </div>

      <nav className="sidebar__nav">
        {/* Primary — always visible */}
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
            <NavLink to="/journal" className="sidebar__link">
              <BookOpen size={18} strokeWidth={1.5} />
              <span>Journal</span>
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
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('progress')}
          aria-expanded={!collapsedSections.has('progress')}
        >
          <span>Progress</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('progress') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('progress') && (
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
        )}

        {/* Identity & Growth */}
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('identity')}
          aria-expanded={!collapsedSections.has('identity')}
        >
          <span>Identity</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('identity') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('identity') && (
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
        )}

        {/* Planning & Action */}
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('planning')}
          aria-expanded={!collapsedSections.has('planning')}
        >
          <span>Planning</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('planning') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('planning') && (
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
        )}

        {/* Relationships */}
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('relationships')}
          aria-expanded={!collapsedSections.has('relationships')}
        >
          <span>Relationships</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('relationships') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('relationships') && (
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
        )}

        {/* Daily Rhythms */}
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('rhythms')}
          aria-expanded={!collapsedSections.has('rhythms')}
        >
          <span>Daily Rhythms</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('rhythms') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('rhythms') && (
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
        )}

        {/* Resources */}
        <button
          type="button"
          className="sidebar__section-toggle"
          onClick={() => toggleSection('resources')}
          aria-expanded={!collapsedSections.has('resources')}
        >
          <span>Resources</span>
          <ChevronDown
            size={14}
            className={`sidebar__section-chevron ${collapsedSections.has('resources') ? 'sidebar__section-chevron--collapsed' : ''}`}
          />
        </button>
        {!collapsedSections.has('resources') && (
          <ul className="sidebar__group">
            <li>
              <NavLink to="/safe-harbor" className="sidebar__link">
                <ShieldCheck size={18} strokeWidth={1.5} />
                <span>Safe Harbor</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reflections" className="sidebar__link">
                <Lightbulb size={18} strokeWidth={1.5} />
                <span>Reflect</span>
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
            <li>
              <NavLink to="/log" className="sidebar__link">
                <Clock size={18} strokeWidth={1.5} />
                <span>Activity Log</span>
              </NavLink>
            </li>
          </ul>
        )}

        {/* Settings — always visible */}
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
