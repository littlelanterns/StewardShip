import type { SphereLevel } from '../../lib/types';
import { SPHERE_LEVEL_LABELS, SPHERE_LEVEL_ORDER } from '../../lib/types';

interface SphereAssignmentProps {
  desiredSphere: SphereLevel | null;
  currentSphere: SphereLevel | null;
  onDesiredChange: (level: SphereLevel | null) => void;
  onCurrentChange: (level: SphereLevel | null) => void;
}

export function SphereAssignment({
  desiredSphere,
  currentSphere,
  onDesiredChange,
  onCurrentChange,
}: SphereAssignmentProps) {
  const hasGap = desiredSphere && currentSphere && desiredSphere !== currentSphere;
  const desiredIdx = desiredSphere ? SPHERE_LEVEL_ORDER.indexOf(desiredSphere) : -1;
  const currentIdx = currentSphere ? SPHERE_LEVEL_ORDER.indexOf(currentSphere) : -1;
  const gapDirection = hasGap ? (currentIdx < desiredIdx ? 'inward' : 'outward') : null;

  return (
    <div className="sphere-assignment">
      <p className="sphere-assignment__note">
        This is not about cutting anyone off. It is about being intentional with influence.
      </p>

      <label className="sphere-assignment__label">
        Where do you want their influence?
        <select
          className="sphere-assignment__select"
          value={desiredSphere || ''}
          onChange={(e) => onDesiredChange(e.target.value as SphereLevel || null)}
        >
          <option value="">Not assigned</option>
          {SPHERE_LEVEL_ORDER.map((lvl) => (
            <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
          ))}
        </select>
      </label>

      <label className="sphere-assignment__label">
        Where is their influence right now?
        <select
          className="sphere-assignment__select"
          value={currentSphere || ''}
          onChange={(e) => onCurrentChange(e.target.value as SphereLevel || null)}
        >
          <option value="">Not sure yet</option>
          {SPHERE_LEVEL_ORDER.map((lvl) => (
            <option key={lvl} value={lvl}>{SPHERE_LEVEL_LABELS[lvl]}</option>
          ))}
        </select>
      </label>

      {hasGap && gapDirection && (
        <div className={`sphere-assignment__gap sphere-assignment__gap--${gapDirection}`}>
          {gapDirection === 'inward'
            ? `Their influence is closer than intended (${SPHERE_LEVEL_LABELS[currentSphere!]} vs. ${SPHERE_LEVEL_LABELS[desiredSphere!]})`
            : `Their influence is further than intended (${SPHERE_LEVEL_LABELS[currentSphere!]} vs. ${SPHERE_LEVEL_LABELS[desiredSphere!]})`
          }
        </div>
      )}
    </div>
  );
}
