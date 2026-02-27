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
    case 'meeting':
      return "Let's set up this meeting. I'll walk us through a structured agenda — we'll cover what matters, capture action items, and make sure nothing important gets missed.\n\nReady when you are.";
    case 'manifest_discuss':
      return null; // Opening message varies — set by caller based on specific item vs library
    case 'crew_action':
      return null; // AI greets based on mode (say/navigate) and person context
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

  // Guided modal state
  guidedModalOpen: boolean;
  openGuidedModal: () => void;
  closeGuidedModal: () => void;

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
  sendMessage: (content: string, attachment?: { storagePath: string; fileType: string; fileName: string }) => Promise<void>;
  startNewConversation: () => Promise<void>;
  startGuidedConversation: (mode: GuidedMode, subtype?: GuidedSubtype, refId?: string, metadata?: Record<string, unknown>) => Promise<HelmConversation | null>;
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
  const [guidedModalOpen, setGuidedModalOpen] = useState(false);
  const [guidedModeMetadata, setGuidedModeMetadata] = useState<Record<string, unknown> | null>(null);

  const openGuidedModal = useCallback(() => setGuidedModalOpen(true), []);
  const closeGuidedModal = useCallback(() => setGuidedModalOpen(false), []);

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
    fileInfo?: { storagePath: string; fileType: string; fileName: string },
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const lastUserMessage = [...messagesForContext]
      .reverse()
      .find((m) => m.role === 'user');
    const messageText = lastUserMessage?.content || '';

    // Build guided mode context
    const activeConvo = helmData.activeConversation;
    let gmContext: { manifest_item_id?: string; manifest_item_title?: string; people_id?: string; higgins_people_ids?: string[] } | undefined;
    if (activeConvo?.guided_mode === 'manifest_discuss' && activeConvo.guided_mode_reference_id) {
      gmContext = {
        manifest_item_id: activeConvo.guided_mode_reference_id,
        manifest_item_title: activeConvo.title || undefined,
      };
    } else if (activeConvo?.guided_mode === 'crew_action') {
      gmContext = {
        people_id: activeConvo.guided_mode_reference_id || undefined,
        higgins_people_ids: (guidedModeMetadata?.higgins_people_ids as string[] | undefined) || undefined,
      };
    }

    const context = await loadContext({
      message: messageText,
      pageContext: pageContext.page,
      userId: user.id,
      guidedMode: activeConvo?.guided_mode,
      guidedSubtype: activeConvo?.guided_subtype,
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
    return await sendChatMessage(systemPrompt, apiMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, 0, user.id, guidedMode, fileInfo);
  }, [user, pageContext.page, helmData.activeConversation?.guided_mode, helmData.activeConversation?.guided_mode_reference_id, helmData.activeConversation?.title, guidedModeMetadata]);

  const sendMessage = useCallback(async (content: string, attachment?: { storagePath: string; fileType: string; fileName: string }) => {
    if ((!content.trim() && !attachment) || !user) return;

    let conversation = helmData.activeConversation;

    // Create a conversation if none exists
    if (!conversation) {
      conversation = await helmData.createConversation();
      if (!conversation) return;
    }

    // Add user message (with file info if attachment exists)
    const userMsg = await helmData.addMessage(
      conversation.id,
      'user',
      content.trim() || `[Attached: ${attachment?.fileName}]`,
      pageContext.page,
      attachment ? { storagePath: attachment.storagePath, fileType: attachment.fileType } : undefined,
    );

    if (!userMsg) return;

    // Call AI
    setIsThinking(true);
    try {
      const currentMessages = [...helmData.messages, userMsg];
      const aiResponse = await callAI(conversation.id, currentMessages, undefined, attachment);

      await helmData.addMessage(
        conversation.id,
        'assistant',
        aiResponse,
        pageContext.page,
      );

      // Auto-title in background after first AI response
      if (!conversation.title) {
        autoTitleConversation(content.trim() || `Discussing ${attachment?.fileName}`, user.id).then((title) => {
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
    metadata?: Record<string, unknown>,
  ): Promise<HelmConversation | null> => {
    if (!user) return null;

    // Store metadata for context loader access during this conversation
    setGuidedModeMetadata(metadata || null);

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

    // Auto-open the guided modal
    setGuidedModalOpen(true);

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
        guidedModalOpen,
        openGuidedModal,
        closeGuidedModal,
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
