import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sparkles, Archive } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useAccomplishments, type AccomplishmentPeriod, type Accomplishment } from '../hooks/useAccomplishments';
import { useVictories } from '../hooks/useVictories';
import { useCelebrationArchive } from '../hooks/useCelebrationArchive';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { celebrateCollection } from '../lib/ai';
import type { Victory, MastEntry } from '../lib/types';
import { LIFE_AREA_LABELS, COMPASS_LIFE_AREA_LABELS } from '../lib/types';
import { EmptyState, FloatingActionButton, FeatureGuide, SparkleOverlay } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { VictoryDetail } from '../components/victories/VictoryDetail';
import { RecordVictory } from '../components/victories/RecordVictory';
import { CelebrationModal } from '../components/victories/CelebrationModal';
import { CelebrationArchive } from '../components/victories/CelebrationArchive';
import './Victories.css';

const PERIOD_LABELS: Record<AccomplishmentPeriod, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  all: 'All Time',
};

const ALL_AREA_LABELS: Record<string, string> = { ...LIFE_AREA_LABELS, ...COMPASS_LIFE_AREA_LABELS };

export default function Victories() {
  usePageContext({ page: 'victories' });
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuthContext();
  const {
    accomplishments,
    loading,
    fetchAccomplishments,
  } = useAccomplishments();
  const {
    createVictory,
    updateVictory,
    archiveVictory,
  } = useVictories();
  const { saveCelebration } = useCelebrationArchive();

  const [period, setPeriod] = useState<AccomplishmentPeriod>('this_week');
  const [lifeAreaFilter, setLifeAreaFilter] = useState<string | null>(null);
  const [selectedVictory, setSelectedVictory] = useState<Victory | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [mastEntries, setMastEntries] = useState<MastEntry[]>([]);
  const [prefillData, setPrefillData] = useState<{ description: string; source: string } | null>(null);

  // Celebration modal state
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationNarrative, setCelebrationNarrative] = useState<string | null>(null);
  const [celebrationLoading, setCelebrationLoading] = useState(false);
  const celebrationSavedRef = useRef(false);

  // Archive view state
  const [showArchive, setShowArchive] = useState(false);

  // Quick sparkle for individual task completions (kept separate)
  const [showSparkle, setShowSparkle] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Handle prefill query params from other pages (Rigging, Goals, etc.)
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const source = searchParams.get('source');
    if (prefill) {
      setPrefillData({ description: prefill, source: source || 'manual' });
      setShowRecord(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchAccomplishments(period);
  }, [fetchAccomplishments, period]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('mast_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .then(({ data }) => {
        if (data) setMastEntries(data as MastEntry[]);
      });
  }, [user]);

  // Filter by life area
  const filtered = lifeAreaFilter
    ? accomplishments.filter((a) => a.life_area === lifeAreaFilter)
    : accomplishments;

  // Collect unique life area tags
  const lifeAreaTags = Array.from(
    new Set(accomplishments.map((a) => a.life_area).filter(Boolean))
  ) as string[];

  const genderWord = profile?.gender === 'female' ? 'woman' : profile?.gender === 'male' ? 'man' : 'person';

  const handleSaveVictory = async (data: Parameters<typeof createVictory>[0]) => {
    await createVictory(data);
    fetchAccomplishments(period);
  };

  const handleCelebrate = useCallback(async () => {
    if (!user || filtered.length === 0) return;

    // Open modal immediately — fireworks start
    setShowCelebrationModal(true);
    setCelebrationLoading(true);
    setCelebrationNarrative(null);
    celebrationSavedRef.current = false;

    try {
      const text = filtered
        .map((a) => `- ${a.title}${a.note ? ` (${a.note})` : ''}`)
        .join('\n');

      const mastContext = mastEntries.length > 0
        ? mastEntries.map((m) => `${m.type}: ${m.text}`).join('\n')
        : undefined;

      const narrative = await celebrateCollection(text, PERIOD_LABELS[period], user.id, mastContext);

      if (narrative && narrative.trim()) {
        setCelebrationNarrative(narrative);
      } else {
        setCelebrationNarrative('Your accomplishments speak for themselves. Well done.');
      }
    } catch (err) {
      console.error('Celebration generation failed:', err);
      setCelebrationNarrative('Your accomplishments speak for themselves. Well done.');
    } finally {
      setCelebrationLoading(false);
    }
  }, [user, filtered, mastEntries, period]);

  // Auto-save to archive (called once per celebration)
  const saveToArchive = useCallback(async () => {
    if (celebrationSavedRef.current || !celebrationNarrative || !user) return;
    celebrationSavedRef.current = true;

    const summary = filtered
      .map((a) => `- ${a.title}`)
      .join('\n');

    await saveCelebration(
      celebrationNarrative,
      PERIOD_LABELS[period],
      filtered.length,
      summary,
    );
  }, [celebrationNarrative, user, filtered, period, saveCelebration]);

  const handleSaveNarrativeToLog = async () => {
    if (!user || !celebrationNarrative) return;
    try {
      await supabase.from('journal_entries').insert({
        user_id: user.id,
        text: celebrationNarrative,
        entry_type: 'reflection',
        source: 'manual_text',
        life_area_tags: [],
        routed_to: [],
        routed_reference_ids: {},
      });
      setToast('Saved to Journal');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('Failed to save');
      setTimeout(() => setToast(null), 2500);
    }
    // Also archive
    await saveToArchive();
  };

  const handleCopyNarrative = async () => {
    if (celebrationNarrative) {
      navigator.clipboard.writeText(celebrationNarrative);
      setToast('Copied to clipboard');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleCelebrationDismiss = useCallback(async () => {
    // Auto-save to archive before closing
    await saveToArchive();
    setShowCelebrationModal(false);
    setCelebrationNarrative(null);
  }, [saveToArchive]);

  const handleAccomplishmentClick = (a: Accomplishment) => {
    if (a.source === 'victory') {
      supabase
        .from('victories')
        .select('*')
        .eq('id', a.source_id)
        .single()
        .then(({ data }) => {
          if (data) setSelectedVictory(data as Victory);
        });
    }
  };

  return (
    <div className="page victories">
      <div className="victories__header">
        <div className="victories__header-row">
          <h1>Accomplishments</h1>
          <button
            type="button"
            className="victories__past-celebrations-btn"
            onClick={() => setShowArchive(true)}
          >
            <Archive size={14} /> Past Celebrations
          </button>
        </div>
        <p className="victories__subtitle">Evidence of the {genderWord} you're becoming.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.victories} />

      {filtered.length > 0 && (
        <div className="victories__summary">
          <span className="victories__count">
            {filtered.length} {filtered.length === 1 ? 'accomplishment' : 'accomplishments'}
          </span>
          <button
            type="button"
            className="victories__celebrate-btn"
            onClick={handleCelebrate}
          >
            <Sparkles size={14} /> Celebrate this!
          </button>
        </div>
      )}

      <div className="victories__filters">
        <div className="victories__period-filters">
          {(Object.keys(PERIOD_LABELS) as AccomplishmentPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`victories__filter-chip ${period === p ? 'victories__filter-chip--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {lifeAreaTags.length > 0 && (
          <div className="victories__area-filters">
            <button
              type="button"
              className={`victories__filter-chip ${!lifeAreaFilter ? 'victories__filter-chip--active' : ''}`}
              onClick={() => setLifeAreaFilter(null)}
            >
              All Areas
            </button>
            {lifeAreaTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`victories__filter-chip ${lifeAreaFilter === tag ? 'victories__filter-chip--active' : ''}`}
                onClick={() => setLifeAreaFilter(lifeAreaFilter === tag ? null : tag)}
              >
                {ALL_AREA_LABELS[tag] || tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && filtered.length === 0 ? (
        <div className="victories__loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No accomplishments yet"
          message="Complete tasks on the Compass or record a victory manually. Your accomplishments are evidence of who you are becoming."
          action={
            <button
              type="button"
              className="victories__empty-action"
              onClick={() => setShowRecord(true)}
            >
              Record a victory
            </button>
          }
        />
      ) : (
        <div className="victories__list">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`accomplishment-card ${a.source === 'victory' ? 'accomplishment-card--victory' : ''}`}
              onClick={() => handleAccomplishmentClick(a)}
              role={a.source === 'victory' ? 'button' : undefined}
              tabIndex={a.source === 'victory' ? 0 : undefined}
            >
              <div className="accomplishment-card__header">
                <span className="accomplishment-card__title">{a.title}</span>
                <span className={`accomplishment-card__badge accomplishment-card__badge--${a.source}`}>
                  {a.source === 'task' ? 'Task' : 'Victory'}
                </span>
              </div>
              {a.note && (
                <p className="accomplishment-card__note">{a.note}</p>
              )}
              <div className="accomplishment-card__footer">
                {a.life_area && (
                  <span className="accomplishment-card__area">
                    {ALL_AREA_LABELS[a.life_area] || a.life_area}
                  </span>
                )}
                <span className="accomplishment-card__date">
                  {new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <FloatingActionButton onClick={() => setShowRecord(true)} aria-label="Record a Victory">
        <Plus size={24} />
      </FloatingActionButton>

      {/* Quick sparkle for individual task completions */}
      <SparkleOverlay show={showSparkle} size="quick" onComplete={() => setShowSparkle(false)} />

      {/* Enhanced celebration modal */}
      <CelebrationModal
        open={showCelebrationModal}
        loading={celebrationLoading}
        narrative={celebrationNarrative}
        period={PERIOD_LABELS[period]}
        accomplishmentCount={filtered.length}
        onSaveToLog={handleSaveNarrativeToLog}
        onCopy={handleCopyNarrative}
        onDismiss={handleCelebrationDismiss}
      />

      {showRecord && (
        <RecordVictory
          prefill={prefillData ? {
            description: prefillData.description,
            source: prefillData.source as import('../lib/types').VictorySource,
          } : undefined}
          onSave={handleSaveVictory}
          onClose={() => { setShowRecord(false); setPrefillData(null); }}
        />
      )}

      {selectedVictory && (
        <VictoryDetail
          victory={selectedVictory}
          mastEntries={mastEntries}
          onUpdate={updateVictory}
          onArchive={archiveVictory}
          onClose={() => setSelectedVictory(null)}
        />
      )}

      {showArchive && (
        <CelebrationArchive onClose={() => setShowArchive(false)} />
      )}

      {toast && <div className="victories__toast">{toast}</div>}
    </div>
  );
}
