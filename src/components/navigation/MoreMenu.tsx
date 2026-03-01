import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
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
  X,
  Clock,
  Lightbulb,
  Info,
} from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
import { useHatchContext } from '../../contexts/HatchContext';
import './MoreMenu.css';

interface MoreMenuProps {
  open: boolean;
  onClose: () => void;
}

function getShowDescs(): boolean {
  try {
    return localStorage.getItem('more-menu-show-descs') === 'true';
  } catch {
    return false;
  }
}

export default function MoreMenu({ open, onClose }: MoreMenuProps) {
  const { profile } = useAuthContext();
  const { startGuidedConversation } = useHelmContext();
  const { openHatch } = useHatchContext();
  const showFirstMate = profile?.relationship_status && profile.relationship_status !== 'single';
  const [showDescs, setShowDescs] = useState(getShowDescs);

  if (!open) return null;

  const handleToggleDescs = () => {
    setShowDescs((prev) => {
      const next = !prev;
      try { localStorage.setItem('more-menu-show-descs', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleUnloadTheHold = () => {
    onClose();
    startGuidedConversation('unload_the_hold');
  };

  const handleOpenHatch = () => {
    onClose();
    openHatch();
  };

  const d = showDescs;

  return (
    <>
      <div className="more-menu__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="more-menu" role="dialog" aria-label="More navigation">
        <div className="more-menu__header">
          <h3 className="more-menu__title">More</h3>
          <div className="more-menu__header-actions">
            <button
              type="button"
              className={`more-menu__info-toggle ${d ? 'more-menu__info-toggle--active' : ''}`}
              onClick={handleToggleDescs}
              aria-label={d ? 'Hide descriptions' : 'Show descriptions'}
              title={d ? 'Hide descriptions' : 'Show descriptions'}
            >
              <Info size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="more-menu__close"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <nav className="more-menu__nav">
          {/* Identity & Growth */}
          <div className="more-menu__section-label">Identity</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/mast" className="more-menu__link" onClick={onClose}>
                <Anchor size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Mast</span>
                  {d && <span className="more-menu__desc">Values, declarations, and vision</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/keel" className="more-menu__link" onClick={onClose}>
                <Brain size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Keel</span>
                  {d && <span className="more-menu__desc">Personality, strengths, and growth areas</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/wheel" className="more-menu__link" onClick={onClose}>
                <RefreshCw size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Wheel</span>
                  {d && <span className="more-menu__desc">Deep change process with 6 spokes</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/life-inventory" className="more-menu__link" onClick={onClose}>
                <ClipboardList size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Life Inventory</span>
                  {d && <span className="more-menu__desc">Where you are across life areas</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Relationships */}
          <div className="more-menu__section-label">Relationships</div>
          <ul className="more-menu__group">
            {showFirstMate && (
              <li>
                <NavLink to="/first-mate" className="more-menu__link" onClick={onClose}>
                  <Heart size={20} strokeWidth={1.5} />
                  <div className="more-menu__link-text">
                    <span>First Mate</span>
                    {d && <span className="more-menu__desc">Spouse insights and Marriage Toolbox</span>}
                  </div>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to="/crew" className="more-menu__link" onClick={onClose}>
                <Users size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Crew</span>
                  {d && <span className="more-menu__desc">People directory with AI context</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Planning & Action */}
          <div className="more-menu__section-label">Planning</div>
          <ul className="more-menu__group">
            <li>
              <button
                type="button"
                className="more-menu__link more-menu__link--button"
                onClick={handleOpenHatch}
              >
                <Inbox size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>The Hatch</span>
                  {d && <span className="more-menu__desc">Quick capture notepad with routing</span>}
                </div>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="more-menu__link more-menu__link--button"
                onClick={handleUnloadTheHold}
              >
                <PackageOpen size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Unload the Hold</span>
                  {d && <span className="more-menu__desc">Brain dump, then AI sorts and routes</span>}
                </div>
              </button>
            </li>
            <li>
              <NavLink to="/rigging" className="more-menu__link" onClick={onClose}>
                <Map size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Rigging</span>
                  {d && <span className="more-menu__desc">Plans, priorities, and AI frameworks</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/lists" className="more-menu__link" onClick={onClose}>
                <ListChecks size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Lists</span>
                  {d && <span className="more-menu__desc">Shopping, routines, wishlists, and more</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/meetings" className="more-menu__link" onClick={onClose}>
                <Calendar size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Meetings</span>
                  {d && <span className="more-menu__desc">Recurring meetings guided by AI</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Progress & Tracking */}
          <div className="more-menu__section-label">Progress</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/charts" className="more-menu__link" onClick={onClose}>
                <BarChart3 size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Charts</span>
                  {d && <span className="more-menu__desc">Streaks, goals, and custom trackers</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/victories" className="more-menu__link" onClick={onClose}>
                <Trophy size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Victories</span>
                  {d && <span className="more-menu__desc">Accomplishments with AI narratives</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Daily Rhythms */}
          <div className="more-menu__section-label">Daily Rhythms</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/reveille" className="more-menu__link" onClick={onClose}>
                <Sun size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Reveille</span>
                  {d && <span className="more-menu__desc">Morning briefing and priorities</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reckoning" className="more-menu__link" onClick={onClose}>
                <Moon size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Reckoning</span>
                  {d && <span className="more-menu__desc">Evening review and carry forward</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Resources */}
          <div className="more-menu__section-label">Resources</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/safe-harbor" className="more-menu__link" onClick={onClose}>
                <ShieldCheck size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Safe Harbor</span>
                  {d && <span className="more-menu__desc">Stress relief and validation-first support</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reflections" className="more-menu__link" onClick={onClose}>
                <Lightbulb size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Reflect</span>
                  {d && <span className="more-menu__desc">Daily reflection questions</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/manifest" className="more-menu__link" onClick={onClose}>
                <Archive size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Manifest</span>
                  {d && <span className="more-menu__desc">Knowledge library for AI reference</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reports" className="more-menu__link" onClick={onClose}>
                <FileText size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Reports</span>
                  {d && <span className="more-menu__desc">Progress reports by period</span>}
                </div>
              </NavLink>
            </li>
            <li>
              <NavLink to="/log" className="more-menu__link" onClick={onClose}>
                <Clock size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Activity Log</span>
                  {d && <span className="more-menu__desc">Timeline of your entire voyage</span>}
                </div>
              </NavLink>
            </li>
          </ul>

          {/* Settings */}
          <ul className="more-menu__group more-menu__group--last">
            <li>
              <NavLink to="/settings" className="more-menu__link" onClick={onClose}>
                <Settings size={20} strokeWidth={1.5} />
                <div className="more-menu__link-text">
                  <span>Settings</span>
                  {d && <span className="more-menu__desc">Profile, AI, notifications, and theme</span>}
                </div>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
