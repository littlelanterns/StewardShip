import { useState, useCallback, useRef } from 'react';
import { X, Trash2, Check, Upload, FileText, FileCode, Image, XCircle, Loader } from 'lucide-react';
import { Button } from './Button';
import { sendChatMessage } from '../../lib/ai';
import { extractTextFromFile } from '../../lib/extractText';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import './BulkAddWithAISort.css';

export interface ParsedBulkItem {
  text: string;
  category?: string;
  selected: boolean;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface BulkAddWithAISortProps {
  title: string;
  placeholder: string;
  categories?: CategoryOption[];
  parsePrompt: string;
  initialText?: string;
  onSave: (items: ParsedBulkItem[]) => Promise<void>;
  onClose: () => void;
  enableFileUpload?: boolean;
  fileUploadLabel?: string;
}

const ACCEPTED_EXTENSIONS = '.md,.txt,.pdf,.docx,.png,.jpg,.jpeg,.webp';
const SUPPORTED_EXTENSIONS = new Set(['md', 'txt', 'pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && IMAGE_EXTENSIONS.has(ext)) return Image;
  if (ext === 'pdf' || ext === 'docx') return FileText;
  if (ext === 'md') return FileCode;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BulkAddWithAISort({
  title,
  placeholder,
  categories,
  parsePrompt,
  initialText,
  onSave,
  onClose,
  enableFileUpload = true,
  fileUploadLabel,
}: BulkAddWithAISortProps) {
  const { user } = useAuthContext();
  const [inputText, setInputText] = useState(initialText || '');
  const [parsedItems, setParsedItems] = useState<ParsedBulkItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [storageChoice, setStorageChoice] = useState<'extract_only' | 'store_in_manifest' | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCategory = categories?.[0]?.value;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
      setError('Unsupported file type. Please upload .md, .txt, .pdf, .docx, or image files (.png, .jpg, .webp).');
      return;
    }

    setError(null);
    setSelectedFile(file);
    setStorageChoice(null);
    setUploadedFileName(null);

    // Images skip the storage choice — go straight to extraction (vision)
    if (ext && IMAGE_EXTENSIONS.has(ext)) {
      // Defer to next tick so selectedFile state is set
      setTimeout(() => handleExtractFile(file, 'extract_only'), 0);
    }
  }, []);

