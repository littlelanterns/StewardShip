import { CollapsibleGroup } from '../shared/CollapsibleGroup';
import { InsightCard } from './InsightCard';
import type { SpouseInsight, SpouseInsightCategory } from '../../lib/types';

interface InsightCategorySectionProps {
  label: string;
  insights: SpouseInsight[];
  onUpdate: (id: string, updates: { text?: string; category?: SpouseInsightCategory }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onAdd: () => void;
}

export function InsightCategorySection({ label, insights, onUpdate, onArchive, onAdd }: InsightCategorySectionProps) {
  return (
    <CollapsibleGroup label={label} count={insights.length} defaultExpanded={insights.length > 0}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onUpdate={onUpdate} onArchive={onArchive} />
      ))}
      <button className="insight-section__add-btn" onClick={onAdd}>
        + Add to {label}
      </button>
    </CollapsibleGroup>
  );
}
