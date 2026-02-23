import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { HelmConversation, HelmMessage } from '../lib/types';

const HISTORY_PAGE_SIZE = 20;

export function useHelmData() {
  const { user } = useAuthContext();
  const [conversations, setConversations] = useState<HelmConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<HelmConversation | null>(null);
  const [messages, setMessages] = useState<HelmMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the user's active conversation + its messages
  const loadActiveConversation = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: convData, error: convErr } = await supabase
        .from('helm_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convErr) throw convErr;

      if (convData) {
        setActiveConversation(convData as HelmConversation);
        const { data: msgData, error: msgErr } = await supabase
          .from('helm_messages')
          .select('*')
          .eq('conversation_id', convData.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (msgErr) throw msgErr;
        setMessages((msgData as HelmMessage[]) || []);
      } else {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load conversation';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load a specific conversation by ID
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: convData, error: convErr } = await supabase
        .from('helm_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convErr) throw convErr;

      setActiveConversation(convData as HelmConversation);

      const { data: msgData, error: msgErr } = await supabase
        .from('helm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;
      setMessages((msgData as HelmMessage[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load conversation';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new conversation (deactivate any current active one first)
  const createConversation = useCallback(async (): Promise<HelmConversation | null> => {
    if (!user) return null;
    setError(null);
    try {
      // Deactivate any currently active conversations
      const { error: deactivateErr } = await supabase
        .from('helm_conversations')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (deactivateErr) throw deactivateErr;

      // Create new conversation
      const { data, error: createErr } = await supabase
        .from('helm_conversations')
        .insert({
          user_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      const conv = data as HelmConversation;
      setActiveConversation(conv);
      setMessages([]);
      return conv;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create conversation';
      setError(msg);
      return null;
    }
  }, [user]);

  // Send a message (create user message record)
  const addMessage = useCallback(async (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    pageContext?: string,
  ): Promise<HelmMessage | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: insertErr } = await supabase
        .from('helm_messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role,
          content,
          page_context: pageContext || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const message = data as HelmMessage;
      setMessages((prev) => [...prev, message]);
      return message;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send message';
      setError(msg);
      return null;
    }
  }, [user]);

  // Load conversation history (paginated, newest first)
  const loadHistory = useCallback(async (offset = 0) => {
    if (!user) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const { data, error: histErr } = await supabase
        .from('helm_conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + HISTORY_PAGE_SIZE - 1);

      if (histErr) throw histErr;

      const convs = (data as HelmConversation[]) || [];
      if (offset === 0) {
        setConversations(convs);
      } else {
        setConversations((prev) => [...prev, ...convs]);
      }
      setHasMoreHistory(convs.length === HISTORY_PAGE_SIZE);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load history';
      setError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  // Deactivate (close) a conversation
  const deactivateConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('helm_conversations')
        .update({ is_active: false })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (err) throw err;

      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to deactivate conversation';
      setError(msg);
    }
  }, [user, activeConversation]);

  // Archive a conversation
  const archiveConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('helm_conversations')
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (err) throw err;

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to archive conversation';
      setError(msg);
    }
  }, [user, activeConversation]);

  // Update an existing message's content (for regenerate/shorter/longer)
  const updateMessage = useCallback(async (
    messageId: string,
    content: string,
  ): Promise<HelmMessage | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: updateErr } = await supabase
        .from('helm_messages')
        .update({ content })
        .eq('id', messageId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const updated = data as HelmMessage;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? updated : m)),
      );
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update message';
      setError(msg);
      return null;
    }
  }, [user]);

  // Hard delete a conversation and all its messages
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    try {
      // Delete messages first (child records)
      const { error: msgErr } = await supabase
        .from('helm_messages')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (msgErr) throw msgErr;

      // Delete the conversation record
      const { error: convErr } = await supabase
        .from('helm_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (convErr) throw convErr;

      // Update local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete conversation';
      setError(msg);
    }
  }, [user, activeConversation]);

  // Update conversation title
  const updateTitle = useCallback(async (conversationId: string, title: string) => {
    if (!user) return;
    try {
      const { error: err } = await supabase
        .from('helm_conversations')
        .update({ title })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (err) throw err;

      setActiveConversation((prev) =>
        prev?.id === conversationId ? { ...prev, title } : prev,
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c)),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update title';
      setError(msg);
    }
  }, [user]);

  return {
    activeConversation,
    messages,
    conversations,
    loading,
    historyLoading,
    hasMoreHistory,
    error,
    loadActiveConversation,
    loadConversation,
    createConversation,
    addMessage,
    updateMessage,
    loadHistory,
    deactivateConversation,
    archiveConversation,
    deleteConversation,
    updateTitle,
  };
}
