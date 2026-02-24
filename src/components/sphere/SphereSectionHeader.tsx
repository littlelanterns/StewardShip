import type { SphereLevel } from '../../lib/types';
import { SPHERE_LEVEL_LABELS } from '../../lib/types';

const SPHERE_DESCRIPTIONS: Record<SphereLevel, string> = {
  focus: 'Your innermost circle — who you invest in most deeply',
  family: 'Family relationships and family-like bonds',
  friends: 'Close friendships and trusted companions',
  acquaintances: 'People you know and interact with regularly',
  community: 'Community connections and networks',
  geo_political: 'Broader societal and political influences',
};

interface SphereSectionHeaderProps {
  level: SphereLevel;
  count: number;
}

export function SphereSectionHeader({ level, count }: SphereSectionHeaderProps) {
  return (
    <div className={`sphere-section-header sphere-section-header--${level}`}>
      <div className="sphere-section-header__top">
        <h3 className="sphere-section-header__title">
          {SPHERE_LEVEL_LABELS[level]}
        </h3>
        {count > 0 && (
          <span className="sphere-section-header__count">{count}</span>
        )}
      </div>
      <p className="sphere-section-header__desc">{SPHERE_DESCRIPTIONS[level]}</p>
    </div>
  );
}
