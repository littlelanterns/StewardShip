import { useState, useCallback } from 'react';
import { GripVertical, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button, LoadingSpinner } from '../shared';
import type { AIFramework } from '../../lib/types';
import './FrameworkPrinciples.css';

interface EditablePrinciple {
  text: string;
  sort_order: number;
  is_user_added: boolean;
  id?: string;
}

interface FrameworkPrinciplesProps {
  manifestItemId: string;
  manifestItemTitle: string;
  framework: AIFramework | undefined;
  extracting: boolean;
  onExtract: (itemId: string) => Promise<{ framework_name: string; principles: Array<{ text: string; sort_order: number }> } | null>;
  onSave: (
    manifestItemId: string,
    name: string,
    principles: Array<{ text: string; sort_order: number; is_user_added?: boolean }>,
    isActive: boolean,
  ) => Promise<AIFramework | null>;
  onToggle: (frameworkId: string, isActive: boolean) => Promise<void>;
  onBack: () => void;
}

export default function FrameworkPrinciples({
  manifestItemId,
  manifestItemTitle,
  framework,
  extracting,
  onExtract,
  onSave,
  onToggle,
  onBack,
}: FrameworkPrinciplesProps) {
  const [name, setName] = useState(framework?.name || manifestItemTitle);
  const [principles, setPrinciples] = useState<EditablePrinciple[]>(
    framework?.principles?.map((p) => ({
      text: p.text,
      sort_order: p.sort_order,
      is_user_added: p.is_user_added,
      id: p.id,
    })).sort((a, b) => a.sort_order - b.sort_order) || [],
  );
  const [isActive, setIsActive] = useState(framework?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [newPrincipleText, setNewPrincipleText] = useState('');

  const handleExtract = useCallback(async () => {
    const result = await onExtract(manifestItemId);
    if (result) {
      if (!name || name === manifestItemTitle) {
        setName(result.framework_name);
      }
      // Merge: keep existing user-added principles, add new AI-extracted
      const userAdded = principles.filter((p) => p.is_user_added);
      const newPrinciples = result.principles.map((p, i) => ({
        text: p.text,
        sort_order: userAdded.length + i,
        is_user_added: false,
      }));
      setPrinciples([...userAdded, ...newPrinciples]);
    }
  }, [manifestItemId, manifestItemTitle, name, principles, onExtract]);

  const handleSave = useCallback(async (activate: boolean) => {
    setSaving(true);
    try {
      const activeState = activate || isActive;
      await onSave(manifestItemId, name, principles, activeState);
      if (activate) setIsActive(true);
      onBack();
    } finally {
      setSaving(false);
    }
  }, [manifestItemId, name, principles, isActive, onSave, onBack]);

  const updatePrinciple = useCallback((index: number, text: string) => {
    setPrinciples((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  }, []);

  const removePrinciple = useCallback((index: number) => {
    setPrinciples((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((p, i) => ({ ...p, sort_order: i }));
    });
  }, []);

  const movePrinciple = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    setPrinciples((prev) => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
      return updated.map((p, i) => ({ ...p, sort_order: i }));
    });
  }, []);

  const addPrinciple = useCallback(() => {
    if (!newPrincipleText.trim()) return;
    setPrinciples((prev) => [
      ...prev,
      {
        text: newPrincipleText.trim(),
        sort_order: prev.length,
        is_user_added: true,
      },
    ]);
    setNewPrincipleText('');
  }, [newPrincipleText]);

  // Initial extraction needed
  if (principles.length === 0 && !extracting) {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extract Framework</h3>
        </div>
        <div className="framework-principles__empty">
          <p>Extract actionable principles from this content to use as an AI framework.</p>
          <p className="framework-principles__source">Source: {manifestItemTitle}</p>
          <Button onClick={handleExtract} variant="primary">
            Extract Principles
          </Button>
        </div>
      </div>
    );
  }

  if (extracting) {
    return (
      <div className="framework-principles">
        <div className="framework-principles__header">
          <button className="framework-principles__back" onClick={onBack}>Back</button>
          <h3 className="framework-principles__title">Extracting Framework</h3>
        </div>
        <div className="framework-principles__loading">
          <LoadingSpinner />
          <p>Analyzing content and extracting principles...</p>
          <p className="framework-principles__loading-note">This may take a moment for longer content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="framework-principles">
      <div className="framework-principles__header">
        <button className="framework-principles__back" onClick={onBack}>Back</button>
        <h3 className="framework-principles__title">Framework Principles</h3>
      </div>

      <div className="framework-principles__name-row">
        <label className="framework-principles__label">Framework Name</label>
        <input
          className="framework-principles__name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Framework name"
        />
      </div>

      <div className="framework-principles__source-row">
        <span className="framework-principles__source-label">Source:</span>
        <span className="framework-principles__source-value">{manifestItemTitle}</span>
      </div>

      <div className="framework-principles__status-row">
        <span className="framework-principles__label">Status</span>
        <button
          className={`framework-principles__toggle ${isActive ? 'framework-principles__toggle--active' : ''}`}
          onClick={() => {
            setIsActive(!isActive);
            if (framework) {
              onToggle(framework.id, !isActive);
            }
          }}
        >
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="framework-principles__list">
        <label className="framework-principles__label">
          Principles ({principles.length})
        </label>
        {principles.map((principle, index) => (
          <div key={index} className="framework-principles__item">
            <div className="framework-principles__drag-handles">
              <button
                className="framework-principles__move-btn"
                onClick={() => movePrinciple(index, 'up')}
                disabled={index === 0}
                title="Move up"
              >
                <GripVertical size={14} />
              </button>
            </div>
            <textarea
              className="framework-principles__text"
              value={principle.text}
              onChange={(e) => updatePrinciple(index, e.target.value)}
              rows={2}
            />
            <div className="framework-principles__item-actions">
              {principle.is_user_added && (
                <span className="framework-principles__manual-badge">Manual</span>
              )}
              <button
                className="framework-principles__delete-btn"
                onClick={() => removePrinciple(index)}
                title="Remove principle"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="framework-principles__add-row">
        <input
          className="framework-principles__add-input"
          value={newPrincipleText}
          onChange={(e) => setNewPrincipleText(e.target.value)}
          placeholder="Add a principle manually..."
          onKeyDown={(e) => e.key === 'Enter' && addPrinciple()}
        />
        <button
          className="framework-principles__add-btn"
          onClick={addPrinciple}
          disabled={!newPrincipleText.trim()}
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        className="framework-principles__extract-more"
        onClick={handleExtract}
        disabled={extracting}
      >
        <RefreshCw size={14} />
        Extract More Principles
      </button>

      <div className="framework-principles__actions">
        <Button onClick={onBack} variant="secondary">Cancel</Button>
        <Button
          onClick={() => handleSave(false)}
          variant="secondary"
          disabled={saving || principles.length === 0}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={() => handleSave(true)}
          variant="primary"
          disabled={saving || principles.length === 0}
        >
          {saving ? 'Saving...' : 'Save and Activate'}
        </Button>
      </div>
    </div>
  );
}
