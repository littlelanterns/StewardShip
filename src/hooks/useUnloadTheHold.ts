import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { triggerHoldTriage } from '../lib/ai';
import type { HoldDump, TriageItem, HoldDumpStatus } from '../lib/types';

export function useUnloadTheHold() {
  const { user } = useAuthContext();
  const [holdDump, setHoldDump] = useState<HoldDump | null>(null);
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [sorting, setSorting] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a new hold_dumps record linked to a conversation
  const startDump = useCallback(async (conversationId: string): Promise<HoldDump | null> => {
    if (!user) return null;
    setError(null);
    try {
      const { data, error: createErr } = await supabase
        .from('hold_dumps')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          status: 'dumping' as HoldDumpStatus,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      const dump = data as HoldDump;
      setHoldDump(dump);
      return dump;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start dump';
      setError(msg);
      return null;
    }
  }, [user]);

  // Trigger AI triage — concatenate user messages and call Edge Function
  // Accepts dumpId directly to avoid stale closure on holdDump state
  const triggerTriage = useCallback(async (
    conversationId: string,
    dumpId?: string,
    context?: {
      mast_entries?: string;
      active_tasks?: string[];
      keel_categories?: string;
      people_names?: string[];
    },
  ): Promise<TriageItem[]> => {
    if (!user) return [];
    setSorting(true);
    setError(null);

    try {
      // Load user messages from conversation
      const { data: messages, error: msgErr } = await supabase
        .from('helm_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      // Concatenate user messages into a single text block
      const conversationText = (messages || [])
        .filter((m: { role: string }) => m.role === 'user')
        .map((m: { content: string }) => m.content)
        .join('\n\n');

      if (!conversationText.trim()) {
        throw new Error('No user messages found in conversation');
      }

      // Call Edge Function
      const items = await triggerHoldTriage(conversationText, user.id, context);

      setTriageItems(items);

      // Update hold_dumps record if we have a dump ID
      const resolvedDumpId = dumpId || holdDump?.id;
      if (resolvedDumpId) {
        await supabase
          .from('hold_dumps')
          .update({
            status: 'triaging' as HoldDumpStatus,
            items_extracted: items.length,
            triage_result: items,
          })
          .eq('id', resolvedDumpId)
          .eq('user_id', user.id);

        setHoldDump((prev) => prev ? {
          ...prev,
          status: 'triaging',
          items_extracted: items.length,
          triage_result: items,
        } : prev);
      }

      return items;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to process dump';
      setError(msg);
      return [];
    } finally {
      setSorting(false);
    }
  }, [user, holdDump?.id]);

  // Update a single triage item (change category, text, or metadata)
  const updateTriageItem = useCallback((itemId: string, updates: Partial<TriageItem>) => {
    setTriageItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }, []);

  // Mark a triage item as discard
  const discardTriageItem = useCallback((itemId: string) => {
    setTriageItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, category: 'discard' as const } : item,
      ),
    );
  }, []);

  // Route all confirmed items in batch
  const routeAll = useCallback(async (items: TriageItem[]): Promise<{
    tasksCreated: number;
    journalEntriesCreated: number;
    insightsCreated: number;
    principlesCreated: number;
    listItemsCreated: number;
    remindersStubbed: number;
    personNotesStubbed: number;
    discarded: number;
  }> => {
    if (!user || !holdDump) {
      return { tasksCreated: 0, journalEntriesCreated: 0, insightsCreated: 0, principlesCreated: 0, listItemsCreated: 0, remindersStubbed: 0, personNotesStubbed: 0, discarded: 0 };
    }

    setRouting(true);
    setError(null);

    const counts = {
      tasksCreated: 0,
      journalEntriesCreated: 0,
      insightsCreated: 0,
      principlesCreated: 0,
      listItemsCreated: 0,
      remindersStubbed: 0,
      personNotesStubbed: 0,
      discarded: 0,
    };

    try {
      for (const item of items) {
        switch (item.category) {
          case 'task': {
            const { error: taskErr } = await supabase
              .from('compass_tasks')
              .insert({
                user_id: user.id,
                title: item.text,
                status: 'pending',
                due_date: item.metadata.due_suggestion === 'today'
                  ? new Date().toISOString().split('T')[0]
                  : null,
                life_area_tag: item.metadata.life_area_tag || null,
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!taskErr) counts.tasksCreated++;
            break;
          }

          case 'journal': {
            const { error: logErr } = await supabase
              .from('log_entries')
              .insert({
                user_id: user.id,
                text: item.text,
                entry_type: item.metadata.entry_type || 'journal',
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!logErr) counts.journalEntriesCreated++;
            break;
          }

          case 'insight': {
            const { error: keelErr } = await supabase
              .from('keel_entries')
              .insert({
                user_id: user.id,
                text: item.text,
                category: item.metadata.keel_category || 'general',
                source: 'unload_the_hold',
                source_type: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!keelErr) counts.insightsCreated++;
            break;
          }

          case 'principle': {
            const { error: mastErr } = await supabase
              .from('mast_entries')
              .insert({
                user_id: user.id,
                text: item.text,
                type: item.metadata.mast_type || 'value',
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!mastErr) counts.principlesCreated++;
            break;
          }

          case 'list_item': {
            // For list items, we need a target list. If none suggested, create a log entry instead.
            // TODO: When Lists routing is more sophisticated, allow selecting a target list.
            const { error: listLogErr } = await supabase
              .from('log_entries')
              .insert({
                user_id: user.id,
                text: `[List item] ${item.text}${item.metadata.suggested_list ? ` (suggested list: ${item.metadata.suggested_list})` : ''}`,
                entry_type: 'quick_note',
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!listLogErr) counts.listItemsCreated++;
            break;
          }

          case 'person_note': {
            // STUB: Until Crew is built, save as Log entry
            const { error: pnErr } = await supabase
              .from('log_entries')
              .insert({
                user_id: user.id,
                text: `[Person note${item.metadata.person_name ? `: ${item.metadata.person_name}` : ''}] ${item.text}`,
                entry_type: 'quick_note',
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!pnErr) counts.personNotesStubbed++;
            break;
          }

          case 'reminder': {
            // STUB: Until Reminders is built, create as task with reminder note
            const { error: remErr } = await supabase
              .from('compass_tasks')
              .insert({
                user_id: user.id,
                title: item.text,
                description: item.metadata.reminder_text ? `Reminder: ${item.metadata.reminder_text}` : null,
                status: 'pending',
                source: 'unload_the_hold',
                source_reference_id: holdDump.id,
              });
            if (!remErr) counts.remindersStubbed++;
            break;
          }

          case 'discard':
            counts.discarded++;
            break;
        }
      }

      // Update hold_dumps record with final counts
      const totalRouted = counts.tasksCreated + counts.journalEntriesCreated +
        counts.insightsCreated + counts.principlesCreated + counts.listItemsCreated +
        counts.remindersStubbed + counts.personNotesStubbed;

      await supabase
        .from('hold_dumps')
        .update({
          status: 'routed' as HoldDumpStatus,
          items_routed: totalRouted,
          items_discarded: counts.discarded,
        })
        .eq('id', holdDump.id)
        .eq('user_id', user.id);

      setHoldDump((prev) => prev ? {
        ...prev,
        status: 'routed',
        items_routed: totalRouted,
        items_discarded: counts.discarded,
      } : prev);

      return counts;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to route items';
      setError(msg);
      return counts;
    } finally {
      setRouting(false);
    }
  }, [user, holdDump]);

  // Archive the raw dump text to Log as a brain_dump entry
  const archiveToLog = useCallback(async (conversationId: string): Promise<void> => {
    if (!user || !holdDump) return;
    setError(null);

    try {
      // Load user messages from conversation
      const { data: messages, error: msgErr } = await supabase
        .from('helm_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      const dumpText = (messages || [])
        .filter((m: { role: string }) => m.role === 'user')
        .map((m: { content: string }) => m.content)
        .join('\n\n');

      if (!dumpText.trim()) return;

      // Create log entry
      const { data: logEntry, error: logErr } = await supabase
        .from('log_entries')
        .insert({
          user_id: user.id,
          text: dumpText,
          entry_type: 'brain_dump',
          source: 'unload_the_hold',
          source_reference_id: holdDump.id,
        })
        .select('id')
        .single();

      if (logErr) throw logErr;

      // Link log entry back to hold_dump
      if (logEntry) {
        await supabase
          .from('hold_dumps')
          .update({ log_entry_id: logEntry.id })
          .eq('id', holdDump.id)
          .eq('user_id', user.id);

        setHoldDump((prev) => prev ? { ...prev, log_entry_id: logEntry.id } : prev);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to archive to Log';
      setError(msg);
    }
  }, [user, holdDump]);

  // Reset state for a new dump
  const reset = useCallback(() => {
    setHoldDump(null);
    setTriageItems([]);
    setSorting(false);
    setRouting(false);
    setError(null);
  }, []);

  return {
    holdDump,
    triageItems,
    sorting,
    routing,
    error,
    startDump,
    triggerTriage,
    updateTriageItem,
    discardTriageItem,
    routeAll,
    archiveToLog,
    reset,
  };
}
