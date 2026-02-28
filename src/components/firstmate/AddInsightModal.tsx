import { useState, useRef } from 'react';
import { PenLine, MessageSquare, Upload } from 'lucide-react';
import { AddEntryModal } from '../shared/AddEntryModal';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useHelmContext } from '../../contexts/HelmContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { SpouseInsightCategory, SpouseInsightSourceType } from '../../lib/types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS, SPOUSE_INSIGHT_CATEGORY_ORDER } from '../../lib/types';

interface ExtractedInsight {
  text: string;
  category: string;
  confidence: number;
  source_label?: string;
  included: boolean;
}

interface AddInsightModalProps {
  onClose: () => void;
  onSave: (data: {
    text: string;
    category: SpouseInsightCategory;
    source_type?: SpouseInsightSourceType;
    source_label?: string;
    file_storage_path?: string;
    is_rag_indexed?: boolean;
    source_reference_id?: string;
  }) => Promise<unknown>;
  preselectedCategory?: SpouseInsightCategory;
}

export function AddInsightModal({ onClose, onSave, preselectedCategory }: AddInsightModalProps) {
  const { startGuidedConversation } = useHelmContext();
  const { user } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'select' | 'write' | 'file' | 'review'>('select');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<SpouseInsightCategory>(preselectedCategory || 'general');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileStoragePath, setFileStoragePath] = useState('');
  const [extractedInsights, setExtractedInsights] = useState<ExtractedInsight[]>([]);
  const [extractedTextLength, setExtractedTextLength] = useState(0);
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) { setError('Content cannot be empty.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        text: text.trim(),
        category,
        source_label: source.trim() || undefined,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError(null);
    setFileName(file.name);

    try {
      // Upload to storage
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const storagePath = `firstmate/${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from('manifest-files')
        .upload(storagePath, file);

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
      setFileStoragePath(storagePath);

      // Call extract-insights Edge Function
      const { data, error: extractErr } = await supabase.functions.invoke('extract-insights', {
        body: {
          user_id: user.id,
          file_storage_path: storagePath,
          file_type: ext,
          extraction_target: 'spouse',
        },
      });

      if (extractErr) throw new Error(extractErr.message);
      if (data?.error) throw new Error(data.error);

      const insights: ExtractedInsight[] = (data.insights || []).map(
        (ins: { text: string; category: string; confidence: number; source_label?: string }) => ({
          ...ins,
          included: ins.confidence >= 0.5,
        }),
      );

      setExtractedInsights(insights);
      setExtractedTextLength(data.extracted_text_length || 0);
      setMode('review');
    } catch (err) {
      setError((err as Error).message || 'Failed to process file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveExtracted = async () => {
    const selected = extractedInsights.filter((i) => i.included);
    if (selected.length === 0) { setError('Select at least one insight to save.'); return; }

    setSaving(true);
    setError(null);
    try {
      // Check if large file needs RAG bridge
      const isLargeFile = extractedTextLength > 12000;
      let manifestItemId: string | undefined;

      if (isLargeFile && user) {
        // Create manifest_items record for RAG indexing
        const { data: manifestItem, error: mErr } = await supabase
          .from('manifest_items')
          .insert({
            user_id: user.id,
            title: fileName,
            file_type: fileName.split('.').pop()?.toLowerCase() || 'txt',
            storage_path: fileStoragePath,
            usage_designations: ['general_reference'],
            processing_status: 'pending',
            intake_completed: true,
            tags: ['spouse', 'relationship'],
            folder_grouping: 'First Mate Uploads',
          })
          .select('id')
          .single();

        if (!mErr && manifestItem) {
          manifestItemId = manifestItem.id;
          // Trigger manifest-process for chunking/embedding (fire and forget)
          supabase.functions.invoke('manifest-process', {
            body: { manifest_item_id: manifestItem.id, user_id: user.id },
          });
        }
      }

      // Save each selected insight
      for (const insight of selected) {
        await onSave({
          text: insight.text,
          category: insight.category as SpouseInsightCategory,
          source_type: 'uploaded_file',
          source_label: insight.source_label || fileName,
          file_storage_path: fileStoragePath,
          is_rag_indexed: isLargeFile,
          source_reference_id: manifestItemId,
        });
      }

      onClose();
    } catch {
      setError('Failed to save insights. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateInsight = (index: number, updates: Partial<ExtractedInsight>) => {
    setExtractedInsights((prev) =>
      prev.map((ins, i) => (i === index ? { ...ins, ...updates } : ins)),
    );
  };

  const highConfidence = extractedInsights.filter((i) => i.confidence >= 0.5);
  const lowConfidence = extractedInsights.filter((i) => i.confidence < 0.5);
  const selectedCount = extractedInsights.filter((i) => i.included).length;

  return (
    <AddEntryModal title="Add Insight" onClose={onClose}>
      {mode === 'select' ? (
        <div className="add-entry-methods">
          <button className="add-entry-method" onClick={() => setMode('write')}>
            <PenLine size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Write it myself</div>
              <div className="add-entry-method__desc">Add an insight about your partner directly</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => setMode('file')}>
            <Upload size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Upload a file</div>
              <div className="add-entry-method__desc">Upload an assessment, screenshot, or document</div>
            </div>
          </button>
          <button className="add-entry-method" onClick={() => { startGuidedConversation('first_mate_action'); onClose(); }}>
            <MessageSquare size={22} className="add-entry-method__icon" />
            <div className="add-entry-method__content">
              <div className="add-entry-method__label">Discuss at The Helm</div>
              <div className="add-entry-method__desc">Guided conversation about your partner</div>
            </div>
          </button>
        </div>
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
                Upload a personality assessment, screenshot, or document about your partner.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.md,.txt,.docx"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
            </>
          )}

          {error && (
            <div className="add-entry-form__error-block">
              <p className="add-entry-form__error">{error}</p>
              <div className="add-entry-form__actions">
                <Button variant="secondary" onClick={() => { setError(null); fileInputRef.current?.click(); }}>
                  Try Again
                </Button>
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
            Review Extracted Insights ({extractedInsights.length} found)
          </p>

          <div className="extracted-insights-list">
            {highConfidence.map((insight) => {
              const idx = extractedInsights.indexOf(insight);
              return (
                <div key={idx} className="extracted-insight-card">
                  <label className="extracted-insight-card__check">
                    <input
                      type="checkbox"
                      checked={insight.included}
                      onChange={(e) => updateInsight(idx, { included: e.target.checked })}
                    />
                  </label>
                  <div className="extracted-insight-card__body">
                    <textarea
                      className="extracted-insight-card__text"
                      value={insight.text}
                      onChange={(e) => updateInsight(idx, { text: e.target.value })}
                      rows={2}
                    />
                    <select
                      className="extracted-insight-card__category"
                      value={insight.category}
                      onChange={(e) => updateInsight(idx, { category: e.target.value })}
                    >
                      {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
                        <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
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
                  {showLowConfidence ? 'Hide' : 'Show'} {lowConfidence.length} lower-confidence insight{lowConfidence.length !== 1 ? 's' : ''}
                </button>
                {showLowConfidence && lowConfidence.map((insight) => {
                  const idx = extractedInsights.indexOf(insight);
                  return (
                    <div key={idx} className="extracted-insight-card extracted-insight-card--low">
                      <label className="extracted-insight-card__check">
                        <input
                          type="checkbox"
                          checked={insight.included}
                          onChange={(e) => updateInsight(idx, { included: e.target.checked })}
                        />
                      </label>
                      <div className="extracted-insight-card__body">
                        <textarea
                          className="extracted-insight-card__text"
                          value={insight.text}
                          onChange={(e) => updateInsight(idx, { text: e.target.value })}
                          rows={2}
                        />
                        <select
                          className="extracted-insight-card__category"
                          value={insight.category}
                          onChange={(e) => updateInsight(idx, { category: e.target.value })}
                        >
                          {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
                            <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
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
              {saving ? 'Saving...' : `Save ${selectedCount} of ${extractedInsights.length}`}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="add-entry-form">
          {!preselectedCategory && (
            <button className="add-entry-form__back" onClick={() => setMode('select')}>
              Back to options
            </button>
          )}
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Category</label>
            <select className="add-entry-form__select" value={category} onChange={(e) => setCategory(e.target.value as SpouseInsightCategory)}>
              {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Insight</label>
            <textarea className="add-entry-form__textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What have you learned about them?" rows={4} autoFocus />
          </div>
          <div className="add-entry-form__field">
            <label className="add-entry-form__label">Source (optional)</label>
            <input
              className="add-entry-form__input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder='e.g., "Her journal", "Love Languages quiz"'
            />
          </div>
          {error && <p className="add-entry-form__error">{error}</p>}
          <div className="add-entry-form__actions">
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </AddEntryModal>
  );
}