  const handleExtractFile = useCallback(async (file: File, choice: 'extract_only' | 'store_in_manifest') => {
    if (!file || !user) return;

    setStorageChoice(choice);
    setExtracting(true);
    setError(null);

    try {
      // Extract text from the file
      const result = await extractTextFromFile(file);

      if (result.error || !result.text.trim()) {
        setError(result.error || 'No text could be extracted from this file.');
        setExtracting(false);
        return;
      }

      // Populate the textarea with extracted text
      setInputText(result.text);
      setUploadedFileName(file.name);
      setSelectedFile(null);

      // If user chose to store in Manifest, upload in background (not for images)
      if (choice === 'store_in_manifest') {
        uploadToManifest(file).catch((err) =>
          console.error('Manifest upload failed:', err)
        );
      }
    } catch (err) {
      setError((err as Error).message || 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  }, [user]);

  const handleExtract = useCallback((choice: 'extract_only' | 'store_in_manifest') => {
    if (selectedFile) {
      handleExtractFile(selectedFile, choice);
    }
  }, [selectedFile, handleExtractFile]);

  const uploadToManifest = async (file: File) => {
    if (!user) return;

    const storagePath = `${user.id}/${Date.now()}_${file.name}`;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const fileType = (ext === 'pdf') ? 'pdf'
      : (ext === 'docx') ? 'docx'
        : (ext === 'md') ? 'md'
          : 'txt';

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from('manifest-files')
      .upload(storagePath, file);

    if (uploadErr) {
      console.error('Manifest storage upload failed:', uploadErr.message);
      return;
    }

    // Create manifest_items record
    const { data: item, error: insertErr } = await supabase
      .from('manifest_items')
      .insert({
        user_id: user.id,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_type: fileType,
        file_name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        processing_status: 'pending',
        usage_designations: ['general_reference'],
        folder_group: 'Uncategorized',
        tags: [],
      })
      .select()
      .single();

    if (insertErr || !item) {
      console.error('Manifest record creation failed:', insertErr?.message);
      return;
    }

    // Trigger processing (fire and forget)
    supabase.functions
      .invoke('manifest-process', {
        body: { manifest_item_id: item.id, user_id: user.id },
      })
      .catch((err) => console.error('Manifest processing trigger failed:', err));
  };

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadedFileName(null);
    setStorageChoice(null);
    setInputText('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleParse = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !user) return;

    setParsing(true);
    setError(null);

    try {
      const categoryList = categories
        ? categories.map((c) => `"${c.value}" (${c.label})`).join(', ')
        : '';

      const systemPrompt = categories
        ? `${parsePrompt}\n\nValid categories: ${categoryList}\n\nReturn ONLY a JSON array of objects with "text" and "category" fields. Example: [{"text": "item text", "category": "category_value"}]. No other text.`
        : `${parsePrompt}\n\nReturn ONLY a JSON array of strings. Example: ["item 1", "item 2"]. No other text.`;

      const response = await sendChatMessage(
        systemPrompt,
        [{ role: 'user', content: trimmed }],
        1024,
        user.id,
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          const items: ParsedBulkItem[] = parsed
            .map((item): ParsedBulkItem | null => {
              if (typeof item === 'string') {
                return { text: item.trim(), category: defaultCategory, selected: true };
              }
              if (item && typeof item === 'object' && typeof item.text === 'string') {
                const cat = categories
                  ? (categories.some((c) => c.value === item.category) ? item.category : defaultCategory)
                  : undefined;
                return { text: item.text.trim(), category: cat, selected: true };
              }
              return null;
            })
            .filter((item): item is ParsedBulkItem => item !== null && item.text.length > 0);

          if (items.length > 0) {
            setParsedItems(items);
            setStep('preview');
            return;
          }
        }
      }
      // If we got here, AI response wasn't valid — fall through to fallback
      throw new Error('Could not parse AI response');
    } catch {
      // Fallback: line splitting
      const fallbackItems = trimmed
        .split(/[\n,]/)
        .map((line) => line.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter((line) => line.length > 0)
        .map((text) => ({ text, category: defaultCategory, selected: true }));

      if (fallbackItems.length > 0) {
        setParsedItems(fallbackItems);
        setStep('preview');
      } else {
        setError('Could not parse items. Please try a different format.');
      }
    } finally {
      setParsing(false);
    }
  }, [inputText, user, parsePrompt, categories, defaultCategory]);

  const handleToggleItem = useCallback((index: number) => {
    setParsedItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const handleEditText = useCallback((index: number, newText: string) => {
    setParsedItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, text: newText } : item
    ));
  }, []);

