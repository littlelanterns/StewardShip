import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { LogEntryType, LogEntry } from '../../lib/types';
import { LOG_ENTRY_TYPE_LABELS } from '../../lib/types';
import { autoTagEntry } from '../../lib/ai';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../shared';
import { TagChips } from '../shared/TagChips';
import { RoutingSelector } from '../shared/RoutingSelector';
import { VoiceRecordButton } from '../shared/VoiceRecordButton';
import './CreateEntry.css';

interface CreateEntryProps {
  initialType?: LogEntryType;
  onSave: (text: string, type: LogEntryType, tags: string[]) => Promise<LogEntry | null>;
  onRouted: (entryId: string, target: string, referenceId: string) => void;
  onBack: () => void;
}

const QUICK_TYPES: LogEntryType[] = ['journal', 'gratitude', 'reflection', 'quick_note', 'custom'];

const TYPE_PROMPTS: Partial<Record<LogEntryType, string>> = {
  gratitude: 'What are you feeling grateful for?',
  reflection: "What's on your mind?",
};

function getHeuristicTags(type: LogEntryType): string[] {
  if (type === 'gratitude') return ['spiritual'];
  if (type === 'reflection') return ['emotional'];
  return [];
}

export default function CreateEntry({ initialType, onSave, onRouted, onBack }: CreateEntryProps) {
  const { user } = useAuthContext();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [entryType, setEntryType] = useState<LogEntryType>(initialType || 'journal');
  const [saved, setSaved] = useState(false);
  const [savedEntry, setSavedEntry] = useState<LogEntry | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);

  const prompt = TYPE_PROMPTS[entryType];

  const handleTranscription = useCallback((transcribedText: string) => {
    setText(prev => {
      const separator = prev.trim() ? ' ' : '';
      return prev + separator + transcribedText;
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!text.trim() || saving) return;
    setSaving(true);

    const heuristicTags = getHeuristicTags(entryType);
    const allTags = [...new Set([...heuristicTags])];

    const entry = await onSave(text.trim(), entryType, allTags);
    if (entry) {
      setSavedEntry(entry);
      setTags(entry.life_area_tags);
      setSaved(true);
    }
    setSaving(false);
  }, [text, entryType, saving, onSave]);

  // AI auto-tagging after save
  useEffect(() => {
    if (!saved || !savedEntry || !user) return;

    let cancelled = false;

    async function runAutoTag() {
      setTagsLoading(true);
      try {
        const aiTags = await autoTagEntry(savedEntry!.text, user!.id);
        if (cancelled || aiTags.length === 0) {
          setTagsLoading(false);
          return;
        }

        // Merge AI tags with heuristic tags (AI takes priority)
        const mergedTags = [...new Set([...aiTags])];
        setTags(mergedTags);

        // Update the entry in the database
        await supabase
          .from('log_entries')
          .update({ life_area_tags: mergedTags })
          .eq('id', savedEntry!.id)
          .eq('user_id', user!.id);
      } catch {
        // Keep heuristic tags on failure — already set
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    }

    runAutoTag();
    return () => { cancelled = true; };
  }, [saved, savedEntry, user]);

  const handleAddTag = useCallback(async (tag: string) => {
    const newTags = [...tags, tag];
    setTags(newTags);
    // Persist tag addition
    if (savedEntry && user) {
      await supabase
        .from('log_entries')
        .update({ life_area_tags: newTags })
        .eq('id', savedEntry.id)
        .eq('user_id', user.id);
    }
  }, [tags, savedEntry, user]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    // Persist tag removal
    if (savedEntry && user) {
      await supabase
        .from('log_entries')
        .update({ life_area_tags: newTags })
        .eq('id', savedEntry.id)
        .eq('user_id', user.id);
    }
  }, [tags, savedEntry, user]);

  const handleRouted = useCallback((target: string, referenceId: string) => {
    if (savedEntry) {
      onRouted(savedEntry.id, target, referenceId);
    }
  }, [savedEntry, onRouted]);

  // Post-save view: tags + routing
  if (saved && savedEntry) {
    return (
      <div className="create-entry">
        <div className="create-entry__top-bar">
          <button type="button" className="create-entry__back" onClick={onBack} aria-label="Back to Log">
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <span className="create-entry__saved-label">Entry saved</span>
        </div>

        <div className="create-entry__saved-preview">
          <p className="create-entry__saved-text">
            {savedEntry.text.length > 200
              ? savedEntry.text.slice(0, 200) + '...'
              : savedEntry.text}
          </p>
        </div>

        <div className="create-entry__tags-section">
          <span className="create-entry__section-label">
            Life Areas{tagsLoading ? ' (analyzing...)' : ''}
          </span>
          <TagChips tags={tags} onAdd={handleAddTag} onRemove={handleRemoveTag} />
        </div>

        <RoutingSelector
          entryId={savedEntry.id}
          entryText={savedEntry.text}
          onRouted={handleRouted}
          onClose={onBack}
        />
      </div>
    );
  }

  return (
    <div className="create-entry">
      <div className="create-entry__top-bar">
        <button type="button" className="create-entry__back" onClick={onBack} aria-label="Back to Log">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="create-entry__top-title">New Entry</span>
      </div>

      {/* Type selector */}
      <div className="create-entry__type-bar">
        {QUICK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`create-entry__type-chip ${entryType === type ? 'create-entry__type-chip--active' : ''}`}
            onClick={() => setEntryType(type)}
          >
            {LOG_ENTRY_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Prompt */}
      {prompt && (
        <p className="create-entry__prompt">{prompt}</p>
      )}

      {/* Text area */}
      <textarea
        ref={textareaRef}
        className="create-entry__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write here..."
        autoFocus
      />

      {/* Bottom actions */}
      <div className="create-entry__actions">
        <VoiceRecordButton onTranscription={handleTranscription} disabled={saving} />
        <Button onClick={handleSave} disabled={!text.trim() || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
