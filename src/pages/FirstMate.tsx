import { useEffect, useState, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useFirstMate } from '../hooks/useFirstMate';
import { useCyrano } from '../hooks/useCyrano';
import { useAuthContext } from '../contexts/AuthContext';
import type { SpouseInsightCategory } from '../lib/types';
import { SPOUSE_INSIGHT_CATEGORY_LABELS, SPOUSE_INSIGHT_CATEGORY_ORDER } from '../lib/types';
import { LoadingSpinner, EmptyState, FloatingActionButton, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { FirstMateProfile } from '../components/firstmate/FirstMateProfile';
import { PromptCard } from '../components/firstmate/PromptCard';
import { MarriageToolbox } from '../components/firstmate/MarriageToolbox';
import { CyranoDrafts } from '../components/firstmate/CyranoDrafts';
import { GratitudeCapture } from '../components/firstmate/GratitudeCapture';
import { InsightCategorySection } from '../components/firstmate/InsightCategorySection';
import { AddInsightModal } from '../components/firstmate/AddInsightModal';
import { PastPrompts } from '../components/firstmate/PastPrompts';
import { Plus } from 'lucide-react';
import '../components/firstmate/FirstMate.css';
import './FirstMate.css';

type FirstMateView = 'main' | 'past-prompts';

export default function FirstMate() {
  usePageContext({ page: 'firstmate' });
  const { profile, user } = useAuthContext();
  const {
    spouse,
    insights,
    prompts,
    activePrompt,
    loading,
    fetchSpouse,
    createSpouse,
    updateSpouse,
    fetchInsights,
    createInsight,
    updateInsight,
    archiveInsight,
    fetchPrompts,
    fetchActivePrompt,
    generatePrompt,
    respondToPrompt,
    skipPrompt,
    saveGratitude,
  } = useFirstMate();

  const { drafts: cyranoDrafts, markSent: markCyranoSent, deleteDraft: deleteCyranoDraft } = useCyrano(user?.id, spouse?.id);

  const [view, setView] = useState<FirstMateView>('main');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCategory, setAddCategory] = useState<SpouseInsightCategory | undefined>();

  const relationshipStatus = profile?.relationship_status;
  const isMarried = relationshipStatus === 'married';
  const isDating = relationshipStatus === 'dating';

  const partnerLabel = isMarried ? 'Spouse' : 'Partner';
  const askLabel = 'Ask Them';

  useEffect(() => {
    fetchSpouse();
  }, [fetchSpouse]);

  const handleAddFromSection = useCallback((category: SpouseInsightCategory) => {
    setAddCategory(category);
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    if (spouse) {
      fetchInsights();
      fetchActivePrompt();
      fetchPrompts();
    }
  }, [spouse, fetchInsights, fetchActivePrompt, fetchPrompts]);

  // Gate: single/null = not accessible
  if (!relationshipStatus || relationshipStatus === 'single') {
    return (
      <div className="page">
        <EmptyState
          heading="First Mate"
          message="This feature is for users in a relationship. Update your profile in Settings if this has changed."
        />
      </div>
    );
  }

  if (loading && !spouse) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  if (view === 'past-prompts') {
    return (
      <div className="page firstmate-page">
        <PastPrompts prompts={prompts} onBack={() => setView('main')} />
      </div>
    );
  }

  // Group insights by category
  const insightsByCategory: Record<SpouseInsightCategory, typeof insights> = {} as Record<SpouseInsightCategory, typeof insights>;
  for (const cat of SPOUSE_INSIGHT_CATEGORY_ORDER) {
    insightsByCategory[cat] = insights.filter((i) => i.category === cat);
  }

  return (
    <div className="page firstmate-page">
      <div className="firstmate-page__header">
        <h1 className="firstmate-page__title">First Mate</h1>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.firstmate} />

      <FirstMateProfile
        spouse={spouse}
        onCreateSpouse={createSpouse}
        onUpdateSpouse={updateSpouse}
        partnerLabel={partnerLabel}
      />

      {spouse && (
        <>
          <PromptCard
            activePrompt={activePrompt}
            spouseName={spouse.name}
            loading={loading}
            onGenerate={generatePrompt}
            onRespond={respondToPrompt}
            onSkip={skipPrompt}
            askLabel={askLabel}
          />

          {(isMarried || isDating) && (
            <MarriageToolbox
              spouseId={spouse.id}
              isMarried={isMarried}
            />
          )}

          {(isMarried || isDating) && (
            <CyranoDrafts
              drafts={cyranoDrafts}
              onMarkSent={markCyranoSent}
              onDelete={deleteCyranoDraft}
            />
          )}

          <GratitudeCapture
            spouseName={spouse.name}
            onSave={saveGratitude}
          />

          <div className="firstmate-page__insights">
            <h2 className="firstmate-page__section-title">Insights</h2>
            {SPOUSE_INSIGHT_CATEGORY_ORDER.map((cat) => {
              const catInsights = insightsByCategory[cat];
              if (catInsights.length === 0 && !['personality', 'love_appreciation', 'gratitude'].includes(cat)) return null;
              return (
                <InsightCategorySection
                  key={cat}
                  label={SPOUSE_INSIGHT_CATEGORY_LABELS[cat]}
                  insights={catInsights}
                  onUpdate={updateInsight}
                  onArchive={archiveInsight}
                  onAdd={() => handleAddFromSection(cat)}
                />
              );
            })}
          </div>

          <div className="firstmate-page__past-prompts-link">
            <button className="firstmate-page__link-btn" onClick={() => setView('past-prompts')}>
              View Past Prompts ({prompts.length})
            </button>
          </div>
        </>
      )}

      {spouse && (
        <FloatingActionButton onClick={() => { setAddCategory(undefined); setShowAddModal(true); }} aria-label="Add Insight">
          <Plus size={24} />
        </FloatingActionButton>
      )}

      {showAddModal && (
        <AddInsightModal
          onClose={() => setShowAddModal(false)}
          onSave={(data) => createInsight(data)}
          preselectedCategory={addCategory}
        />
      )}
    </div>
  );
}
