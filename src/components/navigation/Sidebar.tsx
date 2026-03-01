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
            <NavLink to="/" end className="sidebar__link" title="Your daily dashboard — tasks, victories, streaks, and priorities at a glance">
              <LayoutDashboard size={18} strokeWidth={1.5} />
              <span>Crow's Nest</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/compass" className="sidebar__link" title="Task management with 7 prioritization views — add tasks, track what's due, carry forward">
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
              title="AI conversation partner — talk through goals, get coaching, process decisions"
            >
              <MessageCircle size={18} strokeWidth={1.5} />
              <span>Helm</span>
            </button>
          </li>
          <li>
            <NavLink to="/journal" className="sidebar__link" title="Journal entries, gratitude, reflections, quick notes, and voice recordings">
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
              title="Universal capture notepad — jot anything down, then route to tasks, journal, or anywhere else"
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
              <NavLink to="/charts" className="sidebar__link" title="Track progress — task completion, streaks, goals, custom trackers, and victory summaries">
                <BarChart3 size={18} strokeWidth={1.5} />
                <span>Charts</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/victories" className="sidebar__link" title="All your accomplishments — completed tasks and recorded victories with AI-generated narratives">
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
              <NavLink to="/mast" className="sidebar__link" title="Your guiding principles — values, declarations, faith foundations, scriptures, and vision statements">
                <Anchor size={18} strokeWidth={1.5} />
                <span>Mast</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/keel" className="sidebar__link" title="Self-knowledge — personality assessments, traits, strengths, and growth areas">
                <Brain size={18} strokeWidth={1.5} />
                <span>Keel</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/wheel" className="sidebar__link" title="Deep change process — 6 spokes guiding why, when, self-inventory, support, evidence, and becoming">
                <RefreshCw size={18} strokeWidth={1.5} />
                <span>Wheel</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/life-inventory" className="sidebar__link" title="Assess where you are across life areas — spiritual, marriage, family, health, career, and more">
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
                title="Brain dump — pour out everything on your mind, then AI sorts and routes items"
              >
                <PackageOpen size={18} strokeWidth={1.5} />
                <span>Unload the Hold</span>
              </button>
            </li>
            <li>
              <NavLink to="/rigging" className="sidebar__link" title="Planning tool for goals and projects — 5 AI frameworks including MoSCoW and Milestone Mapping">
                <Map size={18} strokeWidth={1.5} />
                <span>Rigging</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/lists" className="sidebar__link" title="Lightweight collections — shopping, wishlists, expenses, routines, to-do, and custom lists">
                <ListChecks size={18} strokeWidth={1.5} />
                <span>Lists</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/meetings" className="sidebar__link" title="Structured recurring meetings guided by AI — couple, parent-child, mentor, reviews, and custom">
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
                <NavLink to="/first-mate" className="sidebar__link" title="Your spouse/partner — store insights, use the Marriage Toolbox and Cyrano communication coach">
                  <Heart size={18} strokeWidth={1.5} />
                  <span>First Mate</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to="/crew" className="sidebar__link" title="Your people directory — family, friends, mentors, colleagues with context for AI conversations">
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
              <NavLink to="/reveille" className="sidebar__link" title="Morning briefing — today's priorities, Mast thought, streaks, trackers, and a library reading">
                <Sun size={18} strokeWidth={1.5} />
                <span>Reveille</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reckoning" className="sidebar__link" title="Evening review — accomplishments, victory celebration, carry forward tasks, set tomorrow's priorities">
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
              <NavLink to="/safe-harbor" className="sidebar__link" title="Stress relief and support — AI switches to validation-first mode when you're overwhelmed">
                <ShieldCheck size={18} strokeWidth={1.5} />
                <span>Safe Harbor</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reflections" className="sidebar__link" title="Daily reflection questions — contemplate a rotating question and build a collection of responses">
                <Lightbulb size={18} strokeWidth={1.5} />
                <span>Reflect</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/manifest" className="sidebar__link" title="Your knowledge library — upload PDFs, books, and documents. AI references them in conversations">
                <Archive size={18} strokeWidth={1.5} />
                <span>Manifest</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reports" className="sidebar__link" title="Generate progress reports — tasks, victories, journal activity, and growth trends by period">
                <FileText size={18} strokeWidth={1.5} />
                <span>Reports</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/log" className="sidebar__link" title="Read-only timeline of everything across your voyage — tasks, victories, journal entries, meetings">
                <Clock size={18} strokeWidth={1.5} />
                <span>Activity Log</span>
              </NavLink>
            </li>
          </ul>
        )}

        {/* Settings — always visible */}
        <ul className="sidebar__group sidebar__group--bottom">
          <li>
            <NavLink to="/settings" className="sidebar__link" title="Configure your experience — profile, AI settings, notifications, theme, and data privacy">
              <Settings size={18} strokeWidth={1.5} />
              <span>Settings</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
