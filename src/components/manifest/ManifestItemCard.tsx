import { FileText, BookOpen, FileCode, Mic, Image, StickyNote, Loader } from 'lucide-react';
import type { ManifestItem, AIFramework } from '../../lib/types';
import { MANIFEST_USAGE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './ManifestItemCard.css';

interface ManifestItemCardProps {
  item: ManifestItem;
  onClick: (item: ManifestItem) => void;
  framework?: AIFramework;
}

const FILE_TYPE_ICONS = {
  pdf: FileText,
  epub: BookOpen,
  docx: FileText,
  txt: FileText,
  md: FileCode,
  audio: Mic,
  image: Image,
  text_note: StickyNote,
} as const;

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ManifestItemCard({ item, onClick, framework }: ManifestItemCardProps) {
  const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
  const isPending = item.processing_status === 'pending';
  const isProcessing = item.processing_status === 'processing';
  const isFailed = item.processing_status === 'failed';
  const isInProgress = isPending || isProcessing;

  return (
    <Card className="manifest-card" onClick={() => onClick(item)}>
      <div className="manifest-card__content">
        <div className="manifest-card__top">
          <div className="manifest-card__icon-wrap">
            <Icon size={20} className="manifest-card__icon" />
          </div>
          <div className="manifest-card__info">
            <p className="manifest-card__title">{item.title}</p>
            {isInProgress ? (
              <span className="manifest-card__processing-msg">{item.processing_detail || 'Processing...'}</span>
            ) : (
              <span className="manifest-card__date">{getRelativeDate(item.created_at)}</span>
            )}
          </div>
          {isInProgress && (
            <div className="manifest-card__status manifest-card__status--processing">
              <Loader size={14} className="manifest-card__spinner" />
            </div>
          )}
          {isFailed && (
            <span className="manifest-card__status manifest-card__status--failed">Failed</span>
          )}
        </div>

        {item.tags.length > 0 && (
          <div className="manifest-card__tags">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="manifest-card__tag">{tag.replace(/_/g, ' ')}</span>
            ))}
            {item.tags.length > 3 && (
              <span className="manifest-card__tag manifest-card__tag--more">+{item.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="manifest-card__meta">
          {framework ? (
            <span
              className={`manifest-card__badge manifest-card__badge--framework${framework.is_active ? '' : ' manifest-card__badge--framework-inactive'}`}
              title={framework.is_active
                ? `Framework active: ${framework.name} (${framework.principles?.length || 0} principles)`
                : `Framework inactive: ${framework.name}`}
            >
              <BookOpen size={12} />
              {framework.is_active ? 'Framework Active' : 'Framework'}
            </span>
          ) : item.usage_designations.includes('framework_source') ? (
            <span className="manifest-card__badge manifest-card__badge--framework-pending">Framework Source</span>
          ) : null}
          {item.usage_designations.filter((u) => u !== 'general_reference' && u !== 'framework_source').slice(0, 1).map((u) => (
            <span key={u} className="manifest-card__badge">
              {MANIFEST_USAGE_LABELS[u]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
