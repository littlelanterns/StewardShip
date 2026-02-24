import { useState } from 'react';
import { Card, Button } from '../shared';
import type { SpousePrompt, SpousePromptType, SpouseInsightCategory } from '../../lib/types';
import { SPOUSE_PROMPT_TYPE_LABELS, SPOUSE_INSIGHT_CATEGORY_LABELS, SPOUSE_INSIGHT_CATEGORY_ORDER } from '../../lib/types';

interface PromptCardProps {
  activePrompt: SpousePrompt | null;
  spouseName: string;
  loading: boolean;
  onGenerate: (type: SpousePromptType) => Promise<SpousePrompt | null>;
  onRespond: (id: string, response: { response_text: string; saveAsInsight: boolean; insightCategory?: SpouseInsightCategory }) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  askLabel: string; // "Ask Her" / "Ask Him" / "Ask Them"
}

export function PromptCard({ activePrompt, spouseName, loading, onGenerate, onRespond, onSkip, askLabel }: PromptCardProps) {
  const [generating, setGenerating] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [saveAsInsight, setSaveAsInsight] = useState(true);
  const [insightCategory, setInsightCategory] = useState<SpouseInsightCategory>('general');
  const [responding, setResponding] = useState(false);

  const handleGenerate = async (type: SpousePromptType) => {
    setGenerating(true);
    await onGenerate(type);
    setGenerating(false);
    setResponseText('');
  };

  const handleRespond = async () => {
    if (!activePrompt || !responseText.trim()) return;
    setResponding(true);
    await onRespond(activePrompt.id, {
      response_text: responseText.trim(),
      saveAsInsight,
      insightCategory: saveAsInsight ? insightCategory : undefined,
    });
    setResponding(false);
    setResponseText('');
  };

  return (
    <Card className="prompt-card">
      <h3 className="prompt-card__title">Spouse Prompts</h3>

      {!activePrompt && (
        <div className="prompt-card__buttons">
          <Button variant="secondary" onClick={() => handleGenerate('ask_them')} disabled={generating || loading}>
            {generating ? 'Generating...' : askLabel}
          </Button>
          <Button variant="secondary" onClick={() => handleGenerate('reflect')} disabled={generating || loading}>
            {generating ? '...' : 'Reflect'}
          </Button>
          <Button variant="secondary" onClick={() => handleGenerate('express')} disabled={generating || loading}>
            {generating ? '...' : 'Express'}
          </Button>
        </div>
      )}

      {activePrompt && (
        <div className="prompt-card__active">
          <span className="prompt-card__type-badge">
            {SPOUSE_PROMPT_TYPE_LABELS[activePrompt.prompt_type]}
          </span>
          <p className="prompt-card__text">{activePrompt.prompt_text}</p>

          <div className="prompt-card__response">
            <textarea
              className="prompt-card__textarea"
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder={activePrompt.prompt_type === 'ask_them' ? `What did ${spouseName} say?` : 'Your response...'}
              rows={3}
            />
            <label className="prompt-card__checkbox-label">
              <input
                type="checkbox"
                checked={saveAsInsight}
                onChange={(e) => setSaveAsInsight(e.target.checked)}
              />
              Save as insight about {spouseName}
            </label>
            {saveAsInsight && (
              <select
                className="prompt-card__category-select"
                value={insightCategory}
                onChange={(e) => setInsightCategory(e.target.value as SpouseInsightCategory)}
              >
                {SPOUSE_INSIGHT_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{SPOUSE_INSIGHT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            )}
            <div className="prompt-card__response-actions">
              <Button variant="primary" onClick={handleRespond} disabled={responding || !responseText.trim()}>
                {responding ? 'Saving...' : 'Done — Record Response'}
              </Button>
              <Button variant="secondary" onClick={() => onSkip(activePrompt.id)}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
