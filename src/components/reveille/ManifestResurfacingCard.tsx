import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import './ManifestResurfacingCard.css';

interface ResurfacedItem {
  id: string;
  table: string;
  text: string;
  bookTitle: string;
  sectionTitle: string | null;
  contentType: string;
}

export function ManifestResurfacingCard() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<ResurfacedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchResurfacingItems(user.id).then((result) => {
      setItems(result);
      setLoading(false);
    });
  }, [user]);

  if (loading || items.length === 0) return null;

  return (
    <div className="manifest-resurfacing">
      <h3 className="manifest-resurfacing__title">
        <BookOpen size={16} /> From Your Library
      </h3>
      <div className="manifest-resurfacing__items">
        {items.map((item) => (
          <div key={`${item.table}-${item.id}`} className="manifest-resurfacing__item">
            <span className="manifest-resurfacing__type">{item.contentType}</span>
            <p className="manifest-resurfacing__text">{item.text}</p>
            <span className="manifest-resurfacing__book">
              <BookOpen size={11} /> {item.bookTitle}
              {item.sectionTitle && ` — ${item.sectionTitle}`}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="manifest-resurfacing__see-more"
        onClick={() => navigate('/manifest')}
      >
        See more <ChevronRight size={14} />
      </button>
    </div>
  );
}

// Fetch 1-3 hearted items not shown in last 3 days
async function fetchResurfacingItems(userId: string): Promise<ResurfacedItem[]> {
  try {
    // Get recently shown IDs to exclude
    const { data: settings } = await supabase
      .from('user_settings')
      .select('manifest_resurfaced_ids')
      .eq('user_id', userId)
      .single();

    const resurfaced: Array<{ id: string; table: string; shown_at: string }> = settings?.manifest_resurfaced_ids || [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentIds = resurfaced.filter((r) => r.shown_at > threeDaysAgo).map((r) => r.id);

    // Fetch hearted summaries
    const { data: summaries } = await supabase
      .from('manifest_summaries')
      .select('id, text, content_type, section_title, manifest_item_id')
      .eq('user_id', userId)
      .eq('is_hearted', true)
      .eq('is_deleted', false)
      .limit(10);

    // Fetch hearted action steps
    const { data: actionSteps } = await supabase
      .from('manifest_action_steps')
      .select('id, text, content_type, section_title, manifest_item_id')
      .eq('user_id', userId)
      .eq('is_hearted', true)
      .eq('is_deleted', false)
      .limit(10);

    // Fetch hearted declarations
    const { data: declarations } = await supabase
      .from('manifest_declarations')
      .select('id, declaration_text, declaration_style, section_title, manifest_item_id')
      .eq('user_id', userId)
      .eq('is_hearted', true)
      .eq('is_deleted', false)
      .limit(10);

    // Combine and exclude recently shown
    const candidates: Array<{ id: string; table: string; text: string; contentType: string; sectionTitle: string | null; manifestItemId: string }> = [];

    for (const s of summaries || []) {
      if (!recentIds.includes(s.id)) {
        candidates.push({ id: s.id, table: 'manifest_summaries', text: s.text, contentType: s.content_type.replace(/_/g, ' '), sectionTitle: s.section_title, manifestItemId: s.manifest_item_id });
      }
    }
    for (const a of actionSteps || []) {
      if (!recentIds.includes(a.id)) {
        candidates.push({ id: a.id, table: 'manifest_action_steps', text: a.text, contentType: a.content_type.replace(/_/g, ' '), sectionTitle: a.section_title, manifestItemId: a.manifest_item_id });
      }
    }
    for (const d of declarations || []) {
      if (!recentIds.includes(d.id)) {
        candidates.push({ id: d.id, table: 'manifest_declarations', text: d.declaration_text, contentType: d.declaration_style.replace(/_/g, ' '), sectionTitle: d.section_title, manifestItemId: d.manifest_item_id });
      }
    }

    // Shuffle and take up to 3, mixing content types
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const selected: typeof candidates = [];
    const usedTypes = new Set<string>();
    for (const c of shuffled) {
      if (selected.length >= 3) break;
      // Prefer variety in content types
      if (selected.length < 2 || !usedTypes.has(c.table)) {
        selected.push(c);
        usedTypes.add(c.table);
      }
    }
    // Fill remaining if we couldn't get variety
    if (selected.length < 3) {
      for (const c of shuffled) {
        if (selected.length >= 3) break;
        if (!selected.some((s) => s.id === c.id)) selected.push(c);
      }
    }

    if (selected.length === 0) return [];

    // Fetch book titles for selected items
    const itemIds = [...new Set(selected.map((s) => s.manifestItemId))];
    const { data: books } = await supabase
      .from('manifest_items')
      .select('id, title')
      .in('id', itemIds);
    const bookMap = new Map((books || []).map((b) => [b.id, b.title]));

    // Track shown items
    const newResurfaced = [
      ...resurfaced.filter((r) => r.shown_at > threeDaysAgo), // keep recent entries
      ...selected.map((s) => ({ id: s.id, table: s.table, shown_at: new Date().toISOString() })),
    ];
    await supabase
      .from('user_settings')
      .update({ manifest_resurfaced_ids: newResurfaced })
      .eq('user_id', userId);

    return selected.map((s) => ({
      id: s.id,
      table: s.table,
      text: s.text,
      bookTitle: bookMap.get(s.manifestItemId) || 'Unknown Book',
      sectionTitle: s.sectionTitle,
      contentType: s.contentType,
    }));
  } catch {
    return [];
  }
}
