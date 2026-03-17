import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Heart, Trash2, Anchor, Compass, Sparkles, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import type { ManifestSummary, ManifestDeclaration, ManifestActionStep, AIFrameworkPrinciple } from '../../lib/types';
import { ACTION_STEP_CONTENT_TYPE_LABELS, DECLARATION_STYLE_LABELS, MANIFEST_SUMMARY_COLUMNS, MANIFEST_DECLARATION_COLUMNS, MANIFEST_ACTION_STEP_COLUMNS, AI_FRAMEWORK_PRINCIPLE_COLUMNS } from '../../lib/types';
import type { ActionStepContentType } from '../../lib/types';
import type { BookExtractionGroup } from '../../lib/exportExtractions';
import { ExportDialog } from './ExportDialog';
import './HeartedItemsView.css';
import './ExtractionTabs.css';

interface HeartedItemsViewProps {
  onBack?: () => void;
}

interface BookGroup {
  bookId: string;
  bookTitle: string;
  summaries: ManifestSummary[];
  declarations: ManifestDeclaration[];
  actionSteps: ManifestActionStep[];
  principles: (AIFrameworkPrinciple & { framework_name?: string })[];
}

export function HeartedItemsView({ onBack }: HeartedItemsViewProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const handleBack = onBack || (() => navigate('/manifest'));
  const [loading, setLoading] = useState(true);
  const [bookGroups, setBookGroups] = useState<BookGroup[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [sendingToMast, setSendingToMast] = useState<Set<string>>(new Set());
  const [sendingToCompass, setSendingToCompass] = useState<Set<string>>(new Set());
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Fetch all hearted items
  const fetchHeartedItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [summaryRes, declRes, principleRes, actionStepRes] = await Promise.all([
        supabase
          .from('manifest_summaries')
          .select(MANIFEST_SUMMARY_COLUMNS)
          .eq('user_id', user.id)
          .eq('is_hearted', true)
          .eq('is_deleted', false)
          .order('manifest_item_id')
          .order('sort_order', { ascending: true })
          .limit(10000),
        supabase
          .from('manifest_declarations')
          .select(MANIFEST_DECLARATION_COLUMNS)
          .eq('user_id', user.id)
          .eq('is_hearted', true)
          .eq('is_deleted', false)
          .order('manifest_item_id')
          .order('sort_order', { ascending: true })
          .limit(10000),
        supabase
          .from('ai_framework_principles')
          .select(`${AI_FRAMEWORK_PRINCIPLE_COLUMNS}, ai_frameworks!inner(manifest_item_id, name)`)
          .eq('user_id', user.id)
          .eq('is_hearted', true)
          .eq('is_deleted', false)
          .order('sort_order', { ascending: true })
          .limit(10000),
        supabase
          .from('manifest_action_steps')
          .select(MANIFEST_ACTION_STEP_COLUMNS)
          .eq('user_id', user.id)
          .eq('is_hearted', true)
          .eq('is_deleted', false)
          .order('manifest_item_id')
          .order('sort_order', { ascending: true })
          .limit(10000),
      ]);

      const summaries = (summaryRes.data || []) as ManifestSummary[];
      const declarations = (declRes.data || []) as ManifestDeclaration[];
      const rawPrinciples = (principleRes.data || []) as Array<AIFrameworkPrinciple & { ai_frameworks: { manifest_item_id: string; name: string } }>;
      const actionSteps = (actionStepRes.data || []) as ManifestActionStep[];

      const itemIds = new Set<string>();
      summaries.forEach((s) => itemIds.add(s.manifest_item_id));
      declarations.forEach((d) => itemIds.add(d.manifest_item_id));
      rawPrinciples.forEach((p) => itemIds.add(p.ai_frameworks.manifest_item_id));
      actionSteps.forEach((a) => itemIds.add(a.manifest_item_id));

      const { data: items } = await supabase
        .from('manifest_items')
        .select('id, title')
        .in('id', Array.from(itemIds));

      const titleMap = new Map((items || []).map((i: { id: string; title: string }) => [i.id, i.title]));

      const groups: BookGroup[] = [];
      for (const bookId of itemIds) {
        const group: BookGroup = {
          bookId,
          bookTitle: titleMap.get(bookId) || 'Unknown Book',
          summaries: summaries.filter((s) => s.manifest_item_id === bookId),
          declarations: declarations.filter((d) => d.manifest_item_id === bookId),
          actionSteps: actionSteps.filter((a) => a.manifest_item_id === bookId),
          principles: rawPrinciples
            .filter((p) => p.ai_frameworks.manifest_item_id === bookId)
            .map((p) => ({ ...p, framework_name: p.ai_frameworks.name })),
        };
        if (group.summaries.length > 0 || group.declarations.length > 0 || group.principles.length > 0 || group.actionSteps.length > 0) {
          groups.push(group);
        }
      }

      setBookGroups(groups);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHeartedItems();
  }, [fetchHeartedItems]);

  const totalCount = useMemo(() => {
    return bookGroups.reduce(
      (sum, g) => sum + g.summaries.length + g.declarations.length + g.principles.length + g.actionSteps.length,
      0,
    );
  }, [bookGroups]);

  // --- Unheart (removes from this view) ---
  const handleUnheart = useCallback(async (table: string, id: string) => {
    if (!user) return;
    // Optimistic: remove from local state
    setBookGroups((prev) =>
      prev.map((g) => ({
        ...g,
        summaries: g.summaries.filter((s) => s.id !== id),
        declarations: g.declarations.filter((d) => d.id !== id),
        actionSteps: g.actionSteps.filter((a) => a.id !== id),
        principles: g.principles.filter((p) => p.id !== id),
      })).filter((g) => g.summaries.length > 0 || g.declarations.length > 0 || g.actionSteps.length > 0 || g.principles.length > 0),
    );
    await supabase.from(table).update({ is_hearted: false }).eq('id', id).eq('user_id', user.id);
  }, [user]);

  // --- Delete ---
  const handleDelete = useCallback(async (table: string, id: string) => {
    if (!user) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      await supabase.from(table).update({ is_deleted: true }).eq('id', id).eq('user_id', user.id);
      setBookGroups((prev) =>
        prev.map((g) => ({
          ...g,
          summaries: g.summaries.filter((s) => s.id !== id),
          declarations: g.declarations.filter((d) => d.id !== id),
          actionSteps: g.actionSteps.filter((a) => a.id !== id),
          principles: g.principles.filter((p) => p.id !== id),
        })).filter((g) => g.summaries.length > 0 || g.declarations.length > 0 || g.actionSteps.length > 0 || g.principles.length > 0),
      );
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 300);
  }, [user]);

  // --- Inline edit ---
  const startEditing = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  }, []);

  const handleSaveEdit = useCallback(async (table: string, id: string, field: string) => {
    if (!user || !editingText.trim()) { setEditingId(null); return; }
    await supabase.from(table).update({ [field]: editingText.trim() }).eq('id', id).eq('user_id', user.id);
    setBookGroups((prev) =>
      prev.map((g) => ({
        ...g,
        summaries: g.summaries.map((s) => s.id === id ? { ...s, [field]: editingText.trim() } : s),
        declarations: g.declarations.map((d) => d.id === id ? { ...d, [field]: editingText.trim() } : d),
        actionSteps: g.actionSteps.map((a) => a.id === id ? { ...a, [field]: editingText.trim() } : a),
        principles: g.principles.map((p) => p.id === id ? { ...p, [field]: editingText.trim() } : p),
      })),
    );
    setEditingId(null);
  }, [user, editingText]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  // --- User Notes ---
  const startNoting = useCallback((id: string, note: string | null) => {
    setNotingId(id);
    setNoteDraft(note || '');
  }, []);

  const handleSaveNote = useCallback(async (table: string, id: string) => {
    if (!user) { setNotingId(null); return; }
    const noteVal = noteDraft.trim() || null;
    await supabase.from(table).update({ user_note: noteVal }).eq('id', id).eq('user_id', user.id);
    setBookGroups((prev) =>
      prev.map((g) => ({
        ...g,
        summaries: g.summaries.map((s) => s.id === id ? { ...s, user_note: noteVal } : s),
        declarations: g.declarations.map((d) => d.id === id ? { ...d, user_note: noteVal } : d),
        actionSteps: g.actionSteps.map((a) => a.id === id ? { ...a, user_note: noteVal } : a),
        principles: g.principles.map((p) => p.id === id ? { ...p, user_note: noteVal } : p),
      })),
    );
    setNotingId(null);
  }, [user, noteDraft]);

  // --- Send to Mast ---
  const handleSendToMast = useCallback(async (declId: string) => {
    if (!user) return;
    setSendingToMast((prev) => new Set(prev).add(declId));
    try {
      const declData = bookGroups.flatMap((g) => g.declarations).find((d) => d.id === declId);
      if (!declData) return;

      const { data: mastEntry } = await supabase
        .from('mast_entries')
        .insert({
          user_id: user.id,
          type: 'declaration',
          text: declData.declaration_text,
          category: declData.value_name || null,
          source: 'manifest_extraction',
        })
        .select('id')
        .single();

      if (mastEntry) {
        await supabase.from('manifest_declarations')
          .update({ sent_to_mast: true, mast_entry_id: mastEntry.id })
          .eq('id', declId).eq('user_id', user.id);

        setBookGroups((prev) =>
          prev.map((g) => ({
            ...g,
            declarations: g.declarations.map((d) =>
              d.id === declId ? { ...d, sent_to_mast: true, mast_entry_id: mastEntry.id } : d,
            ),
          })),
        );
      }
    } finally {
      setSendingToMast((prev) => { const n = new Set(prev); n.delete(declId); return n; });
    }
  }, [user, bookGroups]);

  // --- Send to Compass ---
  const handleSendToCompass = useCallback(async (stepId: string) => {
    if (!user) return;
    setSendingToCompass((prev) => new Set(prev).add(stepId));
    try {
      const stepData = bookGroups.flatMap((g) => g.actionSteps).find((a) => a.id === stepId);
      if (!stepData) return;

      const title = stepData.text.length > 200 ? stepData.text.substring(0, 200) + '...' : stepData.text;
      const { data: task } = await supabase
        .from('compass_tasks')
        .insert({
          user_id: user.id,
          title,
          description: stepData.text.length > 200 ? stepData.text : null,
          due_date: new Date().toISOString().split('T')[0],
          source: 'manifest_extraction',
          source_reference_id: stepData.id,
        })
        .select('id')
        .single();

      if (task) {
        await supabase.from('manifest_action_steps')
          .update({ sent_to_compass: true, compass_task_id: task.id })
          .eq('id', stepId).eq('user_id', user.id);

        setBookGroups((prev) =>
          prev.map((g) => ({
            ...g,
            actionSteps: g.actionSteps.map((a) =>
              a.id === stepId ? { ...a, sent_to_compass: true, compass_task_id: task.id } : a,
            ),
          })),
        );

        supabase.functions.invoke('auto-tag', { body: { entry_id: task.id, text: title, entry_type: 'compass_task' } }).catch(() => {});
      }
    } finally {
      setSendingToCompass((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
    }
  }, [user, bookGroups]);

  // --- Export ---
  const [showExportDialog, setShowExportDialog] = useState(false);

  const exportGroups = useMemo((): BookExtractionGroup[] => {
    return bookGroups.map((g) => ({
      bookTitle: g.bookTitle,
      summaries: g.summaries,
      declarations: g.declarations,
      actionSteps: g.actionSteps,
      principles: g.principles,
    }));
  }, [bookGroups]);

  if (loading) {
    return (
      <div className="hearted-items">
        <div className="hearted-items__header">
          <button type="button" className="hearted-items__back" onClick={handleBack}>
            <ChevronLeft size={16} />
            Back
          </button>
          <h2 className="hearted-items__title">Favorites</h2>
        </div>
        <div className="hearted-items__loading">Loading hearted items...</div>
      </div>
    );
  }

  return (
    <div className="hearted-items">
      <div className="hearted-items__header">
        <button type="button" className="hearted-items__back" onClick={handleBack}>
          <ChevronLeft size={16} />
          Back
        </button>
        <h2 className="hearted-items__title">Favorites</h2>
      </div>

      {totalCount > 0 && (
        <div className="hearted-items__export-row">
          <button type="button" className="hearted-items__export-btn" onClick={() => setShowExportDialog(true)}>
            <Download size={12} /> Export
          </button>
        </div>
      )}

      {showExportDialog && (
        <ExportDialog
          groups={exportGroups}
          onClose={() => setShowExportDialog(false)}
          defaultTitle={`My Hearted Items`}
          mode="hearted"
        />
      )}

      {bookGroups.length === 0 ? (
        <div className="hearted-items__empty">
          No hearted items yet. Heart items you love across your books and they'll appear here.
        </div>
      ) : (
        bookGroups.map((group) => (
          <div key={group.bookId} className="hearted-items__book-section">
            <h3 className="hearted-items__book-title">{group.bookTitle}</h3>

            {group.summaries.length > 0 && (
              <>
                <div className="hearted-items__type-label">Key Insights</div>
                {group.summaries.map((s) => (
                  <div key={s.id} className={`extraction-item${s.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(s.id) ? ' extraction-item--deleting' : ''}`}>
                    <span className="extraction-item__type-badge">{s.content_type.replace(/_/g, ' ')}</span>
                    {editingId === s.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit('manifest_summaries', s.id, 'text')}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                        autoFocus
                      />
                    ) : (
                      <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(s.id, s.text)}>
                        {s.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {s.text}
                      </p>
                    )}
                    <div className="extraction-item__actions">
                      <button type="button" className="extraction-item__heart extraction-item__heart--active" onClick={() => handleUnheart('manifest_summaries', s.id)} title="Remove heart">
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${s.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === s.id ? handleSaveNote('manifest_summaries', s.id) : startNoting(s.id, s.user_note)}
                        title={s.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      <button type="button" className="extraction-item__delete" onClick={() => handleDelete('manifest_summaries', s.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === s.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={() => handleSaveNote('manifest_summaries', s.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : s.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNoting(s.id, s.user_note)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {s.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}

            {group.principles.length > 0 && (
              <>
                <div className="hearted-items__type-label">
                  Framework Principles
                  {group.principles[0]?.framework_name && ` (${group.principles[0].framework_name})`}
                </div>
                {group.principles.map((p) => (
                  <div key={p.id} className={`extraction-item${p.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(p.id) ? ' extraction-item--deleting' : ''}`}>
                    {editingId === p.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit('ai_framework_principles', p.id, 'text')}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                        autoFocus
                      />
                    ) : (
                      <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(p.id, p.text)}>
                        {p.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {p.text}
                      </p>
                    )}
                    <div className="extraction-item__actions">
                      <button type="button" className="extraction-item__heart extraction-item__heart--active" onClick={() => handleUnheart('ai_framework_principles', p.id)} title="Remove heart">
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${p.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === p.id ? handleSaveNote('ai_framework_principles', p.id) : startNoting(p.id, p.user_note)}
                        title={p.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      <button type="button" className="extraction-item__delete" onClick={() => handleDelete('ai_framework_principles', p.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === p.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={() => handleSaveNote('ai_framework_principles', p.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : p.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNoting(p.id, p.user_note)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {p.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}

            {group.actionSteps.length > 0 && (
              <>
                <div className="hearted-items__type-label">Action Steps</div>
                {group.actionSteps.map((a) => (
                  <div key={a.id} className={`extraction-item${a.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(a.id) ? ' extraction-item--deleting' : ''}`}>
                    <span className="extraction-item__type-badge">
                      {ACTION_STEP_CONTENT_TYPE_LABELS[a.content_type as ActionStepContentType] || a.content_type.replace(/_/g, ' ')}
                    </span>
                    {editingId === a.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit('manifest_action_steps', a.id, 'text')}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                        autoFocus
                      />
                    ) : (
                      <p className="extraction-item__text extraction-item__text--editable" onClick={() => startEditing(a.id, a.text)}>
                        {a.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        {a.text}
                      </p>
                    )}
                    <div className="extraction-item__actions">
                      <button type="button" className="extraction-item__heart extraction-item__heart--active" onClick={() => handleUnheart('manifest_action_steps', a.id)} title="Remove heart">
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${a.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === a.id ? handleSaveNote('manifest_action_steps', a.id) : startNoting(a.id, a.user_note)}
                        title={a.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      {a.sent_to_compass ? (
                        <span className="extraction-item__compass-sent">In Compass</span>
                      ) : (
                        <button type="button" className="extraction-item__send-compass" onClick={() => handleSendToCompass(a.id)} disabled={sendingToCompass.has(a.id)}>
                          <Compass size={14} /> {sendingToCompass.has(a.id) ? '...' : 'Compass'}
                        </button>
                      )}
                      <button type="button" className="extraction-item__delete" onClick={() => handleDelete('manifest_action_steps', a.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === a.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={() => handleSaveNote('manifest_action_steps', a.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : a.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNoting(a.id, a.user_note)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {a.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}

            {group.declarations.length > 0 && (
              <>
                <div className="hearted-items__type-label">Declarations</div>
                {group.declarations.map((d) => (
                  <div key={d.id} className={`extraction-item extraction-item--declaration${d.is_from_go_deeper ? ' extraction-item--deeper' : ''}${deletingIds.has(d.id) ? ' extraction-item--deleting' : ''}`}>
                    <div className="extraction-item__declaration-meta">
                      {d.value_name && <span className="extraction-item__value-name">{d.value_name}</span>}
                      <span className="extraction-item__style-label">{DECLARATION_STYLE_LABELS[d.declaration_style]}</span>
                    </div>
                    {editingId === d.id ? (
                      <textarea
                        className="extraction-item__edit-textarea"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit('manifest_declarations', d.id, 'declaration_text')}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                        autoFocus
                      />
                    ) : (
                      <p className="extraction-item__text extraction-item__text--declaration extraction-item__text--editable" onClick={() => startEditing(d.id, d.declaration_text)}>
                        {d.is_from_go_deeper && <Sparkles size={12} className="extraction-item__deeper-icon" />}
                        &ldquo;{d.declaration_text}&rdquo;
                      </p>
                    )}
                    <div className="extraction-item__actions">
                      <button type="button" className="extraction-item__heart extraction-item__heart--active" onClick={() => handleUnheart('manifest_declarations', d.id)} title="Remove heart">
                        <Heart size={14} fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        className={`extraction-item__note-btn${d.user_note ? ' extraction-item__note-btn--active' : ''}`}
                        onClick={() => notingId === d.id ? handleSaveNote('manifest_declarations', d.id) : startNoting(d.id, d.user_note)}
                        title={d.user_note ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote size={14} />
                      </button>
                      {d.sent_to_mast ? (
                        <span className="extraction-item__mast-sent">In Mast</span>
                      ) : (
                        <button type="button" className="extraction-item__send-mast" onClick={() => handleSendToMast(d.id)} disabled={sendingToMast.has(d.id)}>
                          <Anchor size={14} /> {sendingToMast.has(d.id) ? '...' : 'Mast'}
                        </button>
                      )}
                      <button type="button" className="extraction-item__delete" onClick={() => handleDelete('manifest_declarations', d.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {notingId === d.id ? (
                      <textarea
                        className="extraction-item__note-textarea"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={() => handleSaveNote('manifest_declarations', d.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNotingId(null); }}
                        autoFocus
                        rows={2}
                        placeholder="Add a note..."
                      />
                    ) : d.user_note ? (
                      <div className="extraction-item__note" onClick={() => startNoting(d.id, d.user_note)}>
                        <span className="extraction-item__note-label">NOTE</span>
                        {d.user_note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
