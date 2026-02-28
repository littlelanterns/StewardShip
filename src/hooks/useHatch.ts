import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { autoTagTask, autoTitleHatchTab, triggerHatchExtraction } from '../lib/ai';
import type {
  HatchTab,
  HatchTabStatus,
  HatchSourceType,
  HatchRoutingDestination,
  HatchRoutingStat,
  HatchExtractedItem,
  HatchHistoryFilters,
  MastEntryType,
  KeelCategory,
} from '../lib/types';

export function useHatch() {
  const { user } = useAuthContext();
  const [tabs, setTabs] = useState<HatchTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routingStats, setRoutingStats] = useState<HatchRoutingStat[]>([]);

  // Debounce timers for autosave per tab
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const autoTitleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const titledTabs = useRef<Set<string>>(new Set()); // Track which tabs we've already auto-titled
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Clear all debounce timers on unmount
      Object.values(saveTimers.current).forEach(clearTimeout);
      Object.values(autoTitleTimers.current).forEach(clearTimeout);
    };
  }, []);

  // ─── Load active tabs ────────────────────────────────────
  const loadTabs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('hatch_tabs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (fetchErr) throw fetchErr;

      const fetchedTabs = (data || []) as HatchTab[];
      if (mountedRef.current) {
        setTabs(fetchedTabs);
        // Set active tab if none selected or current one no longer exists
        if (!activeTabId || !fetchedTabs.some((t) => t.id === activeTabId)) {
          setActiveTabId(fetchedTabs.length > 0 ? fetchedTabs[0].id : null);
        }
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load tabs');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user, activeTabId]);

  // ─── Load routing stats ──────────────────────────────────
  const loadRoutingStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('hatch_routing_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('route_count', { ascending: false });

      if (fetchErr) throw fetchErr;
      if (mountedRef.current) {
        setRoutingStats((data || []) as HatchRoutingStat[]);
      }
    } catch {
      // Non-critical — favorites just won't be sorted
    }
  }, [user]);

  // ─── Create a new tab ────────────────────────────────────
  const createTab = useCallback(
    async (
      sourceType: HatchSourceType = 'manual',
      content = '',
      sourceConversationId?: string,
    ): Promise<HatchTab | null> => {
      if (!user) return null;
      setError(null);
      try {
        const maxSort = tabs.length > 0 ? Math.max(...tabs.map((t) => t.sort_order)) : -1;

        const { data, error: insertErr } = await supabase
          .from('hatch_tabs')
          .insert({
            user_id: user.id,
            title: 'Untitled',
            content,
            status: 'active' as HatchTabStatus,
            source_type: sourceType,
            source_helm_conversation_id: sourceConversationId || null,
            sort_order: maxSort + 1,
            is_auto_named: true,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        const newTab = data as HatchTab;
        if (mountedRef.current) {
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
        return newTab;
      } catch (e: unknown) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to create tab');
        }
        return null;
      }
    },
    [user, tabs],
  );

  // ─── Update tab content (debounced autosave) ─────────────
  const updateTabContent = useCallback(
    (tabId: string, content: string) => {
      if (!user) return;

      // Update local state immediately
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, content } : t)),
      );

      // Debounce the database save (500ms per PRD)
      if (saveTimers.current[tabId]) {
        clearTimeout(saveTimers.current[tabId]);
      }

      saveTimers.current[tabId] = setTimeout(async () => {
        try {
          const { error: updateErr } = await supabase
            .from('hatch_tabs')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', tabId)
            .eq('user_id', user.id);

          if (updateErr) throw updateErr;
        } catch {
          // Autosave failure is silent per PRD — will retry on next change
        }

        // Auto-title: trigger once per tab when content has 30+ chars
        const tab = tabs.find((t) => t.id === tabId);
        if (
          tab &&
          tab.is_auto_named &&
          content.length >= 30 &&
          !titledTabs.current.has(tabId)
        ) {
          titledTabs.current.add(tabId);
          if (autoTitleTimers.current[tabId]) clearTimeout(autoTitleTimers.current[tabId]);
          autoTitleTimers.current[tabId] = setTimeout(async () => {
            const title = await autoTitleHatchTab(content, user.id);
            if (title && mountedRef.current) {
              await supabase
                .from('hatch_tabs')
                .update({ title })
                .eq('id', tabId)
                .eq('user_id', user.id);
              setTabs((prev) =>
                prev.map((t) => (t.id === tabId ? { ...t, title } : t)),
              );
            }
          }, 2000); // Wait 2s after save to avoid spamming
        }
      }, 500);
    },
    [user, tabs],
  );

  // ─── Update tab title ────────────────────────────────────
  const updateTabTitle = useCallback(
    async (tabId: string, title: string) => {
      if (!user) return;
      try {
        const { error: updateErr } = await supabase
          .from('hatch_tabs')
          .update({ title, is_auto_named: false })
          .eq('id', tabId)
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        if (mountedRef.current) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabId ? { ...t, title, is_auto_named: false } : t,
            ),
          );
        }
      } catch {
        // Title update failure is non-critical
      }
    },
    [user],
  );

  // ─── Close tab (archive) ─────────────────────────────────
  const closeTab = useCallback(
    async (tabId: string) => {
      if (!user) return;
      try {
        const { error: updateErr } = await supabase
          .from('hatch_tabs')
          .update({
            status: 'archived' as HatchTabStatus,
            archived_at: new Date().toISOString(),
          })
          .eq('id', tabId)
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        if (mountedRef.current) {
          setTabs((prev) => {
            const remaining = prev.filter((t) => t.id !== tabId);
            // Switch active tab if the closed one was active
            if (activeTabId === tabId && remaining.length > 0) {
              setActiveTabId(remaining[0].id);
            } else if (remaining.length === 0) {
              setActiveTabId(null);
            }
            return remaining;
          });
        }
      } catch (e: unknown) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to close tab');
        }
      }
    },
    [user, activeTabId],
  );

  // ─── Increment routing stats ─────────────────────────────
  const incrementRoutingStat = useCallback(
    async (destination: HatchRoutingDestination) => {
      if (!user) return;
      try {
        // Upsert: increment if exists, create if not
        const existing = routingStats.find((s) => s.destination === destination);
        if (existing) {
          await supabase
            .from('hatch_routing_stats')
            .update({
              route_count: existing.route_count + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .eq('user_id', user.id);
        } else {
          await supabase.from('hatch_routing_stats').insert({
            user_id: user.id,
            destination,
            route_count: 1,
            last_used_at: new Date().toISOString(),
          });
        }

        // Reload stats
        loadRoutingStats();
      } catch {
        // Stats are non-critical
      }
    },
    [user, routingStats, loadRoutingStats],
  );

  // ─── Route tab to destination ─────────────────────────────
  const routeTab = useCallback(
    async (
      tabId: string,
      destination: HatchRoutingDestination,
      options?: {
        mastType?: MastEntryType;
        keelCategory?: KeelCategory;
        meetingId?: string;
        listId?: string;
        trackerId?: string;
      },
    ): Promise<{ success: boolean; destinationId?: string }> => {
      if (!user) return { success: false };
      setError(null);

      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return { success: false };

      try {
        let destinationId: string | undefined;
        const content = tab.content;
        const firstLine = content.split('\n')[0];
        const title = firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine;

        switch (destination) {
          case 'journal': {
            const { data, error: err } = await supabase
              .from('journal_entries')
              .insert({
                user_id: user.id,
                text: content,
                entry_type: 'journal',
                source: 'hatch',
                source_reference_id: tabId,
                life_area_tags: [],
                routed_to: [],
                routed_reference_ids: {},
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'compass_single': {
            const today = new Date().toISOString().split('T')[0];
            const description = content.length > title.length ? content : null;
            const { data, error: err } = await supabase
              .from('compass_tasks')
              .insert({
                user_id: user.id,
                title,
                description,
                source: 'hatch',
                source_reference_id: tabId,
                due_date: today,
                status: 'pending',
                sort_order: 0,
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            // Auto-tag in background
            autoTagTask(title, description, user.id).then((tag) => {
              if (tag) {
                supabase
                  .from('compass_tasks')
                  .update({ life_area_tag: tag })
                  .eq('id', data.id)
                  .eq('user_id', user.id)
                  .then(() => {});
              }
            });
            break;
          }

          case 'compass_individual': {
            // Split content by lines, create a task per line
            const lines = content
              .split('\n')
              .map((l) => l.replace(/^[-*•]\s*/, '').trim())
              .filter((l) => l.length > 0);
            const today = new Date().toISOString().split('T')[0];

            for (let i = 0; i < lines.length; i++) {
              const lineTitle =
                lines[i].length > 100 ? lines[i].slice(0, 97) + '...' : lines[i];
              const { data, error: err } = await supabase
                .from('compass_tasks')
                .insert({
                  user_id: user.id,
                  title: lineTitle,
                  source: 'hatch',
                  source_reference_id: tabId,
                  due_date: today,
                  status: 'pending',
                  sort_order: i,
                })
                .select('id')
                .single();
              if (err) throw err;
              if (i === 0) destinationId = data.id;
              // Auto-tag each in background
              autoTagTask(lineTitle, null, user.id).then((tag) => {
                if (tag) {
                  supabase
                    .from('compass_tasks')
                    .update({ life_area_tag: tag })
                    .eq('id', data.id)
                    .eq('user_id', user.id)
                    .then(() => {});
                }
              });
            }
            break;
          }

          case 'lists': {
            if (options?.listId) {
              // Add to existing list
              const { data: existingItems } = await supabase
                .from('list_items')
                .select('sort_order')
                .eq('list_id', options.listId)
                .eq('user_id', user.id)
                .order('sort_order', { ascending: false })
                .limit(1);

              const maxSort =
                existingItems && existingItems.length > 0
                  ? existingItems[0].sort_order
                  : -1;

              const { data, error: err } = await supabase
                .from('list_items')
                .insert({
                  list_id: options.listId,
                  user_id: user.id,
                  text: content,
                  checked: false,
                  sort_order: maxSort + 1,
                })
                .select('id')
                .single();
              if (err) throw err;
              destinationId = data.id;
            } else {
              // Create a new list with items from content lines
              const { data: listData, error: listErr } = await supabase
                .from('lists')
                .insert({
                  user_id: user.id,
                  title: tab.title !== 'Untitled' ? tab.title : 'Hatch List',
                  sort_order: 0,
                })
                .select('id')
                .single();
              if (listErr) throw listErr;
              destinationId = listData.id;

              const lines = content
                .split('\n')
                .map((l) => l.replace(/^[-*•]\s*/, '').trim())
                .filter((l) => l.length > 0);

              for (let i = 0; i < lines.length; i++) {
                await supabase.from('list_items').insert({
                  list_id: listData.id,
                  user_id: user.id,
                  text: lines[i],
                  checked: false,
                  sort_order: i,
                });
              }
            }
            break;
          }

          case 'victory': {
            const { data, error: err } = await supabase
              .from('victories')
              .insert({
                user_id: user.id,
                description: content,
                source: 'hatch',
                source_reference_id: tabId,
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'keel': {
            const { data, error: err } = await supabase
              .from('keel_entries')
              .insert({
                user_id: user.id,
                category: options?.keelCategory || 'general',
                text: content,
                source: 'hatch',
                source_type: 'hatch',
                source_reference_id: tabId,
                sort_order: 0,
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'mast': {
            const { data, error: err } = await supabase
              .from('mast_entries')
              .insert({
                user_id: user.id,
                type: options?.mastType || 'value',
                text: content,
                source: 'hatch',
                source_reference_id: tabId,
                sort_order: 0,
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'note': {
            const { data, error: err } = await supabase
              .from('journal_entries')
              .insert({
                user_id: user.id,
                text: content,
                entry_type: 'quick_note',
                source: 'hatch',
                source_reference_id: tabId,
                life_area_tags: [],
                routed_to: [],
                routed_reference_ids: {},
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'agenda': {
            if (!options?.meetingId) {
              throw new Error('Meeting ID required for agenda routing');
            }
            const { data, error: err } = await supabase
              .from('meeting_agenda_items')
              .insert({
                user_id: user.id,
                discussed_in_meeting_id: options.meetingId,
                text: content,
                source_hatch_tab_id: tabId,
                sort_order: 0,
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationId = data.id;
            break;
          }

          case 'charts': {
            // Charts routing — create a tracker data point
            // This is a stub; tracker picker provides trackerId
            if (options?.trackerId) {
              const { data, error: err } = await supabase
                .from('goal_entries')
                .insert({
                  user_id: user.id,
                  goal_id: options.trackerId,
                  value: content,
                  note: `Routed from The Hatch: ${tab.title}`,
                })
                .select('id')
                .single();
              if (err) throw err;
              destinationId = data.id;
            }
            break;
          }
        }

        // Mark tab as routed
        const { error: routeErr } = await supabase
          .from('hatch_tabs')
          .update({
            status: 'routed' as HatchTabStatus,
            routed_to: destination,
            routed_destination_id: destinationId || null,
            routed_meeting_id: options?.meetingId || null,
            routed_at: new Date().toISOString(),
          })
          .eq('id', tabId)
          .eq('user_id', user.id);

        if (routeErr) throw routeErr;

        // Update local state — remove tab from active list
        if (mountedRef.current) {
          setTabs((prev) => {
            const remaining = prev.filter((t) => t.id !== tabId);
            if (activeTabId === tabId && remaining.length > 0) {
              setActiveTabId(remaining[0].id);
            } else if (remaining.length === 0) {
              setActiveTabId(null);
            }
            return remaining;
          });
        }

        // Increment routing stats
        incrementRoutingStat(destination);

        return { success: true, destinationId };
      } catch (e: unknown) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to route');
        }
        return { success: false };
      }
    },
    [user, tabs, activeTabId, incrementRoutingStat],
  );

  // ─── Undo a route ─────────────────────────────────────────
  const undoRoute = useCallback(
    async (tabId: string, destination: HatchRoutingDestination, destinationId?: string) => {
      if (!user) return;
      try {
        // Delete the destination record if we have an ID
        if (destinationId) {
          const tableMap: Partial<Record<HatchRoutingDestination, string>> = {
            journal: 'journal_entries',
            compass_single: 'compass_tasks',
            compass_individual: 'compass_tasks',
            victory: 'victories',
            keel: 'keel_entries',
            mast: 'mast_entries',
            note: 'journal_entries',
            agenda: 'meeting_agenda_items',
            charts: 'goal_entries',
          };
          const table = tableMap[destination];
          if (table) {
            await supabase
              .from(table)
              .delete()
              .eq('id', destinationId)
              .eq('user_id', user.id);
          }
        }

        // Restore tab to active
        const { error: updateErr } = await supabase
          .from('hatch_tabs')
          .update({
            status: 'active' as HatchTabStatus,
            routed_to: null,
            routed_destination_id: null,
            routed_meeting_id: null,
            routed_at: null,
          })
          .eq('id', tabId)
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        // Reload tabs to restore the undone tab
        loadTabs();
      } catch (e: unknown) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to undo route');
        }
      }
    },
    [user, loadTabs],
  );

  // ─── Reorder tabs ─────────────────────────────────────────
  const reorderTabs = useCallback(
    async (tabIds: string[]) => {
      if (!user) return;
      try {
        for (let i = 0; i < tabIds.length; i++) {
          await supabase
            .from('hatch_tabs')
            .update({ sort_order: i })
            .eq('id', tabIds[i])
            .eq('user_id', user.id);
        }
        // Update local order
        setTabs((prev) => {
          const tabMap = new Map(prev.map((t) => [t.id, t]));
          return tabIds
            .map((id, i) => {
              const tab = tabMap.get(id);
              return tab ? { ...tab, sort_order: i } : null;
            })
            .filter((t): t is HatchTab => t !== null);
        });
      } catch {
        // Reorder failure is non-critical
      }
    },
    [user],
  );

  // ---- Phase B: Review & Route extraction ----

  const extractItems = useCallback(
    async (tabId: string): Promise<HatchExtractedItem[]> => {
      if (!user) return [];
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || !tab.content.trim()) return [];

      // Gather user context for smarter extraction
      let trackerNames: string[] = [];
      let meetingNames: string[] = [];
      let mastDeclarations: string[] = [];

      try {
        const [trackersRes, meetingsRes, mastRes] = await Promise.all([
          supabase
            .from('custom_trackers')
            .select('name')
            .eq('user_id', user.id)
            .is('archived_at', null),
          supabase
            .from('meeting_schedules')
            .select('meeting_type, custom_title')
            .eq('user_id', user.id)
            .eq('is_active', true),
          supabase
            .from('mast_entries')
            .select('text')
            .eq('user_id', user.id)
            .is('archived_at', null)
            .limit(10),
        ]);
        trackerNames = (trackersRes.data || []).map((t) => t.name);
        meetingNames = (meetingsRes.data || []).map(
          (m) => m.custom_title || m.meeting_type,
        );
        mastDeclarations = (mastRes.data || []).map((m) => m.text);
      } catch {
        // Context fetch failure is non-critical
      }

      const rawItems = await triggerHatchExtraction(tab.content, user.id, {
        tracker_names: trackerNames,
        meeting_names: meetingNames,
        mast_declarations: mastDeclarations,
      });

      // Save extracted items to database
      const itemsToInsert = rawItems.map((item) => ({
        user_id: user.id,
        hatch_tab_id: tabId,
        extracted_text: item.extracted_text,
        item_type: item.item_type,
        suggested_destination: item.suggested_destination,
        confidence: item.confidence,
        status: 'pending' as const,
      }));

      const { data, error: insertErr } = await supabase
        .from('hatch_extracted_items')
        .insert(itemsToInsert)
        .select();

      if (insertErr) throw insertErr;
      return (data as HatchExtractedItem[]) || [];
    },
    [user, tabs],
  );

  const routeExtractedItem = useCallback(
    async (
      itemId: string,
      destination: HatchRoutingDestination,
      options?: { meetingId?: string; mastType?: MastEntryType; keelCategory?: KeelCategory; listId?: string; trackerId?: string },
    ) => {
      if (!user) return;

      // Get the extracted item
      const { data: item, error: fetchErr } = await supabase
        .from('hatch_extracted_items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !item) throw fetchErr || new Error('Item not found');

      // Use the existing routeTab logic by creating a temporary approach
      // Route the content directly using the same destination logic
      const content = item.extracted_text;
      let destinationRecordId: string | null = null;

      // Simplified routing for extracted items (mirrors routeTab logic)
      switch (destination) {
        case 'journal': {
          const { data, error: err } = await supabase
            .from('journal_entries')
            .insert({
              user_id: user.id,
              text: content,
              entry_type: 'journal',
              source: 'hatch',
              source_reference_id: item.hatch_tab_id,
              life_area_tags: [],
              routed_to: [],
              routed_reference_ids: {},
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        case 'compass_single': {
          const { data, error: err } = await supabase
            .from('compass_tasks')
            .insert({
              user_id: user.id,
              title: content.length > 100 ? content.slice(0, 97) + '...' : content,
              description: content.length > 100 ? content : null,
              source: 'hatch',
              source_reference_id: item.hatch_tab_id,
              due_date: new Date().toISOString().split('T')[0],
              status: 'pending',
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          autoTagTask(content, null, user.id).then((tag) => {
            if (tag && data?.id) {
              supabase.from('compass_tasks').update({ life_area_tag: tag }).eq('id', data.id).eq('user_id', user.id).then(() => {});
            }
          });
          break;
        }
        case 'victory': {
          const { data, error: err } = await supabase
            .from('victories')
            .insert({
              user_id: user.id,
              title: content.length > 100 ? content.slice(0, 97) + '...' : content,
              description: content,
              source: 'hatch',
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        case 'keel': {
          const { data, error: err } = await supabase
            .from('keel_entries')
            .insert({
              user_id: user.id,
              category: options?.keelCategory || 'general',
              text: content,
              source_type: 'manual',
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        case 'mast': {
          const { data, error: err } = await supabase
            .from('mast_entries')
            .insert({
              user_id: user.id,
              type: options?.mastType || 'declaration',
              text: content,
              source: 'manual',
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        case 'note': {
          const { data, error: err } = await supabase
            .from('journal_entries')
            .insert({
              user_id: user.id,
              text: content,
              entry_type: 'quick_note',
              source: 'hatch',
              source_reference_id: item.hatch_tab_id,
              life_area_tags: [],
              routed_to: [],
              routed_reference_ids: {},
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        case 'agenda': {
          if (!options?.meetingId) break;
          const { data, error: err } = await supabase
            .from('meeting_agenda_items')
            .insert({
              user_id: user.id,
              meeting_id: options.meetingId,
              text: content,
              source_hatch_tab_id: item.hatch_tab_id,
            })
            .select('id')
            .single();
          if (err) throw err;
          destinationRecordId = data.id;
          break;
        }
        default:
          // For compass_individual, lists, charts — route as single item
          if (destination === 'compass_individual') {
            const { data, error: err } = await supabase
              .from('compass_tasks')
              .insert({
                user_id: user.id,
                title: content.length > 100 ? content.slice(0, 97) + '...' : content,
                source: 'hatch',
                source_reference_id: item.hatch_tab_id,
                due_date: new Date().toISOString().split('T')[0],
                status: 'pending',
              })
              .select('id')
              .single();
            if (err) throw err;
            destinationRecordId = data.id;
          }
          break;
      }

      // Update extracted item status
      await supabase
        .from('hatch_extracted_items')
        .update({
          status: 'routed',
          actual_destination: destination,
          destination_record_id: destinationRecordId,
        })
        .eq('id', itemId)
        .eq('user_id', user.id);
    },
    [user],
  );

  const skipExtractedItem = useCallback(
    async (itemId: string) => {
      if (!user) return;
      await supabase
        .from('hatch_extracted_items')
        .update({ status: 'skipped' })
        .eq('id', itemId)
        .eq('user_id', user.id);
    },
    [user],
  );

  const updateExtractedItemText = useCallback(
    async (itemId: string, newText: string) => {
      if (!user) return;
      await supabase
        .from('hatch_extracted_items')
        .update({ extracted_text: newText })
        .eq('id', itemId)
        .eq('user_id', user.id);
    },
    [user],
  );

  // ---- Phase B: History ----

  const getHistory = useCallback(
    async (filters?: HatchHistoryFilters): Promise<HatchTab[]> => {
      if (!user) return [];

      let query = supabase
        .from('hatch_tabs')
        .select('*')
        .eq('user_id', user.id);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.destination) {
        query = query.eq('routed_to', filters.destination);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.searchQuery) {
        query = query.ilike('content', `%${filters.searchQuery}%`);
      }

      const sortBy = filters?.sortBy || 'updated_at';
      const sortOrder = filters?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error: fetchErr } = await query.limit(100);
      if (fetchErr) throw fetchErr;
      return (data as HatchTab[]) || [];
    },
    [user],
  );

  const reopenTab = useCallback(
    async (tabId: string): Promise<HatchTab | null> => {
      if (!user) return null;

      // Get the archived tab
      const { data: oldTab, error: fetchErr } = await supabase
        .from('hatch_tabs')
        .select('*')
        .eq('id', tabId)
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !oldTab) return null;

      // Create a new active tab with the same content
      const { data: newTab, error: insertErr } = await supabase
        .from('hatch_tabs')
        .insert({
          user_id: user.id,
          title: oldTab.title,
          content: oldTab.content,
          status: 'active',
          source_type: oldTab.source_type,
          sort_order: tabs.length,
        })
        .select()
        .single();

      if (insertErr || !newTab) return null;

      setTabs((prev) => [...prev, newTab as HatchTab]);
      setActiveTabId(newTab.id);
      return newTab as HatchTab;
    },
    [user, tabs.length],
  );

  const deleteHistoryItem = useCallback(
    async (tabId: string) => {
      if (!user) return;
      // Delete extracted items first (FK constraint)
      await supabase
        .from('hatch_extracted_items')
        .delete()
        .eq('hatch_tab_id', tabId)
        .eq('user_id', user.id);

      await supabase
        .from('hatch_tabs')
        .delete()
        .eq('id', tabId)
        .eq('user_id', user.id);
    },
    [user],
  );

  return {
    // State
    tabs,
    activeTabId,
    setActiveTabId,
    loading,
    error,
    routingStats,

    // Phase A Actions
    loadTabs,
    loadRoutingStats,
    createTab,
    updateTabContent,
    updateTabTitle,
    closeTab,
    routeTab,
    undoRoute,
    reorderTabs,

    // Phase B Actions
    extractItems,
    routeExtractedItem,
    skipExtractedItem,
    updateExtractedItemText,
    getHistory,
    reopenTab,
    deleteHistoryItem,
  };
}
