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
} from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHelmContext } from '../../contexts/HelmContext';
import { useHatchContext } from '../../contexts/HatchContext';
import './MoreMenu.css';

interface MoreMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MoreMenu({ open, onClose }: MoreMenuProps) {
  const { profile } = useAuthContext();
  const { startGuidedConversation } = useHelmContext();
  const { openHatch } = useHatchContext();
  const showFirstMate = profile?.relationship_status && profile.relationship_status !== 'single';

  if (!open) return null;

  const handleUnloadTheHold = () => {
    onClose();
    startGuidedConversation('unload_the_hold');
  };

  const handleOpenHatch = () => {
    onClose();
    openHatch();
  };

  return (
    <>
      <div className="more-menu__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="more-menu" role="dialog" aria-label="More navigation">
        <div className="more-menu__header">
          <h3 className="more-menu__title">More</h3>
          <button
            type="button"
            className="more-menu__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <nav className="more-menu__nav">
          {/* Progress & Tracking */}
          <div className="more-menu__section-label">Progress</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/charts" className="more-menu__link" onClick={onClose}>
                <BarChart3 size={20} strokeWidth={1.5} />
                <span>Charts</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/victories" className="more-menu__link" onClick={onClose}>
                <Trophy size={20} strokeWidth={1.5} />
                <span>Victories</span>
              </NavLink>
            </li>
          </ul>

          {/* Identity & Growth */}
          <div className="more-menu__section-label">Identity</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/mast" className="more-menu__link" onClick={onClose}>
                <Anchor size={20} strokeWidth={1.5} />
                <span>Mast</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/keel" className="more-menu__link" onClick={onClose}>
                <Brain size={20} strokeWidth={1.5} />
                <span>Keel</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/wheel" className="more-menu__link" onClick={onClose}>
                <RefreshCw size={20} strokeWidth={1.5} />
                <span>Wheel</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/life-inventory" className="more-menu__link" onClick={onClose}>
                <ClipboardList size={20} strokeWidth={1.5} />
                <span>Life Inventory</span>
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
                <span>The Hatch</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="more-menu__link more-menu__link--button"
                onClick={handleUnloadTheHold}
              >
                <PackageOpen size={20} strokeWidth={1.5} />
                <span>Unload the Hold</span>
              </button>
            </li>
            <li>
              <NavLink to="/rigging" className="more-menu__link" onClick={onClose}>
                <Map size={20} strokeWidth={1.5} />
                <span>Rigging</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/lists" className="more-menu__link" onClick={onClose}>
                <ListChecks size={20} strokeWidth={1.5} />
                <span>Lists</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/meetings" className="more-menu__link" onClick={onClose}>
                <Calendar size={20} strokeWidth={1.5} />
                <span>Meetings</span>
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
                  <span>First Mate</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to="/crew" className="more-menu__link" onClick={onClose}>
                <Users size={20} strokeWidth={1.5} />
                <span>Crew</span>
              </NavLink>
            </li>
          </ul>

          {/* Daily Rhythms */}
          <div className="more-menu__section-label">Daily Rhythms</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/reveille" className="more-menu__link" onClick={onClose}>
                <Sun size={20} strokeWidth={1.5} />
                <span>Reveille</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reckoning" className="more-menu__link" onClick={onClose}>
                <Moon size={20} strokeWidth={1.5} />
                <span>Reckoning</span>
              </NavLink>
            </li>
          </ul>

          {/* Resources */}
          <div className="more-menu__section-label">Resources</div>
          <ul className="more-menu__group">
            <li>
              <NavLink to="/safe-harbor" className="more-menu__link" onClick={onClose}>
                <ShieldCheck size={20} strokeWidth={1.5} />
                <span>Safe Harbor</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/manifest" className="more-menu__link" onClick={onClose}>
                <Archive size={20} strokeWidth={1.5} />
                <span>Manifest</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/reports" className="more-menu__link" onClick={onClose}>
                <FileText size={20} strokeWidth={1.5} />
                <span>Reports</span>
              </NavLink>
            </li>
          </ul>

          {/* Settings */}
          <ul className="more-menu__group more-menu__group--last">
            <li>
              <NavLink to="/settings" className="more-menu__link" onClick={onClose}>
                <Settings size={20} strokeWidth={1.5} />
                <span>Settings</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
