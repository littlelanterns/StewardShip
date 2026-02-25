import { Info } from 'lucide-react';
import { useFeatureGuide } from '../../hooks/useFeatureGuide';
import type { FeatureGuideContent } from '../../lib/featureGuides';
import './FeatureGuide.css';

export function FeatureGuide({ featureKey, title, description, tips }: FeatureGuideContent) {
  const { shouldShow, hiding, dismiss, hideAll } = useFeatureGuide(featureKey);

  if (!shouldShow) return null;

  return (
    <div className={`feature-guide${hiding ? ' feature-guide--hiding' : ''}`}>
      <button className="feature-guide__dismiss" onClick={dismiss} aria-label="Dismiss guide">
        &times;
      </button>
      <div className="feature-guide__header">
        <Info size={18} className="feature-guide__icon" />
        <div className="feature-guide__content">
          <h3 className="feature-guide__title">{title}</h3>
          <p className="feature-guide__description">{description}</p>
          {tips && tips.length > 0 && (
            <ul className="feature-guide__tips">
              {tips.map((tip) => (
                <li key={tip} className="feature-guide__tip">{tip}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="feature-guide__footer">
        <button className="feature-guide__got-it" onClick={dismiss}>Got it</button>
        <button className="feature-guide__hide-all" onClick={hideAll}>Don't show guides</button>
      </div>
    </div>
  );
}
