import { useState, useCallback } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { Button } from './Button';
import { sendChatMessage } from '../../lib/ai';
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
}

export function BulkAddWithAISort({
  title,
  placeholder,
  categories,
  parsePrompt,
  initialText,
  onSave,
  onClose,
}: BulkAddWithAISortProps) {
  const { user } = useAuthContext();
  const [inputText, setInputText] = useState(initialText || '');
  const [parsedItems, setParsedItems] = useState<ParsedBulkItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [error, setError] = useState<string | null>(null);

  const defaultCategory = categories?.[0]?.value;

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
            .map((item) => {
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
          <textarea
            className="bulk-add-ai__textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            rows={8}
            autoFocus
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
