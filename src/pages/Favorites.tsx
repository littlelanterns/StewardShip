import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageContext } from '../hooks/usePageContext';
import { useManifest } from '../hooks/useManifest';
import { ExtractionsView } from '../components/manifest/ExtractionsView';
import { SemanticSearch, INITIAL_SEARCH_STATE } from '../components/manifest/SemanticSearch';
import type { SearchState } from '../components/manifest/SemanticSearch';
import { SearchFab } from '../components/manifest/SearchFab';
import { FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';

const SOURCE_TABLE_TO_TAB: Record<string, string> = {
  manifest_summaries: 'summary',
  ai_framework_principles: 'frameworks',
  manifest_action_steps: 'action_steps',
  manifest_declarations: 'mast_content',
  manifest_questions: 'questions',
};

export default function Favorites() {
  usePageContext({ page: 'manifest' });
  const navigate = useNavigate();
  const { items, fetchItems } = useManifest();
  const [showSearch, setShowSearch] = useState(false);
  const searchStateRef = useRef<SearchState>({ ...INITIAL_SEARCH_STATE });

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleNavigateToResult = useCallback((manifestItemId: string, sourceTable: string, recordId: string) => {
    const tab = SOURCE_TABLE_TO_TAB[sourceTable] || 'summary';
    setShowSearch(false);
    try {
      sessionStorage.setItem('manifest-search-navigate', JSON.stringify({ manifestItemId, tab, recordId }));
    } catch { /* */ }
    navigate('/manifest');
  }, [navigate]);

  return (
    <div className="page manifest-page">
      {FEATURE_GUIDES.favorites && <FeatureGuide {...FEATURE_GUIDES.favorites} />}
      <ExtractionsView items={items} favoritesMode />

      <SearchFab onClick={() => setShowSearch(true)} />

      {showSearch && (
        <div className="manifest-page__search-modal-backdrop" onClick={() => setShowSearch(false)}>
          <div className="manifest-page__search-modal" onClick={(e) => e.stopPropagation()}>
            <SemanticSearch
              onClose={() => setShowSearch(false)}
              onNavigateToResult={handleNavigateToResult}
              persistedState={searchStateRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}
