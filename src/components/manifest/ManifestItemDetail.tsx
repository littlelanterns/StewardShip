import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, Mic, Image, StickyNote, MessageSquare, RefreshCw } from 'lucide-react';
import type { ManifestItem, ManifestUsageDesignation } from '../../lib/types';
import { MANIFEST_USAGE_LABELS, MANIFEST_FILE_TYPE_LABELS, MANIFEST_STATUS_LABELS } from '../../lib/types';
import { useHelmContext } from '../../contexts/HelmContext';
import { Button } from '../shared';
import './ManifestItemDetail.css';

interface ManifestItemDetailProps {
  item: ManifestItem;
  onBack: () => void;
  onUpdateItem: (id: string, updates: Partial<Pick<ManifestItem, 'title' | 'tags' | 'usage_designations' | 'folder_group' | 'text_content' | 'intake_completed'>>) => Promise<boolean>;
  onReprocess: (id: string) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const FILE_TYPE_ICONS = {
  pdf: FileText,
  audio: Mic,
  image: Image,
  text_note: StickyNote,
} as const;

const USAGE_OPTIONS: { value: ManifestUsageDesignation; label: string; description: string }[] = [
  { value: 'general_reference', label: 'General Reference', description: 'Available for AI to draw from when relevant' },
  { value: 'framework_source', label: 'AI Framework', description: 'Extract principles for always-available guidance' },
  { value: 'mast_extraction', label: 'Mast Extraction', description: 'Extract values and principles for The Mast' },
  { value: 'keel_info', label: 'Keel Info', description: 'Contains personality or self-knowledge data' },
  { value: 'goal_specific', label: 'Goal Specific', description: 'Tied to a specific goal or Wheel' },
  { value: 'store_only', label: 'Store Only', description: 'Stored but not used in AI context' },
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ManifestItemDetail({
  item,
  onBack,
  onUpdateItem,
  onReprocess,
  onArchive,
  onDelete,
}: ManifestItemDetailProps) {
  const navigate = useNavigate();
  const { startGuidedConversation } = useHelmContext();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(item.text_content || '');
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;

  const saveTitle = useCallback(() => {
    if (titleDraft.trim() && titleDraft.trim() !== item.title) {
      onUpdateItem(item.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }, [titleDraft, item.id, item.title, onUpdateItem]);

  const saveContent = useCallback(() => {
    if (contentDraft !== item.text_content) {
      onUpdateItem(item.id, { text_content: contentDraft });
    }
    setEditingContent(false);
  }, [contentDraft, item.id, item.text_content, onUpdateItem]);

  const handleRemoveTag = useCallback((tag: string) => {
    onUpdateItem(item.id, { tags: item.tags.filter((t) => t !== tag) });
  }, [item.id, item.tags, onUpdateItem]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag && !item.tags.includes(tag)) {
      onUpdateItem(item.id, { tags: [...item.tags, tag] });
    }
    setTagInput('');
    setAddingTag(false);
  }, [tagInput, item.id, item.tags, onUpdateItem]);

  const handleToggleUsage = useCallback((usage: ManifestUsageDesignation) => {
    const current = item.usage_designations;
    const updated = current.includes(usage)
      ? current.filter((u) => u !== usage)
      : [...current, usage];
    if (updated.length > 0) {
      onUpdateItem(item.id, { usage_designations: updated });
    }
  }, [item.id, item.usage_designations, onUpdateItem]);

  const handleReprocess = useCallback(async () => {
    setReprocessing(true);
    await onReprocess(item.id);
    setReprocessing(false);
  }, [item.id, onReprocess]);

  const handleDelete = useCallback(async () => {
    await onDelete(item.id);
    onBack();
  }, [item.id, onDelete, onBack]);

  const handleArchive = useCallback(async () => {
    await onArchive(item.id);
    onBack();
  }, [item.id, onArchive, onBack]);

  const handleDiscuss = useCallback(() => {
    startGuidedConversation('manifest_discuss', item.id);
    navigate('/helm');
  }, [startGuidedConversation, item.id, navigate]);

  return (
    <div className="manifest-detail">
      <button type="button" className="manifest-detail__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="manifest-detail__header">
        <div className="manifest-detail__icon-wrap">
          <Icon size={24} />
        </div>
        <div className="manifest-detail__header-info">
          {editingTitle ? (
            <input
              type="text"
              className="manifest-detail__title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleDraft(item.title); setEditingTitle(false); }
              }}
              autoFocus
            />
          ) : (
            <h2
              className="manifest-detail__title"
              onClick={() => setEditingTitle(true)}
              title="Click to edit"
            >
              {item.title}
            </h2>
          )}

          <div className="manifest-detail__meta">
            <span>{MANIFEST_FILE_TYPE_LABELS[item.file_type]}</span>
            {item.file_size_bytes && <span>{formatFileSize(item.file_size_bytes)}</span>}
            <span>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className={`manifest-detail__status manifest-detail__status--${item.processing_status}`}>
              {MANIFEST_STATUS_LABELS[item.processing_status]}
            </span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <section className="manifest-detail__section">
        <h3 className="manifest-detail__section-title">Tags</h3>
        <div className="manifest-detail__tags">
          {item.tags.map((tag) => (
            <span key={tag} className="manifest-detail__tag">
              {tag.replace(/_/g, ' ')}
              <button
                type="button"
                className="manifest-detail__tag-remove"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                x
              </button>
            </span>
          ))}
          {addingTag ? (
            <input
              type="text"
              className="manifest-detail__tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') { setTagInput(''); setAddingTag(false); }
              }}
              placeholder="Tag name..."
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="manifest-detail__tag manifest-detail__tag--add"
              onClick={() => setAddingTag(true)}
            >
              + Add Tag
            </button>
          )}
        </div>
      </section>

      {/* Usage Designation */}
      <section className="manifest-detail__section">
        <h3 className="manifest-detail__section-title">Usage</h3>
        <div className="manifest-detail__usage-list">
          {USAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`manifest-detail__usage-chip${item.usage_designations.includes(opt.value) ? ' manifest-detail__usage-chip--active' : ''}`}
              onClick={() => handleToggleUsage(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {item.usage_designations.includes('framework_source') && (
          <p className="manifest-detail__usage-note">
            Framework principle extraction will be available in a future update.
          </p>
        )}
        {item.usage_designations.includes('mast_extraction') && (
          <p className="manifest-detail__usage-note">
            Mast principle extraction will be available in a future update.
          </p>
        )}
      </section>

      {/* Content Preview */}
      <section className="manifest-detail__section">
        <h3 className="manifest-detail__section-title">Content</h3>
        {item.file_type === 'text_note' ? (
          editingContent ? (
            <div className="manifest-detail__content-edit">
              <textarea
                className="manifest-detail__content-textarea"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                rows={10}
                autoFocus
              />
              <div className="manifest-detail__content-actions">
                <Button size="sm" onClick={saveContent}>Save</Button>
                <Button size="sm" variant="text" onClick={() => { setContentDraft(item.text_content || ''); setEditingContent(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div
              className="manifest-detail__content-preview manifest-detail__content-preview--editable"
              onClick={() => { setContentDraft(item.text_content || ''); setEditingContent(true); }}
              title="Click to edit"
            >
              {item.text_content || 'No content yet. Click to add.'}
            </div>
          )
        ) : (
          <div className="manifest-detail__content-preview">
            {item.text_content
              ? item.text_content.substring(0, 500) + (item.text_content.length > 500 ? '...' : '')
              : item.processing_status === 'completed'
                ? 'Content extracted and indexed.'
                : 'Content will be available after processing completes.'}
          </div>
        )}
        {item.chunk_count > 0 && (
          <p className="manifest-detail__chunk-info">{item.chunk_count} chunks indexed</p>
        )}
      </section>

      {/* Actions */}
      <section className="manifest-detail__section">
        <div className="manifest-detail__actions">
          {item.processing_status === 'completed' && (
            <Button size="sm" onClick={handleDiscuss}>
              <MessageSquare size={14} />
              Discuss This
            </Button>
          )}

          {(item.processing_status === 'completed' || item.processing_status === 'failed') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReprocess}
              disabled={reprocessing}
            >
              <RefreshCw size={14} className={reprocessing ? 'manifest-detail__spin' : ''} />
              Re-process
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={handleArchive}>
            Archive
          </Button>

          {confirmDelete ? (
            <div className="manifest-detail__delete-confirm">
              <span>Are you sure?</span>
              <Button size="sm" variant="text" onClick={handleDelete}>Yes, delete</Button>
              <Button size="sm" variant="text" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="text" onClick={() => setConfirmDelete(true)}>
              Delete Permanently
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
