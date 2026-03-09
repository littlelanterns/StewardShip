import { usePageContext } from '../hooks/usePageContext';
import { HeartedItemsView } from '../components/manifest/HeartedItemsView';
import { FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';

export default function Favorites() {
  usePageContext({ page: 'manifest' });

  return (
    <div className="page manifest-page">
      {FEATURE_GUIDES.favorites && <FeatureGuide {...FEATURE_GUIDES.favorites} />}
      <HeartedItemsView />
    </div>
  );
}
