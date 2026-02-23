import { useState, useCallback } from 'react';
import { Copy, BookOpen } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { generateVictoryNarrative } from '../../lib/ai';
import { supabase } from '../../lib/supabase';
import type { Victory, MastEntry } from '../../lib/types';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { VictoryCard } from './VictoryCard';
import './VictoryReview.css';

type ReviewPeriod = 'today' | 'this_week' | 'this_month';

interface VictoryReviewProps {
  victories: Victory[];
  mastEntries: MastEntry[];
  onVictoryClick: (victory: Victory) => void;
  onClose: () => void;
}

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
};

export function VictoryReview({ victories, mastEntries, onVictoryClick, onClose }: VictoryReviewProps) {
  const { user } = useAuthContext();
  const [period, setPeriod] = useState<ReviewPeriod>('this_week');
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filteredVictories = victories.filter((v) => {
    const created = new Date(v.created_at);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'today':
        return created >= today;
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        return created >= monday;
      }
      case 'this_month': {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return created >= firstOfMonth;
      }
    }
  });

  const generateNarrative = useCallback(async () => {
    if (!user || filteredVictories.length === 0) return;
    setLoading(true);

    const victoriesText = filteredVictories
      .map((v) => `- ${v.description}${v.celebration_text ? ` (${v.celebration_text})` : ''}`)
      .join('\n');

    const mastContext = mastEntries.length > 0
      ? mastEntries.map((m) => `${m.type}: ${m.text}`).join('\n')
      : undefined;

    const result = await generateVictoryNarrative(victoriesText, user.id, mastContext, 'review');
    setNarrative(result);
    setLoading(false);
  }, [user, filteredVictories, mastEntries]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveToLog = async () => {
    if (!user || !narrative) return;
    try {
      await supabase.from('log_entries').insert({
        user_id: user.id,
        text: narrative,
        entry_type: 'reflection',
        source: 'manual_text',
        life_area_tags: [],
        routed_to: [],
        routed_reference_ids: {},
      });
      showToast('Saved to Log');
    } catch {
      showToast('Failed to save');
    }
  };

  const handleCopy = () => {
    if (narrative) {
      navigator.clipboard.writeText(narrative);
      showToast('Copied to clipboard');
    }
  };

  return (
    <div className="victory-review-overlay" onClick={onClose}>
      <div className="victory-review" onClick={(e) => e.stopPropagation()}>
        <div className="victory-review__header">
          <h2>Victory Review</h2>
          <Button variant="text" onClick={onClose}>Close</Button>
        </div>

        <div className="victory-review__periods">
          {(Object.keys(PERIOD_LABELS) as ReviewPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`victory-review__period ${period === p ? 'victory-review__period--active' : ''}`}
              onClick={() => { setPeriod(p); setNarrative(null); }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="victory-review__body">
          {filteredVictories.length === 0 ? (
            <p className="victory-review__empty">
              No victories recorded for {PERIOD_LABELS[period].toLowerCase()}.
            </p>
          ) : (
            <>
              {!narrative && !loading && (
                <Button onClick={generateNarrative} className="victory-review__generate-btn">
                  Generate Review ({filteredVictories.length} {filteredVictories.length === 1 ? 'victory' : 'victories'})
                </Button>
              )}

              {loading && (
                <div className="victory-review__loading">
                  <LoadingSpinner /> Reflecting on your victories...
                </div>
              )}

              {narrative && (
                <div className="victory-review__narrative">
                  <p>{narrative}</p>
                  <div className="victory-review__narrative-actions">
                    <Button variant="text" onClick={handleSaveToLog}>
                      <BookOpen size={14} /> Save to Log
                    </Button>
                    <Button variant="text" onClick={handleCopy}>
                      <Copy size={14} /> Copy
                    </Button>
                  </div>
                </div>
              )}

              <div className="victory-review__list">
                {filteredVictories.map((v) => (
                  <VictoryCard key={v.id} victory={v} onClick={onVictoryClick} />
                ))}
              </div>
            </>
          )}
        </div>

        {toast && <div className="victory-review__toast">{toast}</div>}
      </div>
    </div>
  );
}