  const handleEditCategory = useCallback((index: number, newCategory: string) => {
    setParsedItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, category: newCategory } : item
    ));
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    const selected = parsedItems.filter((item) => item.selected && item.text.trim().length > 0);
    if (selected.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch {
      setError('Failed to save items. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [parsedItems, onSave, onClose]);

  const selectedCount = parsedItems.filter((item) => item.selected && item.text.trim().length > 0).length;

  const FileIcon = selectedFile ? getFileIcon(selectedFile.name) : Upload;

  return (
    <div className="bulk-add-ai">
      <div className="bulk-add-ai__header">
        <h3 className="bulk-add-ai__title">{title}</h3>
        <button type="button" className="bulk-add-ai__close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {error && <p className="bulk-add-ai__error">{error}</p>}

      {step === 'input' && (
        <div className="bulk-add-ai__input-step">
          <p className="bulk-add-ai__hint">
            Paste or type multiple items. Any format works — one per line, comma-separated, or freeform text.
          </p>

          {/* File upload section */}
          {enableFileUpload && !uploadedFileName && !selectedFile && (
            <div className="bulk-add-ai__file-zone" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} className="bulk-add-ai__file-zone-icon" />
              <span className="bulk-add-ai__file-zone-text">
                {fileUploadLabel || 'Or upload a file'}
              </span>
              <span className="bulk-add-ai__file-zone-hint">.md, .txt, .pdf, .docx, images</span>
            </div>
          )}

          {/* File selected — show storage choice (not for images, which auto-extract via vision) */}
          {selectedFile && !extracting && !IMAGE_EXTENSIONS.has(selectedFile.name.split('.').pop()?.toLowerCase() || '') && (
            <div className="bulk-add-ai__file-selected">
              <div className="bulk-add-ai__file-info">
                <FileIcon size={18} />
                <span className="bulk-add-ai__file-name">{selectedFile.name}</span>
                <span className="bulk-add-ai__file-size">{formatFileSize(selectedFile.size)}</span>
                <button
                  type="button"
                  className="bulk-add-ai__file-clear"
                  onClick={clearFile}
                  aria-label="Remove file"
                >
                  <XCircle size={16} />
                </button>
              </div>
              <div className="bulk-add-ai__storage-choice">
                <button
                  type="button"
                  className="bulk-add-ai__storage-btn"
                  onClick={() => handleExtract('extract_only')}
                >
                  <span className="bulk-add-ai__storage-btn-title">Just extract the text</span>
                  <span className="bulk-add-ai__storage-btn-desc">File is not stored after extraction</span>
                </button>
                <button
                  type="button"
                  className="bulk-add-ai__storage-btn"
                  onClick={() => handleExtract('store_in_manifest')}
                >
                  <span className="bulk-add-ai__storage-btn-title">Store in Manifest & extract</span>
                  <span className="bulk-add-ai__storage-btn-desc">File stays in your library for future reference</span>
                </button>
              </div>
            </div>
          )}

          {/* Extracting spinner */}
          {extracting && (
            <div className="bulk-add-ai__extracting">
              <Loader size={18} className="bulk-add-ai__extracting-spinner" />
              <span>
                {selectedFile && IMAGE_EXTENSIONS.has(selectedFile.name.split('.').pop()?.toLowerCase() || '')
                  ? `Reading image ${selectedFile.name}...`
                  : `Extracting text from ${selectedFile?.name || 'file'}...`
                }
              </span>
            </div>
          )}

          {/* Uploaded file badge */}
          {uploadedFileName && (
            <div className="bulk-add-ai__file-badge">
              <FileText size={14} />
              <span>Loaded from {uploadedFileName}</span>
              <button
                type="button"
                className="bulk-add-ai__file-clear"
                onClick={clearFile}
                aria-label="Clear file"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="bulk-add-ai__file-input"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
          />

          <textarea
            className="bulk-add-ai__textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            rows={8}
            autoFocus={!enableFileUpload}
          />
          <div className="bulk-add-ai__actions">
            <Button onClick={handleParse} disabled={!inputText.trim() || parsing}>
              {parsing ? 'Sorting...' : 'Sort This'}
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="bulk-add-ai__preview-step">
          <p className="bulk-add-ai__hint">
            {parsedItems.length} item{parsedItems.length !== 1 ? 's' : ''} found.
            {selectedCount < parsedItems.length && ` ${selectedCount} selected.`}
            {' '}Edit, recategorize, or deselect before saving.
          </p>
          <div className="bulk-add-ai__preview-list">
            {parsedItems.map((item, index) => (
              <div key={index} className={`bulk-add-ai__preview-item${item.selected ? '' : ' bulk-add-ai__preview-item--deselected'}`}>
                <button
                  type="button"
                  className={`bulk-add-ai__checkbox${item.selected ? ' bulk-add-ai__checkbox--checked' : ''}`}
                  onClick={() => handleToggleItem(index)}
                  aria-label={item.selected ? 'Deselect' : 'Select'}
                >
                  {item.selected && <Check size={12} />}
                </button>
                <input
                  type="text"
                  className="bulk-add-ai__preview-input"
                  value={item.text}
                  onChange={(e) => handleEditText(index, e.target.value)}
                />
                {categories && (
                  <select
                    className="bulk-add-ai__category-select"
                    value={item.category || ''}
                    onChange={(e) => handleEditCategory(index, e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="bulk-add-ai__preview-delete"
                  onClick={() => handleRemoveItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="bulk-add-ai__actions">
            <Button onClick={handleSave} disabled={selectedCount === 0 || saving}>
              {saving ? 'Saving...' : `Save Selected (${selectedCount})`}
            </Button>
            <Button variant="secondary" onClick={() => { setStep('input'); setError(null); }}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
