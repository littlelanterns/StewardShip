import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader, BookOpen, Sparkles, Download, Clock, ChevronRight, Info } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { searchManifestContent } from '../../lib/rag';
import type { ManifestContentMatch } from '../../lib/rag';
import { supabase } from '../../lib/supabase';
import { Button } from '../shared';
import './SemanticSearch.css';

export type SearchMode = 'any' | 'together' | 'separate';
type GroupBy = 'relevance' | 'book';

export interface SearchState {
  query: string;
  mode: SearchMode;
  groupBy: GroupBy;
  results: ManifestContentMatch[] | null;
  separateResults: Map<string, ManifestContentMatch[]> | null;
  resultCount: number;
}

export const INITIAL_SEARCH_STATE: SearchState = {
  query: '',
  mode: 'any',
  groupBy: 'relevance',
  results: null,
  separateResults: null,
  resultCount: 0,
};

interface SearchHistoryEntry {
  id: string;
  query: string;
  mode: string;
  result_count: number;
  created_at: string;
}

// Source table → human label
const SOURCE_LABELS: Record<string, string> = {
  manifest_summaries: 'Summary',
  manifest_declarations: 'Declaration',
  ai_framework_principles: 'Framework',
  manifest_action_steps: 'Action Step',
  manifest_questions: 'Question',
};

