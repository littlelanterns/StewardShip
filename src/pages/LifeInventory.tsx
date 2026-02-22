import { EmptyState } from '../components/shared';
import { usePageContext } from '../hooks/usePageContext';

export default function LifeInventory() {
  usePageContext({ page: 'lifeinventory' });

  return (
    <div className="page">
      <h1>Life Inventory</h1>
      <EmptyState
        heading="Life Assessment"
        message="A conversational assessment of where you are across all areas of life — spiritual, marriage, family, career, health, and more. No scales, no ratings, just honest reflection."
      />
    </div>
  );
}
