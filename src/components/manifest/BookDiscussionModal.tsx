import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, Send, Copy, Anchor, Target, HelpCircle, CheckSquare, BarChart3, Clock, Trash2 } from 'lucide-react';
import type { DiscussionType, DiscussionAudience, BookDiscussion, BookDiscussionMessage } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import './BookDiscussionModal.css';

const DISCUSSION_TYPE_LABELS: Record<DiscussionType, string> = {
  discuss: 'Discussing',
  generate_goals: 'Generating Goals',
  generate_questions: 'Generating Questions',
  generate_tasks: 'Generating Tasks',
  generate_tracker: 'Generating Tracker Ideas',
};

const AUDIENCE_LABELS: Record<DiscussionAudience, string> = {
  personal: 'Personal',
  family: 'Family',
  teen: 'Teen',
  spouse: 'Spouse',
  children: 'Children',
};

const DISCUSSION_TYPE_ICONS: Record<DiscussionType, typeof Anchor> = {
  discuss: Anchor,
  generate_goals: Target,
  generate_questions: HelpCircle,
  generate_tasks: CheckSquare,
  generate_tracker: BarChart3,
};

interface BookDiscussionModalProps {
  bookTitles: string[];
  manifestItemIds: string[];
  discussionType: DiscussionType;
  initialAudience?: DiscussionAudience;
  /** If provided, continues an existing discussion instead of starting new */
  existingDiscussionId?: string;
  onClose: () => void;
  /** Called when items are routed to another feature */
  onRouted?: (destination: string, count: number) => void;
  /** Past discussions for history panel */
  discussions?: BookDiscussion[];
  /** Called when user selects a past discussion from history */
  onSwitchDiscussion?: (discussion: BookDiscussion) => void;
  /** Called when user deletes a discussion from history */
  onDeleteDiscussion?: (discussionId: string) => void;
  /** Map of manifest item IDs to titles for resolving book names in history */
  itemTitleMap?: Record<string, string>;
}

