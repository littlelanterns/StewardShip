import { useState, useCallback, useRef } from 'react';
import { Search, X, Loader, BookOpen, Sparkles, Download } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { searchManifestContent } from '../../lib/rag';
import type { ManifestContentMatch } from '../../lib/rag';
import { Button } from '../shared';
import './SemanticSearch.css';

type SearchMode = 'any' | 'together' | 'separate';
type GroupBy = 'relevance' | 'book';

// Restore from sessionStorage
function ssGet(key: string): string | null { try { return sessionStorage.getItem(key); } catch { return null; } }
function ssSet(key: string, v: string) { try { sessionStorage.setItem(key, v); } catch { /* */ } }

// Parse comma/semicolon/newline separated terms
function parseTerms(input: string): string[] {
  return input.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
}

// Source table → human label
const SOURCE_LABELS: Record<string, string> = {
  manifest_summaries: 'Summary',
  manifest_declarations: 'Declaration',
  ai_framework_principles: 'Framework',
  manifest_action_steps: 'Action Step',
  manifest_questions: 'Question',
};

interface SemanticSearchProps {
  onClose: () => void;
}

export function SemanticSearch({ onClose }: SemanticSearchProps) {
  const { user } = useAuthContext();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>(() => {
    const stored = ssGet('manifest-semantic-mode');
    if (stored === 'any' || stored === 'together' || stored === 'separate') return stored;
    return 'any';
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('relevance');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ManifestContentMatch[] | null>(null);
  const [separateResults, setSeparateResults] = useState<Map<string, ManifestContentMatch[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const searchIdRef = useRef(0);

  const handleModeChange = useCallback((m: SearchMode) => {
    setMode(m);
    ssSet('manifest-semantic-mode', m);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!user || !query.trim()) return;
    const id = ++searchIdRef.current;
    setSearching(true);
    setError(null);
    setResults(null);
    setSeparateResults(null);

    try {
      if (mode === 'together' || parseTerms(query).length <= 1) {
        // Single query
        const matches = await searchManifestContent(query.trim(), user.id, { matchThreshold: 0.25, matchCount: 30 });
        if (id !== searchIdRef.current) return;
        setResults(matches);
        setResultCount(matches.length);
      } else if (mode === 'any') {
        // Search each term, merge + deduplicate, rank by match count + similarity
        const terms = parseTerms(query);
        const allMatches: (ManifestContentMatch & { matchedTerms: string[] })[] = [];
        const seenIds = new Map<string, number>(); // record_id → index in allMatches

        for (const term of terms) {
          const matches = await searchManifestContent(term, user.id, { matchThreshold: 0.25, matchCount: 20 });
          if (id !== searchIdRef.current) return;
          for (const m of matches) {
            const existing = seenIds.get(m.record_id);
            if (existing !== undefined) {
              // Already seen — add term and boost similarity
              const e = allMatches[existing];
              e.matchedTerms.push(term);
              e.similarity = Math.max(e.similarity, m.similarity);
            } else {
              seenIds.set(m.record_id, allMatches.length);
              allMatches.push({ ...m, matchedTerms: [term] });
            }
          }
        }

        // Sort: more matched terms first, then by similarity
        allMatches.sort((a, b) => {
          if (a.matchedTerms.length !== b.matchedTerms.length) return b.matchedTerms.length - a.matchedTerms.length;
          return b.similarity - a.similarity;
        });

        setResults(allMatches);
        setResultCount(allMatches.length);
      } else {
        // Separate mode: group results by term
        const terms = parseTerms(query);
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
      }
    } catch {
      if (id === searchIdRef.current) setError('Search failed. Try again.');
    } finally {
      if (id === searchIdRef.current) setSearching(false);
    }
  }, [user, query, mode]);

  const terms = parseTerms(query);
  const showTermChips = (mode === 'any' || mode === 'separate') && terms.length > 1;

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
            <button type="button" className="semantic-search__input-clear" onClick={() => { setQuery(''); setResults(null); setSeparateResults(null); }}>
              <X size={12} />
            </button>
          )}
        </div>
        <Button size="sm" onClick={handleSearch} disabled={!query.trim() || searching}>
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
              <ResultCard key={`${m.source_table}-${m.record_id}`} match={m} matchedTerms={'matchedTerms' in m ? (m as { matchedTerms: string[] }).matchedTerms : undefined} />
            ))
          ) : (
            // Group by book
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
                    <ResultCard key={`${m.source_table}-${m.record_id}`} match={m} />
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
                  <ResultCard key={`${m.source_table}-${m.record_id}`} match={m} />
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

function ResultCard({ match, matchedTerms }: { match: ManifestContentMatch; matchedTerms?: string[] }) {
  return (
    <div className="semantic-search__result">
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
      </div>
    </div>
  );
}
