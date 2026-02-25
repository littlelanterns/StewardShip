import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useRhythmCards, getPeriodKey } from '../../hooks/useRhythmCards';
import type { FridayOverviewData } from '../../hooks/useRhythmCards';
import { LIFE_AREA_LABELS } from '../../lib/types';
import './Rhythms.css';

interface FridayOverviewProps {
  onDismiss: () => void;
}

export function FridayOverview({ onDismiss }: FridayOverviewProps) {
  const navigate = useNavigate();
  const {
    fetchFridayOverviewData,
    dismissRhythm,
    completeRhythm,
    saveReflectionToLog,
    loading,
  } = useRhythmCards();

  const [data, setData] = useState<FridayOverviewData | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [reflectionSaving, setReflectionSaving] = useState(false);

  useEffect(() => {
    fetchFridayOverviewData().then(setData);
  }, [fetchFridayOverviewData]);

  const handleDismiss = useCallback(async () => {
    await dismissRhythm('friday_overview', getPeriodKey('friday_overview'));
    onDismiss();
  }, [dismissRhythm, onDismiss]);

  const handleSaveReflection = useCallback(async () => {
    if (!reflectionText.trim()) return;
    setReflectionSaving(true);
    await saveReflectionToLog(reflectionText);
    await completeRhythm('friday_overview', getPeriodKey('friday_overview'));
    setReflectionSaved(true);
    setReflectionSaving(false);
  }, [reflectionText, saveReflectionToLog, completeRhythm]);

  const handleWeeklyReview = useCallback(() => {
    handleDismiss();
    navigate('/meetings');
  }, [handleDismiss, navigate]);

  if (loading && !data) return null;
  if (!data) return null;

  return (
    <div className="rhythm-card rhythm-card--friday">
      <button
        type="button"
        className="rhythm-card__close"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>

      <h2 className="rhythm-card__heading">Here's your week, {data.name}.</h2>

      {/* Week Stats */}
      <div className="friday-stats">
        <div className="friday-stat">
          <span className="friday-stat__number">{data.tasksCompleted}</span>
          <span className="friday-stat__label">completed</span>
        </div>
        {data.tasksCarried > 0 && (
          <div className="friday-stat">
            <span className="friday-stat__number">{data.tasksCarried}</span>
            <span className="friday-stat__label">carried forward</span>
          </div>
        )}
        {data.victoryCount > 0 && (
          <div className="friday-stat">
            <span className="friday-stat__number">{data.victoryCount}</span>
            <span className="friday-stat__label">victor{data.victoryCount !== 1 ? 'ies' : 'y'}</span>
          </div>
        )}
      </div>

      {data.victories.length > 0 && (
        <div className="friday-victories">
          {data.victories.map((v, i) => (
            <div key={i} className="friday-victory">{v.description}</div>
          ))}
        </div>
      )}

      {data.streakNames.length > 0 && (
        <div className="friday-streaks">
          <span className="friday-streaks__label">Active streaks:</span>
          {' '}{data.streakNames.join(', ')}
        </div>
      )}

      {/* Week Themes */}
      {data.weekThemes.length > 0 && (
        <div className="friday-themes">
          <div className="friday-themes__label">This week's themes:</div>
          <div className="friday-themes__tags">
            {data.weekThemes.map((t) => (
              <span key={t.tag} className="friday-themes__tag">
                {(LIFE_AREA_LABELS as Record<string, string>)[t.tag] || t.tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next Week Preview */}
      {(data.nextWeekTasks.length > 0 || data.nextWeekMeetings.length > 0 || data.nextWeekDates.length > 0 || data.approachingMilestones.length > 0) && (
        <div className="friday-preview">
          <div className="friday-preview__label">Looking ahead:</div>
          {data.nextWeekDates.map((d, i) => (
            <div key={`date-${i}`} className="friday-preview__item friday-preview__item--date">
              {d.label} — {d.personName}
            </div>
          ))}
          {data.nextWeekMeetings.map((m, i) => (
            <div key={`meeting-${i}`} className="friday-preview__item">
              {m.personName ? `${m.type} with ${m.personName}` : m.type}
            </div>
          ))}
          {data.nextWeekTasks.map((t, i) => (
            <div key={`task-${i}`} className="friday-preview__item">{t.title}</div>
          ))}
          {data.approachingMilestones.map((m, i) => (
            <div key={`ms-${i}`} className="friday-preview__item">
              Milestone: {m.title} ({m.planTitle})
            </div>
          ))}
        </div>
      )}

      {/* Reflection Prompt */}
      <div className="friday-reflection">
        <p className="friday-reflection__prompt">{data.reflectionPrompt}</p>
        {!reflectionSaved ? (
          <>
            <textarea
              className="friday-reflection__textarea"
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="Write a thought..."
            />
            <div className="friday-reflection__actions">
              <button
                type="button"
                className="rhythm-actions__secondary"
                onClick={handleSaveReflection}
                disabled={!reflectionText.trim() || reflectionSaving}
              >
                {reflectionSaving ? 'Saving...' : 'Save Reflection'}
              </button>
            </div>
          </>
        ) : (
          <span className="prompted-entry__saved-msg">Saved to your Log</span>
        )}
      </div>

      {/* Footer Actions */}
      <div className="rhythm-card__actions">
        <button
          type="button"
          className="rhythm-actions__secondary"
          onClick={handleWeeklyReview}
        >
          Start Weekly Review
        </button>
        <button
          type="button"
          className="rhythm-actions__secondary"
          onClick={handleDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
