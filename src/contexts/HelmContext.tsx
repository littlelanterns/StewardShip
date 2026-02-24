import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useHelmData } from '../hooks/useHelmData';
import { useAuthContext } from './AuthContext';
import { sendChatMessage, autoTitleConversation } from '../lib/ai';
import { loadContext } from '../lib/contextLoader';
import { buildSystemPrompt } from '../lib/systemPrompt';
import type { HelmPageContext, HelmConversation, HelmMessage, GuidedMode, GuidedSubtype } from '../lib/types';

export type { HelmPageContext };

type DrawerState = 'closed' | 'peek' | 'full';

/**
 * Window conversation history to prevent unbounded context growth.
 * After SUMMARY_THRESHOLD messages, condense the middle into a summary,
 * keeping the first 2 (topic establishment) and last WINDOW_SIZE verbatim.
 */
function windowConversationHistory(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const WINDOW_SIZE = 6;
  const SUMMARY_THRESHOLD = 8;

  if (messages.length <= SUMMARY_THRESHOLD) {
    return messages;
  }

  const opening = messages.slice(0, 2);
  const recent = messages.slice(-WINDOW_SIZE);
  const middle = messages.slice(2, -WINDOW_SIZE);

  const summaryText = middle
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.substring(0, 150)}`)
    .join('\n');

  const summaryMessage = {
    role: 'system' as const,
    content: `[Earlier in this conversation — condensed summary]\n${summaryText}\n[End of summary — recent messages follow]`,
  };

  return [...opening, summaryMessage, ...recent];
}

function getGuidedModeOpeningMessage(mode: GuidedMode): string | null {
  switch (mode) {
    case 'unload_the_hold':
      return "Let's get it all out. Tell me everything that's on your mind — tasks, worries, ideas, things you need to remember. Don't worry about organizing it. I'll sort through it when you're ready.";
    case 'wheel':
      return "Let's build a Change Wheel. This is for the big stuff — deep character changes, identity shifts, the patterns that have been running for years. Not habits or tasks, but who you are becoming.\n\nWhat's the change you want to make? Tell me about it in your own words, and we'll shape it into the Hub of your Wheel.";
    case 'life_inventory':
      return "Let's take a look at where you are across the different areas of your life. I'll walk through some areas with you — spiritual, marriage, family, health, career, and others — and you tell me what feels true right now.\n\nWe can skip anything, go deep on what matters, and add areas I don't cover. There are no scales or scores here. Just honest reflection.\n\nWhere would you like to start?";
    case 'rigging':
      return "Let's put together a plan. Tell me about what you're working toward — a goal, a project, something you want to accomplish. I'll help you think through it and build a plan you can actually follow.\n\nWhat are you planning?";
    case 'safe_harbor':
      return "I'm here. What's going on?";
    case 'manifest_discuss':
      return null; // Opening message varies — set by caller based on specific item vs library
    default:
      return null;
  }
}

interface HelmContextValue {
  // Drawer state
  drawerState: DrawerState;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  expandDrawer: () => void;
  setDrawerState: (state: DrawerState) => void;

  // Page context
  pageContext: HelmPageContext;
  setPageContext: (ctx: HelmPageContext) => void;

  // Conversation state
  activeConversation: HelmConversation | null;
  messages: HelmMessage[];
  conversations: HelmConversation[];
  loading: boolean;
  historyLoading: boolean;
  hasMoreHistory: boolean;
  isThinking: boolean;
  error: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => Promise<void>;
  startGuidedConversation: (mode: GuidedMode, subtype?: GuidedSubtype, refId?: string) => Promise<HelmConversation | null>;
  switchConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  loadHistory: (offset?: number) => Promise<void>;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  regenerateMessage: (message: HelmMessage) => Promise<void>;
  resendShorter: (message: HelmMessage) => Promise<void>;
  resendLonger: (message: HelmMessage) => Promise<void>;
}

const HelmContext = createContext<HelmContextValue | null>(null);

export function HelmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [drawerState, setDrawerState] = useState<DrawerState>('closed');
  const [pageContext, setPageContext] = useState<HelmPageContext>({ page: 'crowsnest' });
  const [showHistory, setShowHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const helmData = useHelmData();

  // Load active conversation on mount (when user is available)
  useEffect(() => {
    if (user) {
      helmData.loadActiveConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openDrawer = useCallback(() => setDrawerState('peek'), []);
  const closeDrawer = useCallback(() => setDrawerState('closed'), []);
  const toggleDrawer = useCallback(
    () => setDrawerState((s) => (s === 'closed' ? 'peek' : 'closed')),
    [],
  );
  const expandDrawer = useCallback(() => setDrawerState('full'), []);

  // Core AI call logic — shared by sendMessage, regenerate, shorter, longer
  const callAI = useCallback(async (
    _conversationId: string,
    messagesForContext: HelmMessage[],
    extraInstruction?: string,
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const lastUserMessage = [...messagesForContext]
      .reverse()
      .find((m) => m.role === 'user');
    const messageText = lastUserMessage?.content || '';

    // Build guided mode context for Manifest discuss mode
    const activeConvo = helmData.activeConversation;
    let gmContext: { manifest_item_id?: string; manifest_item_title?: string } | undefined;
    if (activeConvo?.guided_mode === 'manifest_discuss' && activeConvo.guided_mode_reference_id) {
      gmContext = {
        manifest_item_id: activeConvo.guided_mode_reference_id,
        manifest_item_title: activeConvo.title || undefined,
      };
    }

    const context = await loadContext({
      message: messageText,
      pageContext: pageContext.page,
      userId: user.id,
      guidedMode: activeConvo?.guided_mode,
      guidedModeContext: gmContext,
      conversationHistory: messagesForContext,
    });

    const systemPrompt = buildSystemPrompt(context);

    // Build messages array for the API call, with windowing for long conversations
    const allMessages = messagesForContext
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const apiMessages = windowConversationHistory(allMessages);

    if (extraInstruction) {
      apiMessages.push({ role: 'user', content: extraInstruction });
    }

    const guidedMode = helmData.activeConversation?.guided_mode;
    return await sendChatMessage(systemPrompt, apiMessages, 0, user.id, guidedMode);
  }, [user, pageContext.page, helmData.activeConversation?.guided_mode, helmData.activeConversation?.guided_mode_reference_id, helmData.activeConversation?.title]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user) return;

    let conversation = helmData.activeConversation;

    // Create a conversation if none exists
    if (!conversation) {
      conversation = await helmData.createConversation();
      if (!conversation) return;
    }

    // Add user message
    const userMsg = await helmData.addMessage(
      conversation.id,
      'user',
      content.trim(),
      pageContext.page,
    );

    if (!userMsg) return;

    // Call AI
    setIsThinking(true);
    try {
      const currentMessages = [...helmData.messages, userMsg];
      const aiResponse = await callAI(conversation.id, currentMessages);

      await helmData.addMessage(
        conversation.id,
        'assistant',
        aiResponse,
        pageContext.page,
      );

      // Auto-title in background after first AI response
      if (!conversation.title) {
        autoTitleConversation(content.trim(), user.id).then((title) => {
          if (title) {
            helmData.updateTitle(conversation!.id, title);
          }
        });
      }
    } catch {
      // Show error as a system-style message
      await helmData.addMessage(
        conversation.id,
        'assistant',
        'Unable to get a response right now. Your message has been saved.',
        pageContext.page,
      );
    } finally {
      setIsThinking(false);
    }
  }, [helmData, pageContext.page, user, callAI]);

  const regenerateMessage = useCallback(async (message: HelmMessage) => {
    if (!user || !helmData.activeConversation) return;

    // Get messages up to (but not including) the message being regenerated
    const messageIndex = helmData.messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return;
    const messagesUpTo = helmData.messages.slice(0, messageIndex);

    setIsThinking(true);
    try {
      const aiResponse = await callAI(helmData.activeConversation.id, messagesUpTo);
      await helmData.updateMessage(message.id, aiResponse);
    } catch {
      // Keep original on failure
    } finally {
      setIsThinking(false);
    }
  }, [user, helmData, callAI]);

  const resendShorter = useCallback(async (message: HelmMessage) => {
    if (!user || !helmData.activeConversation) return;

    const messageIndex = helmData.messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return;
    const messagesUpTo = helmData.messages.slice(0, messageIndex);

    setIsThinking(true);
    try {
      const aiResponse = await callAI(
        helmData.activeConversation.id,
        messagesUpTo,
        'Please give a shorter, more concise response to my last message.',
      );
      await helmData.updateMessage(message.id, aiResponse);
    } catch {
      // Keep original on failure
    } finally {
      setIsThinking(false);
    }
  }, [user, helmData, callAI]);

  const resendLonger = useCallback(async (message: HelmMessage) => {
    if (!user || !helmData.activeConversation) return;

    const messageIndex = helmData.messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) return;
    const messagesUpTo = helmData.messages.slice(0, messageIndex);

    setIsThinking(true);
    try {
      const aiResponse = await callAI(
        helmData.activeConversation.id,
        messagesUpTo,
        'Please elaborate more on your previous response.',
      );
      await helmData.updateMessage(message.id, aiResponse);
    } catch {
      // Keep original on failure
    } finally {
      setIsThinking(false);
    }
  }, [user, helmData, callAI]);

  const startNewConversation = useCallback(async () => {
    await helmData.createConversation();
  }, [helmData]);

  const startGuidedConversation = useCallback(async (
    mode: GuidedMode,
    subtype?: GuidedSubtype,
    refId?: string,
  ): Promise<HelmConversation | null> => {
    if (!user) return null;
    const conversation = await helmData.createConversation({
      guided_mode: mode,
      guided_subtype: subtype || null,
      guided_mode_reference_id: refId,
    });
    if (!conversation) return null;

    // Send the AI's opening message for guided modes
    const openingMessage = getGuidedModeOpeningMessage(mode);
    if (openingMessage) {
      await helmData.addMessage(conversation.id, 'assistant', openingMessage);
    }

    return conversation;
  }, [user, helmData]);

  const switchConversation = useCallback(async (conversationId: string) => {
    await helmData.loadConversation(conversationId);
    setShowHistory(false);
  }, [helmData]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await helmData.deleteConversation(conversationId);
  }, [helmData]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    await helmData.updateTitle(conversationId, title);
  }, [helmData]);

  return (
    <HelmContext.Provider
      value={{
        drawerState,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        expandDrawer,
        setDrawerState,
        pageContext,
        setPageContext,
        activeConversation: helmData.activeConversation,
        messages: helmData.messages,
        conversations: helmData.conversations,
        loading: helmData.loading,
        historyLoading: helmData.historyLoading,
        hasMoreHistory: helmData.hasMoreHistory,
        isThinking,
        error: helmData.error,
        sendMessage,
        startNewConversation,
        startGuidedConversation,
        switchConversation,
        deleteConversation,
        renameConversation,
        loadHistory: helmData.loadHistory,
        showHistory,
        setShowHistory,
        regenerateMessage,
        resendShorter,
        resendLonger,
      }}
    >
      {children}
    </HelmContext.Provider>
  );
}

export function useHelmContext() {
  const ctx = useContext(HelmContext);
  if (!ctx) throw new Error('useHelmContext must be used within HelmProvider');
  return ctx;
}

// Keep backward compatibility with existing imports
export function useHelm() {
  return useHelmContext();
}
