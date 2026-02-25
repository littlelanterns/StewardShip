import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { usePageContext } from '../hooks/usePageContext';
import { useVictories, type VictoryTimePeriod } from '../hooks/useVictories';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Victory, MastEntry } from '../lib/types';
import { LIFE_AREA_LABELS } from '../lib/types';
import { EmptyState, FloatingActionButton, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { VictoryCard } from '../components/victories/VictoryCard';
import { VictoryDetail } from '../components/victories/VictoryDetail';
import { RecordVictory } from '../components/victories/RecordVictory';
import { VictoryReview } from '../components/victories/VictoryReview';
import './Victories.css';

const PERIOD_LABELS: Record<VictoryTimePeriod, string> = {
  all: 'All Time',
  this_month: 'This Month',
  this_week: 'This Week',
  today: 'Today',
};

export default function Victories() {
  usePageContext({ page: 'victories' });
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuthContext();
  const {
    victories,
    loading,
    fetchVictories,
    createVictory,
    updateVictory,
    archiveVictory,
  } = useVictories();

  const [period, setPeriod] = useState<VictoryTimePeriod>('all');
  const [lifeAreaFilter, setLifeAreaFilter] = useState<string | null>(null);
  const [selectedVictory, setSelectedVictory] = useState<Victory | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [mastEntries, setMastEntries] = useState<MastEntry[]>([]);
  const [prefillData, setPrefillData] = useState<{ description: string; source: string } | null>(null);

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
    fetchVictories(period, lifeAreaFilter);
  }, [fetchVictories, period, lifeAreaFilter]);

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

  // Collect unique life area tags from victories for filter chips
  const lifeAreaTags = Array.from(new Set(victories.map((v) => v.life_area_tag).filter(Boolean))) as string[];

  // Gender-adaptive contextual line
  const genderWord = profile?.gender === 'female' ? 'woman' : profile?.gender === 'male' ? 'man' : 'person';

  const handleSaveVictory = async (data: Parameters<typeof createVictory>[0]) => {
    await createVictory(data);
  };

  return (
    <div className="page victories">
      <div className="victories__header">
        <h1>Victory Recorder</h1>
        <p className="victories__subtitle">Evidence of the {genderWord} you're becoming.</p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.victories} />

      {victories.length > 0 && (
        <div className="victories__summary">
          <span className="victories__count">{victories.length} {victories.length === 1 ? 'victory' : 'victories'}</span>
          <button
            type="button"
            className="victories__review-btn"
            onClick={() => setShowReview(true)}
          >
            <BookOpen size={14} /> Review
          </button>
        </div>
      )}

      <div className="victories__filters">
        <div className="victories__period-filters">
          {(Object.keys(PERIOD_LABELS) as VictoryTimePeriod[]).map((p) => (
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
                {LIFE_AREA_LABELS[tag] || tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && victories.length === 0 ? (
        <div className="victories__loading">Loading...</div>
      ) : victories.length === 0 ? (
        <EmptyState
          heading="No victories yet"
          message="When you accomplish something worth noting, record it here. Your victories are evidence of who you are becoming."
          action={
            <button
              type="button"
              className="victories__empty-action"
              onClick={() => setShowRecord(true)}
            >
              Record your first victory
            </button>
          }
        />
      ) : (
        <div className="victories__list">
          {victories.map((v) => (
            <VictoryCard key={v.id} victory={v} onClick={setSelectedVictory} />
          ))}
        </div>
      )}

      <FloatingActionButton onClick={() => setShowRecord(true)} aria-label="Record a Victory">
        <Plus size={24} />
      </FloatingActionButton>

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

      {showReview && (
        <VictoryReview
          victories={victories}
          mastEntries={mastEntries}
          onVictoryClick={(v) => { setShowReview(false); setSelectedVictory(v); }}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
