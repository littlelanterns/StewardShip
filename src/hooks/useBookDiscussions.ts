import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type {
  BookDiscussion,
  BookDiscussionMessage,
  DiscussionType,
  DiscussionAudience,
} from '../lib/types';

export function useBookDiscussions() {
  const { user } = useAuthContext();
  const [discussions, setDiscussions] = useState<BookDiscussion[]>([]);
  const [activeDiscussion, setActiveDiscussion] = useState<BookDiscussion | null>(null);
  const [messages, setMessages] = useState<BookDiscussionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch all discussions ---

  const fetchDiscussions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('book_discussions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }
      setDiscussions(data || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // --- Start a new discussion ---

  const startDiscussion = useCallback(async (
    manifestItemIds: string[],
    discussionType: DiscussionType,
    audience: DiscussionAudience,
  ): Promise<BookDiscussion | null> => {
    if (!user) return null;
    setSending(true);
    setError(null);

    try {
      // Create the discussion record
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
        return null;
      }

      setActiveDiscussion(discussion);
      setMessages([]);

      // Send initial message to trigger AI opening
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
        const msg = aiErr?.message || aiResponse?.error || 'AI response failed';
        setError(msg);
        // Still return the discussion — user can retry
        return discussion;
      }

      const aiContent = aiResponse?.content || '';
      if (aiContent) {
        // Save AI opening message
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

        // Auto-generate title from the opening
        const titleSnippet = aiContent.substring(0, 80).replace(/\n/g, ' ').trim();
        const autoTitle = titleSnippet.length >= 80
          ? titleSnippet.substring(0, 77) + '...'
          : titleSnippet;

        await supabase
          .from('book_discussions')
          .update({ title: autoTitle })
          .eq('id', discussion.id);

        discussion.title = autoTitle;
        setActiveDiscussion({ ...discussion, title: autoTitle });
      }

      return discussion;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setSending(false);
    }
  }, [user]);

  // --- Send a message in an active discussion ---

  const sendMessage = useCallback(async (
    discussionId: string,
    content: string,
  ): Promise<BookDiscussionMessage | null> => {
    if (!user || !content.trim()) return null;
    setSending(true);
    setError(null);

    try {
      // Save user message
      const { data: userMsg, error: userErr } = await supabase
        .from('book_discussion_messages')
        .insert({
          user_id: user.id,
          discussion_id: discussionId,
          role: 'user',
          content: content.trim(),
        })
        .select('*')
        .single();

      if (userErr || !userMsg) {
        setError(userErr?.message || 'Failed to save message');
        return null;
      }

      // Add user message to local state immediately
      setMessages((prev) => [...prev, userMsg]);

      // Get discussion details for the AI call
      const discussion = activeDiscussion?.id === discussionId
        ? activeDiscussion
        : discussions.find((d) => d.id === discussionId);

      if (!discussion) {
        setError('Discussion not found');
        return userMsg;
      }

      // Build conversation history from current messages + new user message
      const currentMessages = [...messages, userMsg];
      const conversationHistory = currentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call AI
      const { data: aiResponse, error: aiErr } = await supabase.functions.invoke('manifest-discuss', {
        body: {
          manifest_item_ids: discussion.manifest_item_ids,
          discussion_type: discussion.discussion_type,
          audience: discussion.audience,
          message: content.trim(),
          conversation_history: conversationHistory.slice(0, -1), // History is everything except the current message
        },
      });

      if (aiErr || aiResponse?.error) {
        setError(aiErr?.message || aiResponse?.error || 'AI response failed');
        return userMsg;
      }

      const aiContent = aiResponse?.content || '';
      if (aiContent) {
        // Save AI response
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

      return userMsg;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setSending(false);
    }
  }, [user, activeDiscussion, discussions, messages]);

  // --- Continue an existing discussion ---

  const continueDiscussion = useCallback(async (
    discussionId: string,
  ): Promise<BookDiscussion | null> => {
    if (!user) return null;
    setLoading(true);
    setError(null);

    try {
      // Load the discussion
      const { data: discussion, error: discErr } = await supabase
        .from('book_discussions')
        .select('*')
        .eq('id', discussionId)
        .eq('user_id', user.id)
        .single();

      if (discErr || !discussion) {
        setError(discErr?.message || 'Discussion not found');
        return null;
      }

      // Load all messages
      const { data: msgs, error: msgsErr } = await supabase
        .from('book_discussion_messages')
        .select('*')
        .eq('discussion_id', discussionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (msgsErr) {
        setError(msgsErr.message);
        return null;
      }

      setActiveDiscussion(discussion);
      setMessages(msgs || []);
      return discussion;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // --- Update audience mid-conversation ---

  const updateAudience = useCallback(async (
    discussionId: string,
    audience: DiscussionAudience,
  ) => {
    if (!user) return;
    const { error: updateErr } = await supabase
      .from('book_discussions')
      .update({ audience })
      .eq('id', discussionId)
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setActiveDiscussion((prev) => prev ? { ...prev, audience } : null);
    setDiscussions((prev) =>
      prev.map((d) => d.id === discussionId ? { ...d, audience } : d),
    );
  }, [user]);

  // --- Copy conversation to clipboard ---

  const copyToClipboard = useCallback(async (discussionId: string) => {
    const msgs = activeDiscussion?.id === discussionId
      ? messages
      : null;

    let toFormat = msgs;
    if (!toFormat) {
      const { data } = await supabase
        .from('book_discussion_messages')
        .select('*')
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true });
      toFormat = data || [];
    }

    const text = toFormat.map((m) => {
      const label = m.role === 'user' ? 'You' : 'AI';
      return `${label}:\n${m.content}`;
    }).join('\n\n---\n\n');

    await navigator.clipboard.writeText(text);
  }, [activeDiscussion, messages]);

  // --- Delete a discussion ---

  const deleteDiscussion = useCallback(async (discussionId: string) => {
    if (!user) return;

    // Delete messages first
    await supabase
      .from('book_discussion_messages')
      .delete()
      .eq('discussion_id', discussionId)
      .eq('user_id', user.id);

    // Delete discussion
    await supabase
      .from('book_discussions')
      .delete()
      .eq('id', discussionId)
      .eq('user_id', user.id);

    setDiscussions((prev) => prev.filter((d) => d.id !== discussionId));

    if (activeDiscussion?.id === discussionId) {
      setActiveDiscussion(null);
      setMessages([]);
    }
  }, [user, activeDiscussion]);

  // --- Close active discussion (clear local state) ---

  const closeDiscussion = useCallback(() => {
    setActiveDiscussion(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    // State
    discussions,
    activeDiscussion,
    messages,
    loading,
    sending,
    error,
    // Methods
    fetchDiscussions,
    startDiscussion,
    sendMessage,
    continueDiscussion,
    updateAudience,
    copyToClipboard,
    deleteDiscussion,
    closeDiscussion,
  };
}
