import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useRhythmCards, getPeriodKey } from '../../hooks/useRhythmCards';
import type { SundayReflectionData } from '../../hooks/useRhythmCards';
import './Rhythms.css';

interface SundayReflectionProps {
  onDismiss: () => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  physical: 'Physical Renewal',
  spiritual: 'Spiritual Renewal',
  mental: 'Mental Renewal',
  social: 'Social Renewal',
};

export function SundayReflection({ onDismiss }: SundayReflectionProps) {
  const navigate = useNavigate();
  const {
    fetchSundayReflectionData,
    dismissRhythm,
    completeRhythm,
    saveReflectionToLog,
    createTaskFromIntention,
    loading,
  } = useRhythmCards();

  const [data, setData] = useState<SundayReflectionData | null>(null);
  const [intentionText, setIntentionText] = useState('');
  const [intentionSaved, setIntentionSaved] = useState(false);
  const [intentionSaving, setIntentionSaving] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);

  useEffect(() => {
    fetchSundayReflectionData().then(setData);
  }, [fetchSundayReflectionData]);

  const handleDismiss = useCallback(async () => {
    await dismissRhythm('sunday_reflection', getPeriodKey('sunday_reflection'));
    onDismiss();
  }, [dismissRhythm, onDismiss]);

  const handleSaveIntention = useCallback(async () => {
    if (!intentionText.trim()) return;
    setIntentionSaving(true);
    await saveReflectionToLog(intentionText);
    await completeRhythm('sunday_reflection', getPeriodKey('sunday_reflection'));
    setIntentionSaved(true);
    setIntentionSaving(false);
  }, [intentionText, saveReflectionToLog, completeRhythm]);

  const handleCreateTask = useCallback(async () => {
    if (!intentionText.trim()) return;
    await createTaskFromIntention(intentionText);
    setTaskCreated(true);
  }, [intentionText, createTaskFromIntention]);

  const handleGoDeeper = useCallback(() => {
    handleDismiss();
    navigate('/helm');
  }, [handleDismiss, navigate]);

  if (loading && !data) return null;
  if (!data) return null;

  return (
    <div className="rhythm-overlay">
      <div className="rhythm-container sunday-reflection">
        <button
          type="button"
          className="rhythm-close-btn"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X size={24} />
        </button>

        {/* Section 1: Greeting */}
        <h1 className="sunday-reflection__greeting">
          A moment of stillness before the new week, {data.name}.
        </h1>

        {/* Section 2: Reading */}
        {data.mastReading && (
          <div className="sunday-reading">
            <div className="sunday-reading__text">{data.mastReading.text}</div>
            <div className="sunday-reading__source">
              From Your Mast — {data.mastReading.type.replace(/_/g, ' ')}
            </div>
          </div>
        )}

        {data.manifestReading && (
          <div className="sunday-reading">
            <div className="sunday-reading__text">{data.manifestReading.text}</div>
            <div className="sunday-reading__source">
              From Your Library — {data.manifestReading.source}
            </div>
          </div>
        )}

        {/* Section 3: Renewal Prompt */}
        <div className="sunday-renewal">
          <div className="sunday-renewal__dimension">
            {DIMENSION_LABELS[data.renewalDimension] || data.renewalDimension}
          </div>
          <p className="sunday-renewal__prompt">{data.renewalPrompt}</p>
        </div>

        {/* Section 4: Intention Setting */}
        <div className="sunday-intention">
          <p className="sunday-intention__question">
            What's one intention for the coming week?
          </p>
          {!intentionSaved ? (
            <>
              <textarea
                className="sunday-intention__textarea"
                value={intentionText}
                onChange={(e) => setIntentionText(e.target.value)}
                placeholder="An intention, a focus, a direction..."
              />
              <div className="sunday-intention__actions">
                <button
                  type="button"
                  className="rhythm-actions__secondary"
                  onClick={handleSaveIntention}
                  disabled={!intentionText.trim() || intentionSaving}
                >
                  {intentionSaving ? 'Saving...' : 'Save to Log'}
                </button>
                {intentionText.trim() && !taskCreated && (
                  <button
                    type="button"
                    className="rhythm-actions__secondary"
                    onClick={handleCreateTask}
                  >
                    Create task
                  </button>
                )}
                {taskCreated && (
                  <span className="prompted-entry__saved-msg">Task created</span>
                )}
              </div>
            </>
          ) : (
            <span className="prompted-entry__saved-msg">Intention saved to your Log</span>
          )}
        </div>

        {/* Footer Actions */}
        <div className="rhythm-actions">
          <button
            type="button"
            className="rhythm-actions__secondary"
            onClick={handleGoDeeper}
          >
            Go Deeper at The Helm
          </button>
          <button
            type="button"
            className="rhythm-actions__primary"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
