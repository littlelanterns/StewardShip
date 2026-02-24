import { useNavigate } from 'react-router-dom';
import type { Person } from '../../lib/types';

interface FocusCenterCardProps {
  spouse: Person | null;
  showGod: boolean;
}

export function FocusCenterCard({ spouse, showGod }: FocusCenterCardProps) {
  const navigate = useNavigate();

  return (
    <div className="focus-center">
      <div className="focus-center__label">Core</div>
      <div className="focus-center__items">
        <span className="focus-center__pill">You</span>
        {spouse && (
          <button
            type="button"
            className="focus-center__pill focus-center__pill--tappable"
            onClick={() => navigate('/first-mate')}
          >
            {spouse.name}
          </button>
        )}
        {showGod && (
          <span className="focus-center__pill">God</span>
        )}
      </div>
    </div>
  );
}
