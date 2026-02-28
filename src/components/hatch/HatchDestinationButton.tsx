import {
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  List,
  Trophy,
  Compass,
  Star,
  StickyNote,
  Users,
  BarChart2,
} from 'lucide-react';
import type { HatchRoutingDestination } from '../../lib/types';
import { HATCH_DESTINATION_CONFIG } from '../../lib/types';
import './HatchDestinationButton.css';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  List,
  Trophy,
  Compass,
  Star,
  StickyNote,
  Users,
  BarChart2,
};

interface HatchDestinationButtonProps {
  destination: HatchRoutingDestination;
  variant?: 'default' | 'favorite';
  onClick: (destination: HatchRoutingDestination) => void;
}

export default function HatchDestinationButton({
  destination,
  variant = 'default',
  onClick,
}: HatchDestinationButtonProps) {
  const config = HATCH_DESTINATION_CONFIG[destination];
  const IconComponent = ICON_MAP[config.icon];

  return (
    <button
      type="button"
      className={`hatch-dest-btn ${variant === 'favorite' ? 'hatch-dest-btn--favorite' : ''}`}
      onClick={() => onClick(destination)}
      style={{
        color: config.accentColor,
        backgroundColor: `color-mix(in srgb, ${config.accentColor} 6%, transparent)`,
      }}
    >
      <span className="hatch-dest-btn__icon">
        {IconComponent && <IconComponent size={variant === 'favorite' ? 20 : 18} strokeWidth={1.5} />}
      </span>
      <span className="hatch-dest-btn__label">{config.label}</span>
    </button>
  );
}
