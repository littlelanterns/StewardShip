import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button, Input } from '../shared';
import type { MeetingAgendaSection, MeetingFrequency } from '../../lib/types';
import { MEETING_FREQUENCY_LABELS } from '../../lib/types';

interface CustomTemplateEditorProps {
  onSave: (data: {
    name: string;
    description: string;
    default_frequency: MeetingFrequency;
    agenda_sections: MeetingAgendaSection[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function CustomTemplateEditor({ onSave, onCancel }: CustomTemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<MeetingFrequency>('weekly');
  const [sections, setSections] = useState<MeetingAgendaSection[]>([
    { title: '', ai_prompt_text: '', sort_order: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addSection = useCallback(() => {
    setSections(prev => [...prev, {
      title: '',
      ai_prompt_text: '',
      sort_order: prev.length,
    }]);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })));
  }, []);

  const updateSection = useCallback((index: number, field: 'title' | 'ai_prompt_text', value: string) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    if (sections.every(s => !s.title.trim())) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        default_frequency: frequency,
        agenda_sections: sections.filter(s => s.title.trim()),
      });
    } finally {
      setSaving(false);
    }
  }, [name, description, frequency, sections, onSave]);

  return (
    <div className="template-editor">
      <h3 className="template-editor__title">Create Custom Template</h3>

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Template Name</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Monthly Family Council"
        />
      </div>

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Description (optional)</label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What this meeting is for"
        />
      </div>

      <div className="schedule-editor__field">
        <label className="schedule-editor__label">Default Frequency</label>
        <select
          className="schedule-editor__select"
          value={frequency}
          onChange={e => setFrequency(e.target.value as MeetingFrequency)}
        >
          {Object.entries(MEETING_FREQUENCY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <label className="schedule-editor__label" style={{ marginBottom: '0.5rem', display: 'block' }}>
        Agenda Sections
      </label>

      {sections.map((section, index) => (
        <div key={index} className="template-editor__section">
          <div className="template-editor__section-number">{index + 1}</div>
          <div className="template-editor__section-content">
            <input
              className="template-editor__section-title-input"
              value={section.title}
              onChange={e => updateSection(index, 'title', e.target.value)}
              placeholder="Section title"
            />
            <textarea
              className="template-editor__section-prompt-input"
              value={section.ai_prompt_text}
              onChange={e => updateSection(index, 'ai_prompt_text', e.target.value)}
              placeholder="AI prompt for this section (what the AI will ask)"
            />
          </div>
          {sections.length > 1 && (
            <button
              type="button"
              className="template-editor__section-remove"
              onClick={() => removeSection(index)}
              aria-label="Remove section"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="template-editor__add-section"
        onClick={addSection}
      >
        + Add Section
      </button>

      <div className="schedule-editor__actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
}
