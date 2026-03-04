import { useState, useEffect, useCallback } from 'react';
import { Archive, Trash2, RotateCcw } from 'lucide-react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ReflectionQuestion } from '../../lib/types';
import './ManageQuestions.css';

interface ManageQuestionsProps {
  questions: ReflectionQuestion[];
  onAdd: (text: string) => Promise<ReflectionQuestion | null>;
  onUpdate: (id: string, updates: Partial<ReflectionQuestion>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}

export default function ManageQuestions({
  questions,
  onAdd,
  onArchive,
  onDelete,
  onRestore,
}: ManageQuestionsProps) {
  const { user } = useAuthContext();
  const [newQuestion, setNewQuestion] = useState('');
  const [adding, setAdding] = useState(false);
  const [archivedQuestions, setArchivedQuestions] = useState<ReflectionQuestion[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const fetchArchived = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('reflection_questions')
      .select('*')
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .order('sort_order', { ascending: true });
    setArchivedQuestions((data as ReflectionQuestion[]) || []);
  }, [user]);

  useEffect(() => {
    if (showArchived) {
      fetchArchived();
    }
  }, [showArchived, fetchArchived]);

  const handleAdd = async () => {
    if (!newQuestion.trim() || adding) return;
    setAdding(true);
    await onAdd(newQuestion.trim());
    setNewQuestion('');
    setAdding(false);
  };

  const handleRestore = async (id: string) => {
    await onRestore(id);
    setArchivedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="manage-questions">
      <div className="manage-questions__add">
        <input
          type="text"
          className="manage-questions__input"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Add a new question..."
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={!newQuestion.trim() || adding}>
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </div>

      <div className="manage-questions__list">
        {questions.map((q) => (
          <Card key={q.id} className="manage-questions__card">
            <span className="manage-questions__text">
              {q.question_text}
              {q.is_default && <span className="manage-questions__default-badge">Default</span>}
            </span>
            <div className="manage-questions__actions">
              <button
                type="button"
                className="manage-questions__remove"
                onClick={() => onArchive(q.id)}
                aria-label="Archive question"
                title="Archive"
              >
                <Archive size={16} />
              </button>
              {!q.is_default && (
                <button
                  type="button"
                  className="manage-questions__remove manage-questions__remove--delete"
                  onClick={() => onDelete(q.id)}
                  aria-label="Delete question"
                  title="Delete permanently"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="manage-questions__archived-section">
        <button
          type="button"
          className="manage-questions__archived-toggle"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Hide archived' : 'Show archived questions'}
          {archivedQuestions.length > 0 && showArchived && (
            <span className="manage-questions__archived-count">{archivedQuestions.length}</span>
          )}
        </button>

        {showArchived && (
          <div className="manage-questions__list">
            {archivedQuestions.length === 0 ? (
              <p className="manage-questions__empty">No archived questions.</p>
            ) : (
              archivedQuestions.map((q) => (
                <Card key={q.id} className="manage-questions__card manage-questions__card--archived">
                  <span className="manage-questions__text manage-questions__text--archived">
                    {q.question_text}
                    {q.is_default && <span className="manage-questions__default-badge">Default</span>}
                  </span>
                  <div className="manage-questions__actions">
                    <button
                      type="button"
                      className="manage-questions__remove manage-questions__remove--restore"
                      onClick={() => handleRestore(q.id)}
                      aria-label="Restore question"
                      title="Restore"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
