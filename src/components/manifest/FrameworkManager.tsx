import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { Button } from '../shared';
import type { AIFramework, ManifestItem } from '../../lib/types';
import './FrameworkManager.css';

interface FrameworkManagerProps {
  frameworks: AIFramework[];
  items: ManifestItem[];
  onToggleFrameworks: (changes: Array<{ frameworkId: string; isActive: boolean }>) => Promise<void>;
  onSelectFramework: (fw: AIFramework) => void;
  onBack: () => void;
}

export default function FrameworkManager({
  frameworks,
  items,
  onToggleFrameworks,
  onSelectFramework,
  onBack,
}: FrameworkManagerProps) {
  // Local state tracks checkbox changes before saving
  const [localActive, setLocalActive] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const fw of frameworks) {
      map[fw.id] = fw.is_active;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(
    () => Object.values(localActive).filter(Boolean).length,
    [localActive],
  );

  const hasChanges = useMemo(() => {
    return frameworks.some((fw) => localActive[fw.id] !== fw.is_active);
  }, [frameworks, localActive]);

  const handleToggle = useCallback((frameworkId: string, checked: boolean) => {
    setLocalActive((prev) => ({ ...prev, [frameworkId]: checked }));
  }, []);

  const handleSave = useCallback(async () => {
    const changes = frameworks
      .filter((fw) => localActive[fw.id] !== fw.is_active)
      .map((fw) => ({ frameworkId: fw.id, isActive: localActive[fw.id] }));

    if (changes.length === 0) return;
    setSaving(true);
    try {
      await onToggleFrameworks(changes);
    } finally {
      setSaving(false);
    }
  }, [frameworks, localActive, onToggleFrameworks]);

  if (frameworks.length === 0) {
    return (
      <div className="framework-manager">
        <button type="button" className="framework-manager__back" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="framework-manager__header">
          <h2 className="framework-manager__title">Your Frameworks</h2>
        </div>
        <div className="framework-manager__empty">
          <BookOpen size={32} className="framework-manager__empty-icon" />
          <p>No frameworks extracted yet.</p>
          <p className="framework-manager__empty-hint">
            Upload a book or resource and designate it as "AI Framework" to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="framework-manager">
      <button type="button" className="framework-manager__back" onClick={onBack}>
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="framework-manager__header">
        <h2 className="framework-manager__title">Your Frameworks</h2>
        <p className="framework-manager__count">
          {activeCount} of {frameworks.length} active
        </p>
      </div>

      <p className="framework-manager__intro">
        These frameworks are loaded into every AI conversation. Check the ones you want active.
      </p>

      <div className="framework-manager__list">
        {frameworks.map((fw) => {
          const sourceItem = items.find((i) => i.id === fw.manifest_item_id);
          const isChecked = localActive[fw.id] ?? fw.is_active;
          return (
            <div key={fw.id} className="framework-manager__card">
              <div className="framework-manager__card-check">
                <input
                  type="checkbox"
                  className="framework-manager__checkbox"
                  checked={isChecked}
                  onChange={(e) => handleToggle(fw.id, e.target.checked)}
                  title={isChecked
                    ? 'Currently active — included in every AI conversation. Uncheck to deactivate.'
                    : 'Currently inactive — saved but not included in AI conversations. Check to activate.'}
                />
              </div>
              <button
                type="button"
                className="framework-manager__card-body"
                onClick={() => onSelectFramework(fw)}
              >
                <h3 className="framework-manager__card-name">{fw.name}</h3>
                <p className="framework-manager__card-principles">
                  {fw.principles?.length || 0} principles
                </p>
                <p className="framework-manager__card-source">
                  {sourceItem?.title || 'Unknown source'}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      <div className="framework-manager__actions">
        <Button variant="secondary" onClick={onBack}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          title="Apply all checkbox changes to activate or deactivate the selected frameworks."
        >
          {saving ? 'Saving...' : 'Save and Activate Selected'}
        </Button>
      </div>
    </div>
  );
}
