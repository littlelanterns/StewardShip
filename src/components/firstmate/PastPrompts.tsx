import { Card } from '../shared';
import type { SpousePrompt } from '../../lib/types';
import { SPOUSE_PROMPT_TYPE_LABELS } from '../../lib/types';

interface PastPromptsProps {
  prompts: SpousePrompt[];
  onBack: () => void;
}

export function PastPrompts({ prompts, onBack }: PastPromptsProps) {
  return (
    <div className="past-prompts">
      <div className="past-prompts__header">
        <button className="past-prompts__back" onClick={onBack}>Back</button>
        <h2 className="past-prompts__title">Past Prompts</h2>
      </div>
      {prompts.length === 0 ? (
        <p className="past-prompts__empty">No prompts generated yet.</p>
      ) : (
        <div className="past-prompts__list">
          {prompts.map((p) => (
            <Card key={p.id} className="past-prompt">
              <div className="past-prompt__header">
                <span className={`past-prompt__badge past-prompt__badge--${p.prompt_type}`}>
                  {SPOUSE_PROMPT_TYPE_LABELS[p.prompt_type]}
                </span>
                <span className="past-prompt__date">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="past-prompt__text">{p.prompt_text}</p>
              {p.response_text && (
                <div className="past-prompt__response">
                  <span className="past-prompt__response-label">Response:</span>
                  <p className="past-prompt__response-text">{p.response_text}</p>
                </div>
              )}
              <span className={`past-prompt__status past-prompt__status--${p.status}`}>
                {p.status === 'acted_on' ? 'Completed' : p.status === 'skipped' ? 'Skipped' : 'Pending'}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
