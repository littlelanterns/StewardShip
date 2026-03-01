import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronDown, ChevronUp, ListPlus } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { celebrateVictory, type CelebrateVictoryItem } from '../../lib/ai';
import { supabase } from '../../lib/supabase';
import type { VictorySource, MastEntry } from '../../lib/types';
import { LIFE_AREA_LABELS } from '../../lib/types';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { SparkleOverlay } from '../shared/SparkleOverlay';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';
import './RecordVictory.css';

const VICTORY_BULK_PROMPT = `You are parsing text into individual accomplishments/victories for a personal growth app. Each item should be a distinct accomplishment or win. Keep descriptions concise. Return a JSON array of strings. Example: ["Completed 5K run", "Had a meaningful talk with my son", "Finished the project ahead of deadline"]`;

interface RecordVictoryProps {
  onSave: (data: {
    description: string;
    celebration_text?: string | null;
    life_area_tag?: string | null;
    source?: VictorySource;
    source_reference_id?: string | null;
    related_mast_entry_id?: string | null;
    related_wheel_id?: string | null;
  }) => Promise<unknown>;
  onClose: () => void;
  prefill?: {
    description?: string;
    source?: VictorySource;
    source_reference_id?: string;
  };
}

export function RecordVictory({ onSave, onClose, prefill }: RecordVictoryProps) {
  const { user } = useAuthContext();
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [description, setDescription] = useState(prefill?.description || '');
  const [items, setItems] = useState<CelebrateVictoryItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mastEntries, setMastEntries] = useState<MastEntry[]>([]);

  const handleBulkSave = async (bulkItems: ParsedBulkItem[]) => {
    for (const item of bulkItems) {
      await onSave({ description: item.text, source: 'manual' });
    }
    onClose();
  };

  // Load mast entries for AI context
  useEffect(() => {
    if (!user) return;
    supabase
      .from('mast_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .then(({ data }) => {
        if (data) setMastEntries(data as MastEntry[]);
      });
  }, [user]);

  const handleGenerate = async () => {
    if (!user || !description.trim()) return;
    setGenerating(true);

    const mastContext = mastEntries.length > 0
      ? mastEntries.map((m) => `[${m.id}] ${m.type}: ${m.text}`).join('\n')
      : undefined;

    const result = await celebrateVictory(description, user.id, mastContext);
    setItems(result);
    if (result.length > 1) {
      setExpandedItem(null); // Show all collapsed for multi
    }
    setGenerating(false);
  };

  // Auto-generate when prefill is provided
  useEffect(() => {
    if (prefill?.description && user && mastEntries.length >= 0) {
      const timer = setTimeout(() => {
        if (description.trim()) handleGenerate();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.description, mastEntries]);

  const handleUpdateItem = (index: number, field: keyof CelebrateVictoryItem, value: string | null) => {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (items.length === 0 && !description.trim()) return;
    setSaving(true);

    // If AI hasn't been called yet, save as single item
    const toSave = items.length > 0
      ? items
      : [{ description: description.trim(), celebration_text: null, life_area_tag: null, mast_connection_id: null, wheel_connection_id: null }];

    for (const item of toSave) {
      await onSave({
        description: item.description,
        celebration_text: item.celebration_text,
        life_area_tag: item.life_area_tag,
        source: prefill?.source || 'manual',
        source_reference_id: prefill?.source_reference_id || null,
        related_mast_entry_id: item.mast_connection_id,
      });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 2000);
  };

  const connectedMast = (id: string | null) => mastEntries.find((m) => m.id === id);
  const isMulti = items.length > 1;

  if (addMode === 'bulk') {
    return (
      <div className="record-victory-overlay" onClick={onClose}>
        <div className="record-victory" onClick={(e) => e.stopPropagation()}>
          <div className="record-victory__header">
            <h2>Bulk Record Victories</h2>
            <button type="button" className="record-victory__close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="record-victory__body">
            <BulkAddWithAISort
              title="Bulk Add Victories"
              placeholder={"Paste your wins this week...\n\nCompleted 5K run\nHad a meaningful talk with my son\nFinished the project ahead of deadline"}
              parsePrompt={VICTORY_BULK_PROMPT}
              onSave={handleBulkSave}
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="record-victory-overlay" onClick={onClose}>
      <div className={`record-victory ${saved ? 'record-victory--saved' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="record-victory__header">
          <h2>Record a Victory</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="record-victory__close"
              onClick={() => setAddMode('bulk')}
              aria-label="Bulk add"
              title="Bulk add multiple victories"
            >
              <ListPlus size={18} />
            </button>
            <button type="button" className="record-victory__close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="record-victory__body">
          <label className="record-victory__label">
            What did you accomplish?
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setItems([]); }}
              placeholder="Describe your victory... (list multiple with commas)"
              rows={3}
              className="record-victory__textarea"
              autoFocus={!prefill?.description}
            />
          </label>

          {items.length === 0 && !generating && description.trim().length > 10 && (
            <Button variant="text" onClick={handleGenerate} className="record-victory__generate-btn">
              <Sparkles size={14} /> Generate celebration
            </Button>
          )}

          {generating && (
            <div className="record-victory__generating">
              <LoadingSpinner /> Crafting celebration...
            </div>
          )}

          {/* Multi-victory header */}
          {isMulti && (
            <div className="record-victory__multi-header">
              {items.length} victories detected
            </div>
          )}

          {/* Victory items */}
          {items.map((item, index) => (
            <div key={index} className={`record-victory__item ${isMulti ? 'record-victory__item--multi' : ''}`}>
              {isMulti && (
                <div className="record-victory__item-header" onClick={() => setExpandedItem(expandedItem === index ? null : index)}>
                  <span className="record-victory__item-desc">{item.description}</span>
                  <div className="record-victory__item-actions">
                    <button
                      type="button"
                      className="record-victory__tag-remove"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                      aria-label="Remove"
                    >
                      <X size={14} />
                    </button>
                    {expandedItem === index ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              )}

              {(!isMulti || expandedItem === index) && (
                <div className="record-victory__item-detail">
                  {isMulti && (
                    <label className="record-victory__label">
                      Description
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                        className="record-victory__input"
                      />
                    </label>
                  )}

                  {item.celebration_text && (
                    <label className="record-victory__label">
                      Celebration
                      <textarea
                        value={item.celebration_text}
                        onChange={(e) => handleUpdateItem(index, 'celebration_text', e.target.value)}
                        rows={2}
                        className="record-victory__textarea record-victory__textarea--celebration"
                      />
                    </label>
                  )}

                  {item.life_area_tag && (
                    <div className="record-victory__tag-row">
                      <span className="record-victory__tag-label">Life area:</span>
                      <span className="record-victory__tag">
                        {LIFE_AREA_LABELS[item.life_area_tag] || item.life_area_tag}
                      </span>
                      <button
                        type="button"
                        className="record-victory__tag-remove"
                        onClick={() => handleUpdateItem(index, 'life_area_tag', null)}
                        aria-label="Remove tag"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {connectedMast(item.mast_connection_id) && (
                    <div className="record-victory__connection">
                      <span className="record-victory__connection-label">Connected to Mast:</span>
                      <span className="record-victory__connection-text">{connectedMast(item.mast_connection_id)!.text}</span>
                      <button
                        type="button"
                        className="record-victory__tag-remove"
                        onClick={() => handleUpdateItem(index, 'mast_connection_id', null)}
                        aria-label="Remove connection"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="record-victory__footer">
          <Button variant="text" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!description.trim() && items.length === 0)}
            className="record-victory__save-btn"
          >
            {saving ? 'Saving...' : isMulti ? `Record ${items.length} Victories` : 'Record Victory'}
          </Button>
        </div>

        <SparkleOverlay show={saved} size="full" />
      </div>
    </div>
  );
}
