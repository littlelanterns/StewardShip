import { useState, useEffect, useCallback } from 'react';
import type { ManifestItem, ManifestUsageDesignation } from '../../lib/types';
import type { IntakeSuggestions } from '../../hooks/useManifest';
import { Button, LoadingSpinner } from '../shared';
import './IntakeFlow.css';

interface IntakeFlowProps {
  item: ManifestItem;
  onRunIntake: (itemId: string) => Promise<IntakeSuggestions | null>;
  onApplyIntake: (itemId: string, intake: { tags: string[]; folder_group: string; usage_designations: ManifestUsageDesignation[] }) => Promise<boolean>;
  onSkip: () => void;
  existingFolders: string[];
}

const USAGE_OPTIONS: { value: ManifestUsageDesignation; label: string; description: string; tooltip: string }[] = [
  { value: 'general_reference', label: 'General Reference', description: 'AI draws from this when relevant', tooltip: 'This content becomes searchable by the AI. When your conversations touch on related topics, the AI can draw from this material to give more informed, personalized responses.' },
  { value: 'framework_source', label: 'Extract as AI Framework', description: 'Actionable principles, always available', tooltip: 'The AI will extract actionable principles from this content and keep them loaded in every conversation — similar to your Mast principles. Best for books on leadership, habits, character development, etc.' },
  { value: 'mast_extraction', label: 'Extract Principles for Mast', description: 'Values and declarations', tooltip: 'The AI will identify values, declarations, and guiding principles from this content and let you review them before adding to your Mast — the core of who you\'re choosing to become.' },
  { value: 'keel_info', label: 'Inform The Keel', description: 'Personality and self-knowledge', tooltip: 'The AI will extract personality insights, traits, and self-knowledge from this content for your Keel — your profile of who you are right now. Great for assessment results, personality tests, etc.' },
  { value: 'goal_specific', label: 'Goal/Wheel Specific', description: 'Tied to a specific goal', tooltip: 'This content relates to a specific goal or Wheel change you\'re working on. The AI will reference it when those topics come up in conversation.' },
  { value: 'store_only', label: 'Store Only', description: 'Keep but don\'t use in AI context', tooltip: 'The file will be stored safely in your Manifest but won\'t be used by the AI in conversations. You can always change this later.' },
];

export function IntakeFlow({ item, onRunIntake, onApplyIntake, onSkip, existingFolders }: IntakeFlowProps) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<IntakeSuggestions | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedUsage, setSelectedUsage] = useState<ManifestUsageDesignation[]>(['general_reference']);
  const [selectedFolder, setSelectedFolder] = useState('Uncategorized');
  const [newTag, setNewTag] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    onRunIntake(item.id).then((result) => {
      if (cancelled) return;
      setSuggestions(result);
      if (result) {
        setSelectedTags(result.suggested_tags);
        setSelectedUsage([result.suggested_usage]);
        setSelectedFolder(result.suggested_folder);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [item.id, onRunIntake]);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setNewTag('');
  }, [newTag, selectedTags]);

  const handleToggleUsage = useCallback((usage: ManifestUsageDesignation) => {
    setSelectedUsage((prev) => {
      const updated = prev.includes(usage) ? prev.filter((u) => u !== usage) : [...prev, usage];
      return updated.length > 0 ? updated : prev;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const folder = showNewFolder && newFolder.trim() ? newFolder.trim() : selectedFolder;
    await onApplyIntake(item.id, {
      tags: selectedTags,
      folder_group: folder,
      usage_designations: selectedUsage,
    });
    setSaving(false);
  }, [item.id, selectedTags, selectedFolder, selectedUsage, showNewFolder, newFolder, onApplyIntake]);

  if (loading) {
    return (
      <div className="intake-flow">
        <div className="intake-flow__loading">
          <LoadingSpinner />
          <p>Analyzing content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-flow">
      <h3 className="intake-flow__heading">Organize: {item.title}</h3>

      {/* Summary */}
      {suggestions?.summary && (
        <div className="intake-flow__summary">
          <p className="intake-flow__summary-label">AI Summary</p>
          <p className="intake-flow__summary-text">{suggestions.summary}</p>
        </div>
      )}

      {/* Usage */}
      <div className="intake-flow__section">
        <p className="intake-flow__label">How should this content be used?</p>
        <div className="intake-flow__usage-grid">
          {USAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`intake-flow__usage-btn${selectedUsage.includes(opt.value) ? ' intake-flow__usage-btn--active' : ''}`}
              onClick={() => handleToggleUsage(opt.value)}
              title={opt.tooltip}
            >
              <span className="intake-flow__usage-label">{opt.label}</span>
              <span className="intake-flow__usage-desc">{opt.description}</span>
            </button>
          ))}
        </div>
        {selectedUsage.includes('framework_source') && (
          <p className="intake-flow__note">After saving, you'll be able to review and edit extracted principles.</p>
        )}
        {selectedUsage.includes('mast_extraction') && (
          <p className="intake-flow__note">After saving, you'll be able to review and edit extracted principles.</p>
        )}
      </div>

      {/* Tags */}
      <div className="intake-flow__section">
        <p className="intake-flow__label">Tags</p>
        <div className="intake-flow__tags">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="intake-flow__tag intake-flow__tag--selected"
              onClick={() => handleToggleTag(tag)}
            >
              {tag.replace(/_/g, ' ')} x
            </button>
          ))}
          <div className="intake-flow__tag-add">
            <input
              type="text"
              className="intake-flow__tag-input"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
              placeholder="Add tag..."
            />
          </div>
        </div>
      </div>

      {/* Folder */}
      <div className="intake-flow__section">
        <p className="intake-flow__label">Folder</p>
        {!showNewFolder ? (
          <div className="intake-flow__folder-row">
            <select
              className="intake-flow__folder-select"
              value={selectedFolder}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewFolder(true);
                } else {
                  setSelectedFolder(e.target.value);
                }
              }}
            >
              {[...new Set([selectedFolder, ...existingFolders, 'Uncategorized'])].sort().map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value="__new__">Create New Folder...</option>
            </select>
          </div>
        ) : (
          <div className="intake-flow__folder-row">
            <input
              type="text"
              className="intake-flow__folder-input"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="New folder name..."
              autoFocus
            />
            <Button size="sm" variant="text" onClick={() => setShowNewFolder(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="intake-flow__actions">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="text" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
