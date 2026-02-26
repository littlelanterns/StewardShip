import { useEffect, useState } from 'react';
import { FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { usePageContext } from '../hooks/usePageContext';
import { useReflections } from '../hooks/useReflections';
import QuestionCard from '../components/reflections/QuestionCard';
import PastReflections from '../components/reflections/PastReflections';
import ManageQuestions from '../components/reflections/ManageQuestions';
import { LoadingSpinner } from '../components/shared';
import './Reflections.css';

type ReflectionsTab = 'today' | 'past' | 'manage';

export default function Reflections() {
  usePageContext({ page: 'reflections' });
  const [activeTab, setActiveTab] = useState<ReflectionsTab>('today');
  const {
    questions,
    todaysResponses,
    pastResponses,
    loading,
    error,
    fetchQuestions,
    addQuestion,
    updateQuestion,
    archiveQuestion,
    restoreQuestion,
    fetchTodaysResponses,
    fetchPastResponses,
    saveResponse,
    updateResponse,
    routeToLog,
    routeToVictory,
  } = useReflections();

  useEffect(() => {
    fetchQuestions();
    fetchTodaysResponses();
  }, [fetchQuestions, fetchTodaysResponses]);

  useEffect(() => {
    if (activeTab === 'past') {
      fetchPastResponses();
    }
  }, [activeTab, fetchPastResponses]);

  // Find which questions already have responses today
  const answeredIds = new Set(todaysResponses.map((r) => r.question_id));

  return (
    <div className="page reflections-page">
      <div className="reflections-page__header">
        <h1 className="reflections-page__title">Reflections</h1>
        <p className="reflections-page__subtitle">Daily questions to guide your thinking.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.reflections} />

      <div className="reflections-page__tab-bar">
        <button
          type="button"
          className={`reflections-page__tab ${activeTab === 'today' ? 'reflections-page__tab--active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`reflections-page__tab ${activeTab === 'past' ? 'reflections-page__tab--active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past
        </button>
        <button
          type="button"
          className={`reflections-page__tab ${activeTab === 'manage' ? 'reflections-page__tab--active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage
        </button>
      </div>

      {error && <p className="reflections-page__error">{error}</p>}

      {loading && questions.length === 0 ? (
        <div className="reflections-page__loading"><LoadingSpinner /></div>
      ) : (
        <>
          {activeTab === 'today' && (
            <div className="reflections-page__today">
              {todaysResponses.length > 0 && (
                <p className="reflections-page__today-count">
                  {todaysResponses.length} reflection{todaysResponses.length !== 1 ? 's' : ''} today
                </p>
              )}
              {questions.map((q) => {
                const existingResponse = todaysResponses.find((r) => r.question_id === q.id);
                return (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    existingResponse={existingResponse || null}
                    isAnswered={answeredIds.has(q.id)}
                    onSave={saveResponse}
                    onUpdate={updateResponse}
                    onRouteToLog={routeToLog}
                    onRouteToVictory={routeToVictory}
                  />
                );
              })}
            </div>
          )}

          {activeTab === 'past' && (
            <PastReflections
              responses={pastResponses}
              loading={loading}
              onLoadMore={() => fetchPastResponses(50, pastResponses.length)}
            />
          )}

          {activeTab === 'manage' && (
            <ManageQuestions
              questions={questions}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onArchive={archiveQuestion}
              onRestore={restoreQuestion}
            />
          )}
        </>
      )}
    </div>
  );
}
