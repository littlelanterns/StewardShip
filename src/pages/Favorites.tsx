import { useEffect } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { ExtractionsView } from '../components/manifest/ExtractionsView';
import { FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';

export default function Favorites() {
  usePageContext({ page: 'manifest' });
  const { items, fetchItems } = useManifest();

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="page manifest-page">
      {FEATURE_GUIDES.favorites && <FeatureGuide {...FEATURE_GUIDES.favorites} />}
      <ExtractionsView items={items} favoritesMode />
    </div>
  );
}
