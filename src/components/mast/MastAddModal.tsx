import { useState, useRef } from 'react';
import { PenLine, MessageSquare, Upload, ListPlus } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { BulkAddWithAISort, type ParsedBulkItem } from '../shared/BulkAddWithAISort';
import { useHelmContext } from '../../contexts/HelmContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { MastEntryType } from '../../lib/types';
import { MAST_TYPE_LABELS, MAST_TYPE_ORDER } from '../../lib/types';

const MAST_BULK_CATEGORIES = MAST_TYPE_ORDER.map((t) => ({ value: t, label: MAST_TYPE_LABELS[t] }));

const MAST_BULK_PROMPT = `You are parsing text into guiding principles for a personal growth app. Each item should be categorized as one of: "value" (core values), "declaration" (commitment statements about who the user is choosing to become), "faith_foundation" (faith or spiritual beliefs), "scripture_quote" (scriptures, quotes, or sayings), or "vision" (vision statements about the future). Extract individual principles from the input. Return a JSON array of objects with "text" and "category" fields.`;

interface ExtractedPrinciple {
  text: string;
  category: string;
  confidence: number;
  source_label?: string;
  included: boolean;
}

interface MastAddModalProps {
  onClose: () => void;
  onCreate: (data: { type: MastEntryType; text: string; category?: string }) => Promise<unknown>;
  preselectedType?: MastEntryType | null;
}