export function BookDiscussionModal({
  bookTitles,
  manifestItemIds,
  discussionType,
  initialAudience = 'personal',
  existingDiscussionId,
  onClose,
  onRouted,
  discussions: pastDiscussions,
  onSwitchDiscussion,
  onDeleteDiscussion,
  itemTitleMap,
}: BookDiscussionModalProps) {
  const { user } = useAuthContext();
  const [discussionId, setDiscussionId] = useState<string | null>(existingDiscussionId || null);
  const [messages, setMessages] = useState<BookDiscussionMessage[]>([]);
  const [audience, setAudience] = useState<DiscussionAudience>(initialAudience);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [started, setStarted] = useState(!!existingDiscussionId);
  const [showHistory, setShowHistory] = useState(false);
  const [selfFetchedDiscussions, setSelfFetchedDiscussions] = useState<BookDiscussion[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all discussions on mount so history is always available
  useEffect(() => {
    if (!user) return;
    supabase
      .from('book_discussions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSelfFetchedDiscussions(data);
      });
  }, [user]);

  // Use passed-in discussions if available, otherwise use self-fetched
  const allDiscussions = useMemo(() => {
    if (pastDiscussions && pastDiscussions.length > 0) return pastDiscussions;
    return selfFetchedDiscussions;
  }, [pastDiscussions, selfFetchedDiscussions]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Load existing discussion on mount (new discussions wait for user to click Begin)
  useEffect(() => {
    if (existingDiscussionId) {
      loadExistingDiscussion(existingDiscussionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBegin = useCallback(() => {
    setStarted(true);
    startNewDiscussion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const loadExistingDiscussion = async (id: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: msgs } = await supabase
        .from('book_discussion_messages')
        .select('*')
        .eq('discussion_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setMessages(msgs || []);
      setDiscussionId(id);
    } finally {
      setLoading(false);
    }
  };

  const startNewDiscussion = async () => {
    if (!user) return;
    setSending(true);
    setError(null);

    try {
      // Create discussion record
      const { data: discussion, error: createErr } = await supabase
        .from('book_discussions')
        .insert({
          user_id: user.id,
          manifest_item_ids: manifestItemIds,
          discussion_type: discussionType,
          audience,
        })
        .select('*')
        .single();

      if (createErr || !discussion) {
        setError(createErr?.message || 'Failed to create discussion');
        return;
      }

      setDiscussionId(discussion.id);

      // Get AI opening
      const { data: aiResponse, error: aiErr } = await supabase.functions.invoke('manifest-discuss', {
        body: {
          manifest_item_ids: manifestItemIds,
          discussion_type: discussionType,
          audience,
          message: '',
          conversation_history: [],
        },
      });

      if (aiErr || aiResponse?.error) {
        setError(aiErr?.message || aiResponse?.error || 'AI response failed');
        return;
      }

      const aiContent = aiResponse?.content || '';
      if (aiContent) {
        const { data: aiMsg } = await supabase
          .from('book_discussion_messages')
          .insert({
            user_id: user.id,
            discussion_id: discussion.id,
            role: 'assistant',
            content: aiContent,
          })
          .select('*')
          .single();

        if (aiMsg) {
          setMessages([aiMsg]);
        }

        // Auto-title
        const snippet = aiContent.substring(0, 80).replace(/\n/g, ' ').trim();
        await supabase
          .from('book_discussions')
          .update({ title: snippet.length >= 80 ? snippet.substring(0, 77) + '...' : snippet })
          .eq('id', discussion.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleSend = useCallback(async () => {
    if (!user || !discussionId || !inputText.trim() || sending) return;
    const content = inputText.trim();
    setInputText('');
    setSending(true);
    setError(null);

    try {
      // Save user message
      const { data: userMsg } = await supabase
        .from('book_discussion_messages')
        .insert({
          user_id: user.id,
          discussion_id: discussionId,
          role: 'user',
          content,
        })
        .select('*')
        .single();

      if (userMsg) {
        setMessages((prev) => [...prev, userMsg]);
      }

      // Build history for AI
      const history = [...messages, ...(userMsg ? [userMsg] : [])].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call AI
      const { data: aiResponse, error: aiErr } = await supabase.functions.invoke('manifest-discuss', {
        body: {
          manifest_item_ids: manifestItemIds,
          discussion_type: discussionType,
          audience,
          message: content,
          conversation_history: history.slice(0, -1),
        },
      });

      if (aiErr || aiResponse?.error) {
        setError(aiErr?.message || aiResponse?.error || 'AI response failed');
        return;
      }

      const aiContent = aiResponse?.content || '';
      if (aiContent) {
        const { data: aiMsg } = await supabase
          .from('book_discussion_messages')
          .insert({
            user_id: user.id,
            discussion_id: discussionId,
            role: 'assistant',
            content: aiContent,
          })
          .select('*')
          .single();

        if (aiMsg) {
          setMessages((prev) => [...prev, aiMsg]);
        }
      }

      // Update discussion timestamp
      await supabase
        .from('book_discussions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', discussionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [user, discussionId, inputText, sending, messages, manifestItemIds, discussionType, audience]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleAudienceChange = useCallback(async (newAudience: DiscussionAudience) => {
    setAudience(newAudience);
    if (discussionId && user) {
      await supabase
        .from('book_discussions')
        .update({ audience: newAudience })
        .eq('id', discussionId)
        .eq('user_id', user.id);
    }
  }, [discussionId, user]);

  const handleCopyAll = useCallback(async () => {
    const text = messages.map((m) => {
      const label = m.role === 'user' ? 'You' : 'AI';
      return `${label}:\n${m.content}`;
    }).join('\n\n---\n\n');

    await navigator.clipboard.writeText(text);
    setToast('Copied to clipboard');
    setTimeout(() => setToast(null), 2500);
  }, [messages]);

  // --- Routing: extract last AI message content and route ---

  const handleRouteToRigging = useCallback(async () => {
    if (!user) return;
    // Get the last AI message's goals
    const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAiMsg) return;

    // Create a plan with the goals as milestones
    const { data: plan } = await supabase
      .from('rigging_plans')
      .insert({
        user_id: user.id,
        title: `Goals from ${bookTitles.join(', ')}`,
        description: lastAiMsg.content,
        planning_framework: 'milestone',
        status: 'active',
      })
      .select('id')
      .single();

    if (plan) {
      setToast('Goals sent to Rigging');
      onRouted?.('rigging', 1);
    }
    setTimeout(() => setToast(null), 3000);
  }, [user, messages, bookTitles, onRouted]);

  const handleRouteToLists = useCallback(async () => {
    if (!user) return;
    const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAiMsg) return;

    // Parse questions from the AI response — each numbered or bulleted item
    const lines = lastAiMsg.content.split('\n');
    const questions = lines
      .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter((l) => l.length > 10 && (l.endsWith('?') || l.length > 20));

    const audienceLabel = AUDIENCE_LABELS[audience];
    const listTitle = `${bookTitles[0]}${bookTitles.length > 1 ? ' & more' : ''} — ${audienceLabel} Discussion Questions`;

    const { data: list } = await supabase
      .from('lists')
      .insert({
        user_id: user.id,
        title: listTitle,
        list_type: 'todo',
      })
      .select('id')
      .single();

    if (list && questions.length > 0) {
      const items = questions.map((q, i) => ({
        user_id: user.id,
        list_id: list.id,
        text: q,
        sort_order: i,
      }));
      await supabase.from('list_items').insert(items);
      setToast(`${questions.length} questions saved to Lists`);
      onRouted?.('lists', questions.length);
    }
    setTimeout(() => setToast(null), 3000);
  }, [user, messages, bookTitles, audience, onRouted]);

  const handleRouteToCompass = useCallback(async () => {
    if (!user) return;
    const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAiMsg) return;

    // Parse tasks from the AI response
    const lines = lastAiMsg.content.split('\n');
    const tasks = lines
      .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter((l) => l.length > 5 && !l.startsWith('#'));

    // Limit to reasonable number
    const taskItems = tasks.slice(0, 10);
    const today = new Date().toISOString().split('T')[0];

    let created = 0;
    for (const text of taskItems) {
      const { error: taskErr } = await supabase
        .from('compass_tasks')
        .insert({
          user_id: user.id,
          title: text.substring(0, 200),
          due_date: today,
          source: 'manual',
        });
      if (!taskErr) created++;
    }

    if (created > 0) {
      setToast(`${created} tasks sent to Compass`);
      onRouted?.('compass', created);
    }
    setTimeout(() => setToast(null), 3000);
  }, [user, messages, onRouted]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  const TypeIcon = DISCUSSION_TYPE_ICONS[discussionType];
  const titleText = bookTitles.length === 1
    ? bookTitles[0]
    : `${bookTitles.length} Books`;

  return (
    <div className="book-discussion-backdrop" onClick={handleBackdropClick}>
      <div className="book-discussion-modal">
        {/* Header */}
        <div className="book-discussion-modal__header">
          <div className="book-discussion-modal__header-info">
            <h3 className="book-discussion-modal__title">{titleText}</h3>
            <span className="book-discussion-modal__type-badge">
              <TypeIcon size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
              {DISCUSSION_TYPE_LABELS[discussionType]}
            </span>
          </div>

          <select
            className="book-discussion-modal__audience-select"
            value={audience}
            onChange={(e) => handleAudienceChange(e.target.value as DiscussionAudience)}
          >
            {(Object.entries(AUDIENCE_LABELS) as Array<[DiscussionAudience, string]>).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {allDiscussions.length > 0 && (
            <div className="book-discussion-modal__history-wrapper" ref={historyRef}>
              <button
                type="button"
                className="book-discussion-modal__history-btn"
                onClick={() => setShowHistory((v) => !v)}
                title="Past discussions"
              >
                <Clock size={18} />
              </button>
              {showHistory && (
                <div className="book-discussion-modal__history-dropdown">
                  <div className="book-discussion-modal__history-header">Past Discussions</div>
                  <div className="book-discussion-modal__history-list">
                    {allDiscussions.map((disc) => {
                      const typeLabel = disc.discussion_type === 'discuss' ? 'Discussion'
                        : disc.discussion_type === 'generate_goals' ? 'Goals'
                        : disc.discussion_type === 'generate_questions' ? 'Questions'
                        : disc.discussion_type === 'generate_tasks' ? 'Tasks'
                        : 'Tracker';
                      const bookNames = itemTitleMap
                        ? disc.manifest_item_ids.map((id) => itemTitleMap[id] || 'Unknown').join(', ')
                        : null;
                      const isCurrent = disc.id === discussionId;
                      return (
                        <div
                          key={disc.id}
                          className={`book-discussion-modal__history-item${isCurrent ? ' book-discussion-modal__history-item--active' : ''}`}
                        >
                          <button
                            type="button"
                            className="book-discussion-modal__history-item-btn"
                            onClick={() => {
                              if (!isCurrent) {
                                if (onSwitchDiscussion) {
                                  onSwitchDiscussion(disc);
                                } else {
                                  // Built-in switch: load the discussion inline
                                  setDiscussionId(disc.id);
                                  setAudience(disc.audience);
                                  setStarted(true);
                                  loadExistingDiscussion(disc.id);
                                }
                                setShowHistory(false);
                              }
                            }}
                            disabled={isCurrent}
                          >
                            <span className="book-discussion-modal__history-item-type">{typeLabel}</span>
                            <span className="book-discussion-modal__history-item-title">
                              {disc.title || 'Untitled'}
                            </span>
                            {bookNames && (
                              <span className="book-discussion-modal__history-item-book">{bookNames}</span>
                            )}
                            <span className="book-discussion-modal__history-item-date">
                              {new Date(disc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              className="book-discussion-modal__history-item-delete"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (onDeleteDiscussion) {
                                  onDeleteDiscussion(disc.id);
                                } else if (user) {
                                  // Built-in delete
                                  await supabase.from('book_discussion_messages').delete().eq('discussion_id', disc.id);
                                  await supabase.from('book_discussions').delete().eq('id', disc.id).eq('user_id', user.id);
                                  setSelfFetchedDiscussions((prev) => prev.filter((d) => d.id !== disc.id));
                                }
                              }}
                              title="Delete discussion"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button type="button" className="book-discussion-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="book-discussion-modal__messages">
          {loading && (
            <div className="book-discussion-modal__empty">Loading conversation...</div>
          )}

          {!loading && !started && (
            <div className="book-discussion-modal__ready">
              <p className="book-discussion-modal__ready-text">
                Choose your audience, then begin.
              </p>
              <button
                type="button"
                className="book-discussion-modal__begin-btn"
                onClick={handleBegin}
              >
                Begin Discussion
              </button>
            </div>
          )}

          {!loading && started && messages.length === 0 && !sending && (
            <div className="book-discussion-modal__empty">Starting discussion...</div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`book-discussion-msg book-discussion-msg--${msg.role}`}
            >
              {msg.content}
            </div>
          ))}

          {sending && (
            <div className="book-discussion-typing">
              <div className="book-discussion-typing__dots">
                <div className="book-discussion-typing__dot" />
                <div className="book-discussion-typing__dot" />
                <div className="book-discussion-typing__dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="book-discussion-modal__scroll-anchor" />
        </div>

        {/* Error */}
        {error && (
          <div className="book-discussion-modal__error">{error}</div>
        )}

        {/* Input area */}
        <div className="book-discussion-modal__input-area">
          <div className="book-discussion-modal__input-row">
            <textarea
              ref={inputRef}
              className="book-discussion-modal__input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={sending || !discussionId}
            />
            <button
              type="button"
              className="book-discussion-modal__send-btn"
              onClick={handleSend}
              disabled={sending || !inputText.trim() || !discussionId}
            >
              <Send size={18} />
            </button>
          </div>

          <div className="book-discussion-modal__actions">
            <button
              type="button"
              className="book-discussion-modal__action-btn"
              onClick={handleCopyAll}
              disabled={messages.length === 0}
            >
              <Copy size={12} />
              Copy All
            </button>

            {/* Context-aware routing button */}
            {discussionType === 'generate_goals' && (
              <button
                type="button"
                className="book-discussion-modal__action-btn book-discussion-modal__action-btn--primary"
                onClick={handleRouteToRigging}
                disabled={messages.length < 2}
              >
                <Target size={12} />
                Send to Rigging
              </button>
            )}

            {discussionType === 'generate_questions' && (
              <button
                type="button"
                className="book-discussion-modal__action-btn book-discussion-modal__action-btn--primary"
                onClick={handleRouteToLists}
                disabled={messages.length < 2}
              >
                <HelpCircle size={12} />
                Send to Lists
              </button>
            )}

            {discussionType === 'generate_tasks' && (
              <button
                type="button"
                className="book-discussion-modal__action-btn book-discussion-modal__action-btn--primary"
                onClick={handleRouteToCompass}
                disabled={messages.length < 2}
              >
                <CheckSquare size={12} />
                Send to Compass
              </button>
            )}

            {discussionType === 'generate_tracker' && (
              <button
                type="button"
                className="book-discussion-modal__action-btn"
                disabled
                title="Coming soon"
              >
                <BarChart3 size={12} />
                Send to Charts (Coming Soon)
              </button>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="book-discussion-modal__toast">{toast}</div>
        )}
      </div>
    </div>
  );
}