// Parse comma/semicolon/newline separated terms
function parseTerms(input: string): string[] {
  return input.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const DIRECTIONS_KEY = 'manifest-search-directions-dismissed';

interface SemanticSearchProps {
  onClose: () => void;
  onNavigateToResult?: (manifestItemId: string, sourceTable: string, recordId: string) => void;
  persistedState?: React.MutableRefObject<SearchState>;
}

export function SemanticSearch({ onClose, onNavigateToResult, persistedState }: SemanticSearchProps) {
  const { user } = useAuthContext();

  // Initialize from persisted state or defaults
  const initial = persistedState?.current || INITIAL_SEARCH_STATE;
  const [query, setQuery] = useState(initial.query);
  const [mode, setMode] = useState<SearchMode>(initial.mode);
  const [groupBy, setGroupBy] = useState<GroupBy>(initial.groupBy);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ManifestContentMatch[] | null>(initial.results);
  const [separateResults, setSeparateResults] = useState<Map<string, ManifestContentMatch[]> | null>(initial.separateResults);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState(initial.resultCount);
  const searchIdRef = useRef(0);

  // Search history
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const historyFetchedRef = useRef(false);

  // Directions card
  const [showDirections, setShowDirections] = useState(() => {
    try { return !localStorage.getItem(DIRECTIONS_KEY); } catch { return true; }
  });

  // Sync state back to persisted ref on every change
  useEffect(() => {
    if (!persistedState) return;
    persistedState.current = { query, mode, groupBy, results, separateResults, resultCount };
  }, [query, mode, groupBy, results, separateResults, resultCount, persistedState]);

  // Fetch search history on mount
  useEffect(() => {
    if (!user || historyFetchedRef.current) return;
    historyFetchedRef.current = true;
    supabase
      .from('manifest_search_history')
      .select('id, query, mode, result_count, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (data) setHistory(data);
      });
  }, [user]);

  const saveToHistory = useCallback((q: string, m: string, count: number) => {
    if (!user) return;
    supabase
      .from('manifest_search_history')
      .insert({ user_id: user.id, query: q, mode: m, result_count: count })
      .select('id, query, mode, result_count, created_at')
      .single()
      .then(({ data }) => {
        if (data) {
          setHistory((prev) => [data, ...prev].slice(0, 15));
        }
      });
  }, [user]);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    supabase.from('manifest_search_history').delete().eq('id', id).then();
  }, []);

  const clearHistory = useCallback(() => {
    if (!user) return;
    setHistory([]);
    supabase.from('manifest_search_history').delete().eq('user_id', user.id).then();
  }, [user]);

  const handleModeChange = useCallback((m: SearchMode) => {
    setMode(m);
  }, []);

  const handleSearch = useCallback(async (overrideQuery?: string, overrideMode?: SearchMode) => {
    const q = overrideQuery ?? query;
    const m = overrideMode ?? mode;
    if (!user || !q.trim()) return;
    const id = ++searchIdRef.current;
    setSearching(true);
    setError(null);
    setResults(null);
    setSeparateResults(null);
    setShowHistory(false);

    try {
      if (m === 'together' || parseTerms(q).length <= 1) {
        const matches = await searchManifestContent(q.trim(), user.id, { matchThreshold: 0.25, matchCount: 30 });
        if (id !== searchIdRef.current) return;
        setResults(matches);
        setResultCount(matches.length);
        saveToHistory(q.trim(), m, matches.length);
      } else if (m === 'any') {
        const terms = parseTerms(q);
        const allMatches: (ManifestContentMatch & { matchedTerms: string[] })[] = [];
        const seenIds = new Map<string, number>();

        for (const term of terms) {
          const matches = await searchManifestContent(term, user.id, { matchThreshold: 0.25, matchCount: 20 });
          if (id !== searchIdRef.current) return;
          for (const match of matches) {
            const existing = seenIds.get(match.record_id);
            if (existing !== undefined) {
              const e = allMatches[existing];
              e.matchedTerms.push(term);
              e.similarity = Math.max(e.similarity, match.similarity);
            } else {
              seenIds.set(match.record_id, allMatches.length);
              allMatches.push({ ...match, matchedTerms: [term] });
            }
          }
        }

        allMatches.sort((a, b) => {
          if (a.matchedTerms.length !== b.matchedTerms.length) return b.matchedTerms.length - a.matchedTerms.length;
          return b.similarity - a.similarity;
        });

        setResults(allMatches);
        setResultCount(allMatches.length);
        saveToHistory(q.trim(), m, allMatches.length);
      } else {
        const terms = parseTerms(q);
        const map = new Map<string, ManifestContentMatch[]>();
        let total = 0;

        for (const term of terms) {
          const matches = await searchManifestContent(term, user.id, { matchThreshold: 0.25, matchCount: 15 });
          if (id !== searchIdRef.current) return;
          map.set(term, matches);
          total += matches.length;
        }

        setSeparateResults(map);
        setResultCount(total);
        saveToHistory(q.trim(), 'separate', total);
      }
    } catch {
      if (id === searchIdRef.current) setError('Search failed. Try again.');
    } finally {
      if (id === searchIdRef.current) setSearching(false);
    }
  }, [user, query, mode, saveToHistory]);

  const handleRerunHistory = useCallback((entry: SearchHistoryEntry) => {
    const m = (entry.mode === 'any' || entry.mode === 'together' || entry.mode === 'separate') ? entry.mode as SearchMode : 'any';
    setQuery(entry.query);
    setMode(m);
    // Trigger search with the history values directly
    handleSearch(entry.query, m);
  }, [handleSearch]);

  const handleResultClick = useCallback((match: ManifestContentMatch) => {
    if (onNavigateToResult) {
      onNavigateToResult(match.manifest_item_id, match.source_table, match.record_id);
    }
  }, [onNavigateToResult]);

  const dismissDirections = useCallback(() => {
    setShowDirections(false);
    try { localStorage.setItem(DIRECTIONS_KEY, 'true'); } catch { /* */ }
  }, []);

  const terms = parseTerms(query);
  const showTermChips = (mode === 'any' || mode === 'separate') && terms.length > 1;

  const hasResults = results !== null || separateResults !== null;
  const showHistorySection = showHistory && !hasResults && !searching && history.length > 0;

  // Count frequency of queries
  const queryFrequency = new Map<string, number>();
  for (const h of history) {
    const key = h.query.toLowerCase();
    queryFrequency.set(key, (queryFrequency.get(key) || 0) + 1);
  }

  const exportResults = useCallback(() => {
    let md = `# Search Results: "${query}"\n\n`;
    md += `Mode: ${mode === 'any' ? 'Any of these' : mode === 'together' ? 'All together' : 'Show each separately'}\n\n`;

    if (separateResults) {
      for (const [term, matches] of separateResults.entries()) {
        md += `## "${term}" (${matches.length} results)\n\n`;
        for (const m of matches) {
          md += `### ${SOURCE_LABELS[m.source_table] || m.source_table} — ${m.book_title}\n`;
          md += `${m.content_preview}\n\n`;
        }
      }
    } else if (results) {
      if (groupBy === 'book') {
        const bookGroups = new Map<string, ManifestContentMatch[]>();
        for (const m of results) {
          if (!bookGroups.has(m.manifest_item_id)) bookGroups.set(m.manifest_item_id, []);
          bookGroups.get(m.manifest_item_id)!.push(m);
        }
        for (const [, matches] of bookGroups.entries()) {
          md += `## ${matches[0].book_title}\n\n`;
          for (const m of matches) {
            md += `**${SOURCE_LABELS[m.source_table] || m.source_table}** (${Math.round(m.similarity * 100)}%)\n`;
            md += `${m.content_preview}\n\n`;
          }
        }
      } else {
        for (const m of results) {
          md += `**${SOURCE_LABELS[m.source_table] || m.source_table}** — *${m.book_title}* (${Math.round(m.similarity * 100)}%)\n`;
          md += `${m.content_preview}\n\n`;
        }
      }
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-${query.trim().replace(/\s+/g, '-').substring(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [query, mode, groupBy, results, separateResults]);

  return (
    <div className="semantic-search">
      <div className="semantic-search__header">
        <h3 className="semantic-search__title">
          <Sparkles size={16} /> Search Your Library
        </h3>
        <button type="button" className="semantic-search__close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Directions card */}
      {showDirections && (
        <div className="semantic-search__directions">
          <div className="semantic-search__directions-icon">
            <Info size={14} />
          </div>
          <div className="semantic-search__directions-body">
            <p className="semantic-search__directions-text">
              This searches the meaning of your extracted book content, not just keywords.
              Try natural language like "dealing with pride" or "how to listen better."
            </p>
            <p className="semantic-search__directions-text">
              <strong>Any of these</strong> — separate terms with commas to find content matching any term.{' '}
              <strong>All together</strong> — searches your full phrase as one concept.{' '}
              <strong>Show each separately</strong> — groups results by term so you can compare.
            </p>
            <p className="semantic-search__directions-text">
              Click any result to jump directly to that item in its book.
            </p>
          </div>
          <button type="button" className="semantic-search__directions-dismiss" onClick={dismissDirections}>
            Got it
          </button>
        </div>
      )}

      {/* Search input */}
      <div className="semantic-search__input-row">
        <div className="semantic-search__input-wrap">
          <Search size={14} className="semantic-search__input-icon" />
          <input
            type="text"
            className="semantic-search__input"
            placeholder="What are you looking for? Try natural language..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) handleSearch(); }}
          />
          {query && (
            <button type="button" className="semantic-search__input-clear" onClick={() => { setQuery(''); setResults(null); setSeparateResults(null); setShowHistory(true); }}>
              <X size={12} />
            </button>
          )}
        </div>
        <Button size="sm" onClick={() => handleSearch()} disabled={!query.trim() || searching}>
          {searching ? <Loader size={14} className="semantic-search__spinner" /> : 'Search'}
        </Button>
      </div>

      {/* Mode selector */}
      <div className="semantic-search__modes">
        <button type="button" className={`semantic-search__mode${mode === 'any' ? ' semantic-search__mode--active' : ''}`} onClick={() => handleModeChange('any')}>
          Any of these
        </button>
        <button type="button" className={`semantic-search__mode${mode === 'together' ? ' semantic-search__mode--active' : ''}`} onClick={() => handleModeChange('together')}>
          All together
        </button>
        <button type="button" className={`semantic-search__mode${mode === 'separate' ? ' semantic-search__mode--active' : ''}`} onClick={() => handleModeChange('separate')}>
          Show each separately
        </button>
      </div>

      {/* Parsed term chips */}
      {showTermChips && (
        <div className="semantic-search__terms">
          {terms.map((t, i) => (
            <span key={i} className="semantic-search__term-chip">
              {t}
              <button
                type="button"
                className="semantic-search__term-remove"
                onClick={() => {
                  const newTerms = terms.filter((_, j) => j !== i);
                  setQuery(newTerms.join(', '));
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <div className="semantic-search__error">{error}</div>}

      {/* Search history */}
      {showHistorySection && (
        <div className="semantic-search__history">
          <div className="semantic-search__history-header">
            <span className="semantic-search__history-title">
              <Clock size={13} /> Recent Searches
            </span>
            <button type="button" className="semantic-search__history-clear" onClick={clearHistory}>
              Clear All
            </button>
          </div>
          <div className="semantic-search__history-list">
            {history.map((entry) => {
              const freq = queryFrequency.get(entry.query.toLowerCase()) || 1;
              return (
                <div key={entry.id} className="semantic-search__history-item" onClick={() => handleRerunHistory(entry)}>
                  <div className="semantic-search__history-item-main">
                    <span className="semantic-search__history-query">{entry.query}</span>
                    <div className="semantic-search__history-meta">
                      <span className="semantic-search__history-mode">{entry.mode}</span>
                      <span className="semantic-search__history-count">{entry.result_count} results</span>
                      {freq > 1 && <span className="semantic-search__history-freq">{freq}x</span>}
                      <span className="semantic-search__history-time">{relativeTime(entry.created_at)}</span>
                    </div>
                  </div>
                  <div className="semantic-search__history-actions">
                    <button
                      type="button"
                      className="semantic-search__history-delete"
                      onClick={(e) => { e.stopPropagation(); deleteHistoryItem(entry.id); }}
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                    <ChevronRight size={14} className="semantic-search__history-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results header */}
      {(results || separateResults) && !searching && (
        <div className="semantic-search__results-header">
          <span className="semantic-search__result-count">
            {resultCount} result{resultCount !== 1 ? 's' : ''} found
            {resultCount > 0 && (
              <button type="button" className="semantic-search__export-btn" onClick={() => exportResults()} title="Export results">
                <Download size={12} /> Export
              </button>
            )}
          </span>
          {results && results.length > 0 && (
            <div className="semantic-search__group-toggle">
              <button
                type="button"
                className={`semantic-search__group-btn${groupBy === 'relevance' ? ' semantic-search__group-btn--active' : ''}`}
                onClick={() => setGroupBy('relevance')}
              >
                By relevance
              </button>
              <button
                type="button"
                className={`semantic-search__group-btn${groupBy === 'book' ? ' semantic-search__group-btn--active' : ''}`}
                onClick={() => setGroupBy('book')}
              >
                By book
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results — relevance or book grouped */}
      {results && !searching && (
        <div className="semantic-search__results">
          {results.length === 0 ? (
            <div className="semantic-search__empty">No results found. Try different terms or a broader query.</div>
          ) : groupBy === 'relevance' ? (
            results.map((m) => (
              <ResultCard
                key={`${m.source_table}-${m.record_id}`}
                match={m}
                matchedTerms={'matchedTerms' in m ? (m as { matchedTerms: string[] }).matchedTerms : undefined}
                onClick={handleResultClick}
                clickable={!!onNavigateToResult}
              />
            ))
          ) : (
            (() => {
              const bookGroups = new Map<string, ManifestContentMatch[]>();
              for (const m of results) {
                const key = m.manifest_item_id;
                if (!bookGroups.has(key)) bookGroups.set(key, []);
                bookGroups.get(key)!.push(m);
              }
              return Array.from(bookGroups.entries()).map(([bookId, matches]) => (
                <div key={bookId} className="semantic-search__book-group">
                  <div className="semantic-search__book-title">
                    <BookOpen size={14} /> {matches[0].book_title}
                  </div>
                  {matches.map((m) => (
                    <ResultCard
                      key={`${m.source_table}-${m.record_id}`}
                      match={m}
                      onClick={handleResultClick}
                      clickable={!!onNavigateToResult}
                    />
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      )}

      {/* Results — separate mode */}
      {separateResults && !searching && (
        <div className="semantic-search__results">
          {Array.from(separateResults.entries()).map(([term, matches]) => (
            <div key={term} className="semantic-search__term-group">
              <div className="semantic-search__term-header">
                "{term}" <span className="semantic-search__term-count">({matches.length})</span>
              </div>
              {matches.length === 0 ? (
                <div className="semantic-search__empty">No results for this term.</div>
              ) : (
                matches.map((m) => (
                  <ResultCard
                    key={`${m.source_table}-${m.record_id}`}
                    match={m}
                    onClick={handleResultClick}
                    clickable={!!onNavigateToResult}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {searching && (
        <div className="semantic-search__loading">
          <Loader size={20} className="semantic-search__spinner" />
          <span>Searching your library...</span>
        </div>
      )}
    </div>
  );
}

function ResultCard({ match, matchedTerms, onClick, clickable }: {
  match: ManifestContentMatch;
  matchedTerms?: string[];
  onClick?: (match: ManifestContentMatch) => void;
  clickable?: boolean;
}) {
  return (
    <div
      className={`semantic-search__result${clickable ? ' semantic-search__result--clickable' : ''}`}
      onClick={clickable ? () => onClick?.(match) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onClick?.(match); } : undefined}
    >
      <div className="semantic-search__result-meta">
        <span className="semantic-search__result-type">{SOURCE_LABELS[match.source_table] || match.source_table}</span>
        <span className="semantic-search__result-similarity">{Math.round(match.similarity * 100)}%</span>
        {matchedTerms && matchedTerms.length > 1 && (
          <span className="semantic-search__result-matches">matches: {matchedTerms.join(', ')}</span>
        )}
      </div>
      <p className="semantic-search__result-text">{match.content_preview}</p>
      <div className="semantic-search__result-book">
        <BookOpen size={11} /> {match.book_title}
        {clickable && <ChevronRight size={12} className="semantic-search__result-go" />}
      </div>
    </div>
  );
}