export function MastAddModal({ onClose, onCreate, preselectedType }: MastAddModalProps) {
  const { startGuidedConversation } = useHelmContext();
  const { user } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'select' | 'write' | 'file' | 'review' | 'bulk'>(preselectedType ? 'write' : 'select');
  const [type, setType] = useState<MastEntryType>(preselectedType || 'value');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [extractedPrinciples, setExtractedPrinciples] = useState<ExtractedPrinciple[]>([]);
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const handleBulkSave = async (items: ParsedBulkItem[]) => {
    for (const item of items) {
      await onCreate({
        type: (item.category as MastEntryType) || 'value',
        text: item.text,
      });
    }
  };

  async function handleSave() {
    if (!text.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ type, text: text.trim(), category: category.trim() || undefined });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError(null);
    setFileName(file.name);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const storagePath = `${user.id}/mast/${Date.now()}_${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from('manifest-files')
        .upload(storagePath, file);

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data, error: extractErr } = await supabase.functions.invoke('extract-insights', {
        body: {
          user_id: user.id,
          file_storage_path: storagePath,
          file_type: ext,
          extraction_target: 'mast',
        },
      });

      if (extractErr) throw new Error(extractErr.message);
      if (data?.error) throw new Error(data.error);

      const principles: ExtractedPrinciple[] = (data.insights || []).map(
        (ins: { text: string; category: string; confidence: number; source_label?: string }) => ({
          ...ins,
          included: ins.confidence >= 0.5,
        }),
      );

      setExtractedPrinciples(principles);
      setMode('review');
    } catch (err) {
      setError((err as Error).message || 'Failed to process file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveExtracted = async () => {
    const selected = extractedPrinciples.filter((i) => i.included);
    if (selected.length === 0) { setError('Select at least one principle to save.'); return; }

    setSaving(true);
    setError(null);
    try {
      for (const principle of selected) {
        await onCreate({
          type: principle.category as MastEntryType,
          text: principle.text,
          category: principle.source_label || undefined,
        });
      }
      onClose();
    } catch {
      setError('Failed to save principles. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updatePrinciple = (index: number, updates: Partial<ExtractedPrinciple>) => {
    setExtractedPrinciples((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    );
  };

  const highConfidence = extractedPrinciples.filter((p) => p.confidence >= 0.5);
  const lowConfidence = extractedPrinciples.filter((p) => p.confidence < 0.5);
  const selectedCount = extractedPrinciples.filter((p) => p.included).length;

  return (
    <AddEntryModal title="Add Principle" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Type your principle directly</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('file')}>
            <Upload size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Upload a file</div>
              <div className="add-entry-method__desc">Extract principles from a document</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => { startGuidedConversation('declaration'); onClose(); }}>
            <MessageSquare size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Craft it at The Helm</div>
              <div className="add-entry-method__desc">Guided conversation to articulate your principle</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('bulk')}>
            <ListPlus size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Bulk Add</div>
              <div className="add-entry-method__desc">Paste multiple principles at once</div>
            </div>
          </button>
        </div>
      ) : mode === 'bulk' ? (
        <BulkAddWithAISort
          title="Bulk Add Principles"
          placeholder={"Paste principles, beliefs, vision statements...\n\nI choose to lead with patience.\nFamily is my highest priority.\n\"Trust in the Lord with all thine heart\" - Proverbs 3:5"}
          categories={MAST_BULK_CATEGORIES}
          parsePrompt={MAST_BULK_PROMPT}
          onSave={handleBulkSave}
          onClose={onClose}
        />
      ) : mode === 'file' ? (
        <div className="add-entry-form">
          <button className="add-entry-form__back" onClick={() => setMode('select')}>
            Back to options
          </button>

          {uploading ? (
            <div className="add-entry-file-processing">
              <LoadingSpinner />
              <p>Analyzing {fileName}...</p>
            </div>
          ) : (
            <>
              <p className="add-entry-form__desc">
                Upload a document containing principles, values, scriptures, or vision statements.
              </p>
              <label
                className="btn btn--secondary"
                style={{ cursor: 'pointer', display: 'inline-block', position: 'relative', overflow: 'hidden' }}
              >
                Choose File
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.md,.txt,.docx"
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  onChange={handleFileSelect}
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                />
              </label>
            </>
          )}

          {error && (
            <div className="add-entry-form__error-block">
              <p className="add-entry-form__error">{error}</p>
              <div className="add-entry-form__actions">
                <label
                  className="btn btn--secondary"
                  style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => setError(null)}
                >
                  Try Again
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.md,.txt,.docx"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    onChange={handleFileSelect}
                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  />
                </label>
                <Button variant="secondary" onClick={() => { setError(null); setMode('write'); }}>
                  Write It Myself Instead
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : mode === 'review' ? (
        <div className="add-entry-form">
          <button className="add-entry-form__back" onClick={() => setMode('file')}>
            Back
          </button>
          <p className="add-entry-form__desc" style={{ marginBottom: 'var(--spacing-sm)' }}>
            Review Extracted Principles ({extractedPrinciples.length} found)
          </p>

          <div className="extracted-insights-list">
            {highConfidence.map((principle) => {
              const idx = extractedPrinciples.indexOf(principle);
              return (
                <div key={idx} className="extracted-insight-card">
                  <label className="extracted-insight-card__check">
                    <input
                      type="checkbox"
                      checked={principle.included}
                      onChange={(e) => updatePrinciple(idx, { included: e.target.checked })}
                    />
                  </label>
                  <div className="extracted-insight-card__body">
                    <textarea
                      className="extracted-insight-card__text"
                      value={principle.text}
                      onChange={(e) => updatePrinciple(idx, { text: e.target.value })}
                      rows={2}
                    />
                    <select
                      className="extracted-insight-card__category"
                      value={principle.category}
                      onChange={(e) => updatePrinciple(idx, { category: e.target.value })}
                    >
                      {MAST_TYPE_ORDER.map((t) => (
                        <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}

            {lowConfidence.length > 0 && (
              <>
                <button
                  className="add-entry-form__toggle"
                  onClick={() => setShowLowConfidence(!showLowConfidence)}
                >
                  {showLowConfidence ? 'Hide' : 'Show'} {lowConfidence.length} lower-confidence principle{lowConfidence.length !== 1 ? 's' : ''}
                </button>
                {showLowConfidence && lowConfidence.map((principle) => {
                  const idx = extractedPrinciples.indexOf(principle);
                  return (
                    <div key={idx} className="extracted-insight-card extracted-insight-card--low">
                      <label className="extracted-insight-card__check">
                        <input
                          type="checkbox"
                          checked={principle.included}
                          onChange={(e) => updatePrinciple(idx, { included: e.target.checked })}
                        />
                      </label>
                      <div className="extracted-insight-card__body">
                        <textarea
                          className="extracted-insight-card__text"
                          value={principle.text}
                          onChange={(e) => updatePrinciple(idx, { text: e.target.value })}
                          rows={2}
                        />
                        <select
                          className="extracted-insight-card__category"
                          value={principle.category}
                          onChange={(e) => updatePrinciple(idx, { category: e.target.value })}
                        >
                          {MAST_TYPE_ORDER.map((t) => (
                            <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {error && <p className="add-entry-form__error">{error}</p>}

          <div className="add-entry-form__actions">
            <Button variant="primary" onClick={handleSaveExtracted} disabled={saving || selectedCount === 0}>
              {saving ? 'Saving...' : `Save ${selectedCount} of ${extractedPrinciples.length}`}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="add-entry-form">
          {!preselectedType && (
            <button className="add-entry-form__back" onClick={() => setMode('select')}>
              Back to options
            </button>
          )}
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Type</label>
            <select
              className="add-entry-form__select"
              value={type}
              onChange={(e) => setType(e.target.value as MastEntryType)}
            >
              {MAST_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{MAST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Content</label>
            <textarea
              className="add-entry-form__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your principle..."
              rows={4}
              autoFocus
            />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Category (optional)</label>
            <input
              className="add-entry-form__input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder='e.g., "Marriage", "Work", "Faith"'
            />
          </div>
          {error && <p className="add-entry-form__error">{error}</p>}
          <div className="add-entry-form__actions">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </AddEntryModal>
  );
}
