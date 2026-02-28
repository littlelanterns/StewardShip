import { useState } from 'react';
import { Card, Button } from '../shared';

interface GratitudeCaptureProps {
  spouseName: string;
  onSave: (text: string) => Promise<{ logEntryId: string; insightId: string } | null>;
}

export function GratitudeCapture({ spouseName, onSave }: GratitudeCaptureProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const result = await onSave(text.trim());
    setSaving(false);
    if (result) {
      setText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <Card className="gratitude-capture">
      <h3 className="gratitude-capture__title">Quick Gratitude</h3>
      <p className="gratitude-capture__desc">What are you grateful for about {spouseName} today?</p>
      <textarea
        className="gratitude-capture__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Something about ${spouseName} you appreciate...`}
        rows={2}
      />
      <div className="gratitude-capture__actions">
        <Button variant="primary" onClick={handleSave} disabled={saving || !text.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {saved && <span className="gratitude-capture__saved">Saved to Journal and insights</span>}
      </div>
    </Card>
  );
}
