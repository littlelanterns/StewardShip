import { FileText, BookOpen, FileCode, Mic, Image, StickyNote, Loader, ChevronRight } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import type { ManifestItem } from '../../lib/types';
import { MANIFEST_USAGE_LABELS } from '../../lib/types';
import { Card } from '../shared/Card';
import './ManifestItemCard.css';

interface ManifestItemCardProps {
  item: ManifestItem;
  onClick: (item: ManifestItem) => void;
  compact?: boolean;
  selectable?: boolean;
  selected?: boolean;
  queuePosition?: number | null;
  partExtraction?: { extracted: number; total: number } | null;
  draggable?: boolean;
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

export function ManifestItemCard({ item, onClick, compact, selectable, selected, queuePosition, partExtraction, draggable: isDraggable }: ManifestItemCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !isDraggable,
  });
  const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
  const isPending = item.processing_status === 'pending';
  const isProcessing = item.processing_status === 'processing';
  const isFailed = item.processing_status === 'failed';
  const isCompleted = item.processing_status === 'completed';

  if (compact) {
    return (
      <button
        ref={isDraggable ? setNodeRef : undefined}
        type="button"
        className={`manifest-row${selected ? ' manifest-row--selected' : ''}${isDragging ? ' manifest-row--dragging' : ''}`}
        onClick={() => onClick(item)}
        {...(isDraggable ? { ...listeners, ...attributes } : {})}
        style={isDragging ? { opacity: 0.4 } : undefined}
      >
        {selectable && (
          <input
            type="checkbox"
            className="manifest-row__checkbox"
            checked={selected || false}
            readOnly
            tabIndex={-1}
          />
        )}
        <div className="manifest-row__icon">
          <Icon size={16} />
        </div>
        <span className="manifest-row__title">{item.title}</span>
        <div className="manifest-row__status">
          {isProcessing && (
            <span className="manifest-row__badge manifest-row__badge--processing">
              <Loader size={12} className="manifest-card__spinner" />
              Processing
            </span>
          )}
          {isPending && (
            <span className="manifest-row__badge manifest-row__badge--processing">
              Queued{queuePosition ? ` #${queuePosition}` : ''}
            </span>
          )}
          {isFailed && (
            <span className="manifest-row__badge manifest-row__badge--failed">Failed</span>
          )}
          {isCompleted && (item.extraction_status === 'completed' || item.extraction_status === 'failed') && (
            <span className="manifest-row__badge manifest-row__badge--extracted">
              Extracted
            </span>
          )}
          {isCompleted && item.extraction_status !== 'completed' && item.extraction_status !== 'failed' && !item.part_count && (
            <span className="manifest-row__badge manifest-row__badge--ready">Ready</span>
          )}
          {item.part_count && item.part_count > 0 && partExtraction && partExtraction.extracted > 0 ? (
            <span className={`manifest-row__badge ${partExtraction.extracted === partExtraction.total ? 'manifest-row__badge--extracted' : 'manifest-row__badge--partial'}`}>
              {partExtraction.extracted === partExtraction.total ? 'Extracted' : `${partExtraction.extracted}/${partExtraction.total} Extracted`}
            </span>
          ) : item.part_count && item.part_count > 0 ? (
            <span className="manifest-row__badge manifest-row__badge--parts">
              {item.part_count} Parts
            </span>
          ) : null}
        </div>
        <ChevronRight size={16} className="manifest-row__chevron" />
      </button>
    );
  }

  return (
    <Card
      ref={isDraggable ? setNodeRef : undefined}
      className={`manifest-card${selected ? ' manifest-card--selected' : ''}`}
      onClick={() => onClick(item)}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      style={isDragging ? { opacity: 0.4 } : undefined}
    >
      <div className="manifest-card__content">
        <div className="manifest-card__top">
          {selectable && (
            <input
              type="checkbox"
              className="manifest-card__checkbox"
              checked={selected || false}
              readOnly
              tabIndex={-1}
            />
          )}
          <div className="manifest-card__icon-wrap">
            <Icon size={20} className="manifest-card__icon" />
          </div>
          <div className="manifest-card__info">
            <p className="manifest-card__title">{item.title}</p>
            {isPending ? (
              <span className="manifest-card__processing-msg">
                Queued{queuePosition ? ` (#${queuePosition})` : ''}
              </span>
            ) : isProcessing ? (
              <span className="manifest-card__processing-msg">{item.processing_detail || 'Processing...'}</span>
            ) : (
              <span className="manifest-card__date">{getRelativeDate(item.created_at)}</span>
            )}
          </div>
          {isProcessing && (
            <div className="manifest-card__status manifest-card__status--processing">
              <Loader size={14} className="manifest-card__spinner" />
            </div>
          )}
          {isPending && (
            <div className="manifest-card__status manifest-card__status--pending">
              <span style={{ fontSize: '12px', color: 'var(--color-slate-gray)' }}>Queued</span>
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
          {item.part_count && item.part_count > 0 && partExtraction && partExtraction.extracted > 0 ? (
            <span className={`manifest-card__badge ${partExtraction.extracted === partExtraction.total ? 'manifest-card__badge--extracted' : 'manifest-card__badge--partial'}`}>
              {partExtraction.extracted === partExtraction.total ? 'Extracted' : `${partExtraction.extracted}/${partExtraction.total} Extracted`}
            </span>
          ) : item.part_count && item.part_count > 0 ? (
            <span className="manifest-card__badge manifest-card__badge--parts">
              {item.part_count} Parts
            </span>
          ) : (item.extraction_status === 'completed' || item.extraction_status === 'failed') ? (
            <span className="manifest-card__badge manifest-card__badge--extracted">
              Extracted
            </span>
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
