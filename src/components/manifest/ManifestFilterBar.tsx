import type { ManifestFileType, ManifestUsageDesignation } from '../../lib/types';
import './ManifestFilterBar.css';

interface ManifestFilterBarProps {
  typeFilter: ManifestFileType | 'all';
  usageFilter: ManifestUsageDesignation | 'all';
  tagFilter: string | null;
  uniqueTags: string[];
  onTypeChange: (type: ManifestFileType | 'all') => void;
  onUsageChange: (usage: ManifestUsageDesignation | 'all') => void;
  onTagChange: (tag: string | null) => void;
}

const TYPE_OPTIONS: { value: ManifestFileType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
  { value: 'docx', label: 'Word' },
  { value: 'txt', label: 'Text' },
  { value: 'md', label: 'Markdown' },
  { value: 'text_note', label: 'Notes' },
];

const USAGE_OPTIONS: { value: ManifestUsageDesignation | 'all'; label: string }[] = [
  { value: 'all', label: 'All Usage' },
  { value: 'general_reference', label: 'Reference' },
  { value: 'framework_source', label: 'Framework' },
  { value: 'mast_extraction', label: 'Mast' },
  { value: 'keel_info', label: 'Keel' },
  { value: 'goal_specific', label: 'Goal' },
  { value: 'store_only', label: 'Stored' },
];

export function ManifestFilterBar({
  typeFilter,
  usageFilter,
  tagFilter,
  uniqueTags,
  onTypeChange,
  onUsageChange,
  onTagChange,
}: ManifestFilterBarProps) {
  return (
    <div className="manifest-filter">
      <div className="manifest-filter__row">
        <div className="manifest-filter__types">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`manifest-filter__btn${typeFilter === opt.value ? ' manifest-filter__btn--active' : ''}`}
              onClick={() => onTypeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          className="manifest-filter__usage-select"
          value={usageFilter}
          onChange={(e) => onUsageChange(e.target.value as ManifestUsageDesignation | 'all')}
        >
          {USAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {uniqueTags.length > 0 && (
        <div className="manifest-filter__tags">
          {tagFilter && (
            <button
              type="button"
              className="manifest-filter__tag-btn manifest-filter__tag-btn--clear"
              onClick={() => onTagChange(null)}
            >
              Clear
            </button>
          )}
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`manifest-filter__tag-btn${tagFilter === tag ? ' manifest-filter__tag-btn--active' : ''}`}
              onClick={() => onTagChange(tagFilter === tag ? null : tag)}
            >
              {tag.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
