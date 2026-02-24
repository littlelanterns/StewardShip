import { useState } from 'react';
import { Button } from '../shared';
import './AreaEditor.css';

interface AreaEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function AreaEditor({ initialValue, onSave, onCancel }: AreaEditorProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="area-editor">
      <textarea
        className="area-editor__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write your reflection here..."
        rows={4}
        autoFocus
      />
      <div className="area-editor__actions">
        <Button size="sm" onClick={() => onSave(value.trim())} disabled={!value.trim()}>
          Save
        </Button>
        <Button size="sm" variant="text" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
