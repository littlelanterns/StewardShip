import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useHelmData } from '../hooks/useHelmData';
import { useAuthContext } from './AuthContext';
import type { HelmPageContext, HelmConversation, HelmMessage } from '../lib/types';

export type { HelmPageContext };

type DrawerState = 'closed' | 'peek' | 'full';

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
  error: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => Promise<void>;
  switchConversation: (conversationId: string) => Promise<void>;
  loadHistory: (offset?: number) => Promise<void>;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
}

const HelmContext = createContext<HelmContextValue | null>(null);

export function HelmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [drawerState, setDrawerState] = useState<DrawerState>('closed');
  const [pageContext, setPageContext] = useState<HelmPageContext>({ page: 'crowsnest' });
  const [showHistory, setShowHistory] = useState(false);

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    let conversation = helmData.activeConversation;

    // Create a conversation if none exists
    if (!conversation) {
      conversation = await helmData.createConversation();
      if (!conversation) return;
    }

    // Add user message
    await helmData.addMessage(
      conversation.id,
      'user',
      content.trim(),
      pageContext.page,
    );

    // Placeholder assistant response (AI integration coming later)
    await helmData.addMessage(
      conversation.id,
      'assistant',
      'AI integration coming soon. Your message has been saved.',
      pageContext.page,
    );
  }, [helmData, pageContext.page]);

  const startNewConversation = useCallback(async () => {
    await helmData.createConversation();
  }, [helmData]);

  const switchConversation = useCallback(async (conversationId: string) => {
    await helmData.loadConversation(conversationId);
    setShowHistory(false);
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
        error: helmData.error,
        sendMessage,
        startNewConversation,
        switchConversation,
        loadHistory: helmData.loadHistory,
        showHistory,
        setShowHistory,
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
