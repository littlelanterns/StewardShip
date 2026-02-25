import { useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useHelmContext } from '../contexts/HelmContext';
import { FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { SafeHarborLanding } from '../components/safeharbor/SafeHarborLanding';
import './SafeHarbor.css';

export default function SafeHarbor() {
  usePageContext({ page: 'safeharbor' });
  const { startGuidedConversation } = useHelmContext();

  const handleStartConversation = useCallback(() => {
    startGuidedConversation('safe_harbor');
  }, [startGuidedConversation]);

  return (
    <div className="page safe-harbor-page">
      <FeatureGuide {...FEATURE_GUIDES.safeharbor} />
      <SafeHarborLanding onStartConversation={handleStartConversation} />
    </div>
  );
}
