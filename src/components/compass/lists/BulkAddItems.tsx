import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '../../shared/Button';
import { parseBulkItems } from '../../../lib/bulkParse';
import { useAuthContext } from '../../../contexts/AuthContext';
import './BulkAddItems.css';

interface BulkAddItemsProps {
  listTitle: string;
  onAddItems: (items: string[]) => Promise<void>;
  onClose: () => void;
}

export default function BulkAddItems({ listTitle, onAddItems, onClose }: BulkAddItemsProps) {
  const { user } = useAuthContext();
  const [inputText, setInputText] = useState('');
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleParse = async () => {
    if (!inputText.trim() || !user) return;
    setParsing(true);
    try {
      const items = await parseBulkItems(inputText, listTitle, user.id);
      setParsedItems(items);
      setStep('preview');
    } catch {
      // Fallback handled inside parseBulkItems
      setParsedItems(inputText.split('\n').map((l) => l.trim()).filter(Boolean));
      setStep('preview');
    } finally {
      setParsing(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number, newText: string) => {
    setParsedItems((prev) => prev.map((item, i) => (i === index ? newText : item)));
  };

  const handleAddAll = async () => {
    const valid = parsedItems.filter((item) => item.trim().length > 0);
    if (valid.length === 0) return;
    setAdding(true);
    try {
      await onAddItems(valid);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bulk-add">
      <div className="bulk-add__header">
        <h3 className="bulk-add__title">Bulk Add Items</h3>
        <button type="button" className="bulk-add__close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {step === 'input' && (
        <div className="bulk-add__input-step">
          <p className="bulk-add__hint">
            Paste or type multiple items. One per line, comma-separated, or freeform text.
          </p>
          <textarea
            className="bulk-add__textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Eggs, milk, bread&#10;Chicken thighs&#10;Olive oil"
            rows={6}
            autoFocus
          />
          <div className="bulk-add__actions">
            <Button onClick={handleParse} disabled={!inputText.trim() || parsing}>
              {parsing ? 'Parsing...' : 'Parse Items'}
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="bulk-add__preview-step">
          <p className="bulk-add__hint">
            {parsedItems.length} item{parsedItems.length !== 1 ? 's' : ''} found. Edit or remove before adding.
          </p>
          <div className="bulk-add__preview-list">
            {parsedItems.map((item, index) => (
              <div key={index} className="bulk-add__preview-item">
                <input
                  type="text"
                  className="bulk-add__preview-input"
                  value={item}
                  onChange={(e) => handleEditItem(index, e.target.value)}
                />
                <button
                  type="button"
                  className="bulk-add__preview-delete"
                  onClick={() => handleRemoveItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="bulk-add__actions">
            <Button onClick={handleAddAll} disabled={parsedItems.length === 0 || adding}>
              {adding ? 'Adding...' : `Add All (${parsedItems.length})`}
            </Button>
            <Button variant="secondary" onClick={() => setStep('input')}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
