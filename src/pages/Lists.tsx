import { EmptyState, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { usePageContext } from '../hooks/usePageContext';

export default function Lists() {
  usePageContext({ page: 'lists' });

  return (
    <div className="page">
      <h1>Lists</h1>
      <FeatureGuide {...FEATURE_GUIDES.lists} />
      <EmptyState
        heading="Flexible Lists"
        message="To-do lists, shopping lists, wishlists, expense tracking — create, share, and let the AI help you manage them."
      />
    </div>
  );
}
