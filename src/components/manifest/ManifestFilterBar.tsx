import './ManifestFilterBar.css';

interface ManifestFilterBarProps {
  tagFilter: string | null;
  uniqueTags: string[];
  onTagChange: (tag: string | null) => void;
}

export function ManifestFilterBar({
  tagFilter,
  uniqueTags,
  onTagChange,
}: ManifestFilterBarProps) {
  if (uniqueTags.length === 0) return null;

  return (
    <div className="manifest-filter">
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
    </div>
  );
}
