import { useState } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import type { ReflectionQuestion, ReflectionResponse } from '../../lib/types';
import './QuestionCard.css';

interface QuestionCardProps {
  question: ReflectionQuestion;
  existingResponse: ReflectionResponse | null;
  isAnswered: boolean;
  onSave: (questionId: string, text: string) => Promise<ReflectionResponse | null>;
  onUpdate: (id: string, text: string) => Promise<void>;
  onRouteToLog: (responseId: string, responseText: string, questionText: string) => Promise<string | null>;
  onRouteToVictory: (responseId: string, description: string) => Promise<string | null>;
}

export default function QuestionCard({
  question,
  existingResponse,
  isAnswered,
  onSave,
  onUpdate,
  onRouteToLog,
  onRouteToVictory,
}: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(existingResponse?.response_text || '');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    await onSave(question.id, text.trim());
    setExpanded(false);
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!text.trim() || saving || !existingResponse) return;
    setSaving(true);
    await onUpdate(existingResponse.id, text.trim());
    setEditing(false);
    setSaving(false);
  };

  const handleRouteToLog = async () => {
    if (!existingResponse) return;
    const id = await onRouteToLog(existingResponse.id, existingResponse.response_text, question.question_text);
    if (id) {
      setRouteMessage('Saved to Log');
      setTimeout(() => setRouteMessage(null), 2000);
    }
  };

  const handleRouteToVictory = async () => {
    if (!existingResponse) return;
    const id = await onRouteToVictory(existingResponse.id, existingResponse.response_text);
    if (id) {
      setRouteMessage('Recorded as Victory');
      setTimeout(() => setRouteMessage(null), 2000);
    }
  };

  return (
    <Card className={`question-card ${isAnswered ? 'question-card--answered' : ''}`}>
      <button
        type="button"
        className="question-card__header"
        onClick={() => !isAnswered && setExpanded(!expanded)}
      >
        <span className="question-card__text">{question.question_text}</span>
        {isAnswered && <span className="question-card__check">Done</span>}
      </button>

      {isAnswered && existingResponse && !editing && (
        <div className="question-card__response">
          <p className="question-card__response-text">{existingResponse.response_text}</p>
          <div className="question-card__actions">
            <button type="button" className="question-card__action" onClick={() => { setEditing(true); setText(existingResponse.response_text); }}>
              Edit
            </button>
            {!existingResponse.routed_to_log && (
              <button type="button" className="question-card__action" onClick={handleRouteToLog}>
                Save to Log
              </button>
            )}
            {!existingResponse.routed_to_victory && (
              <button type="button" className="question-card__action" onClick={handleRouteToVictory}>
                Record Victory
              </button>
            )}
          </div>
          {routeMessage && <span className="question-card__route-msg">{routeMessage}</span>}
        </div>
      )}

      {(expanded || editing) && (
        <div className="question-card__input-area">
          <textarea
            className="question-card__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your reflection..."
            rows={3}
            autoFocus
          />
          <div className="question-card__btn-row">
            <Button
              onClick={editing ? handleUpdate : handleSave}
              disabled={!text.trim() || saving}
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setExpanded(false); setEditing(false); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
