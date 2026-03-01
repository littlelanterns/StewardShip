import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useHatch } from '../hooks/useHatch';
import { useAuthContext } from './AuthContext';
import type {
  HatchTab,
  HatchSourceType,
  HatchRoutingDestination,
  HatchRoutingStat,
  HatchExtractedItem,
  HatchHistoryFilters,
  MastEntryType,
  KeelCategory,
  JournalEntryType,
} from '../lib/types';

interface HatchContextValue {
  // Drawer state
  isOpen: boolean;
  openHatch: () => void;
  closeHatch: () => void;
  toggleHatch: () => void;

  // Full-page mode
  isFullPage: boolean;
  enterFullPage: () => void;
  exitFullPage: () => void;

  // Tab state
  tabs: HatchTab[];
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  routingStats: HatchRoutingStat[];

  // Actions
  createTab: (
    sourceType?: HatchSourceType,
    content?: string,
    sourceConversationId?: string,
  ) => Promise<HatchTab | null>;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabTitle: (tabId: string, title: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  routeTab: (
    tabId: string,
    destination: HatchRoutingDestination,
    options?: {
      mastType?: MastEntryType;
      keelCategory?: KeelCategory;
      journalEntryType?: JournalEntryType;
      meetingId?: string;
      listId?: string;
      trackerId?: string;
    },
  ) => Promise<{ success: boolean; destinationId?: string }>;
  bulkRouteTab: (tabId: string, destination: HatchRoutingDestination) => Promise<void>;
  undoRoute: (
    tabId: string,
    destination: HatchRoutingDestination,
    destinationId?: string,
  ) => Promise<void>;

  // Phase B: Review & Route
  extractItems: (tabId: string) => Promise<HatchExtractedItem[]>;
  routeExtractedItem: (
    itemId: string,
    destination: HatchRoutingDestination,
    options?: { meetingId?: string; mastType?: MastEntryType; keelCategory?: KeelCategory; journalEntryType?: JournalEntryType; listId?: string; trackerId?: string },
  ) => Promise<void>;
  skipExtractedItem: (itemId: string) => Promise<void>;
  updateExtractedItemText: (itemId: string, newText: string) => Promise<void>;

  // Phase B: History
  getHistory: (filters?: HatchHistoryFilters) => Promise<HatchTab[]>;
  reopenTab: (tabId: string) => Promise<HatchTab | null>;
  deleteHistoryItem: (tabId: string) => Promise<void>;
}

const HatchContext = createContext<HatchContextValue | null>(null);

export function useHatchContext(): HatchContextValue {
  const ctx = useContext(HatchContext);
  if (!ctx) {
    throw new Error('useHatchContext must be used within a HatchProvider');
  }
  return ctx;
}

export function HatchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullPage, setIsFullPage] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const hatch = useHatch();

  // Always start closed — user opens via pull tab
  useEffect(() => {
    if (!user || initialLoaded) return;
    setInitialLoaded(true);
  }, [user, initialLoaded]);

  // Load tabs and routing stats when user is available
  useEffect(() => {
    if (user) {
      hatch.loadTabs();
      hatch.loadRoutingStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openHatch = useCallback(() => {
    setIsOpen(true);

    // Only create a new tab if there are no tabs at all,
    // or if every existing tab already has content
    const hasEmptyTab = hatch.tabs.some(
      (t) => !t.content || t.content.trim() === ''
    );

    if (hatch.tabs.length === 0) {
      // No tabs at all — create one
      hatch.createTab();
    } else if (!hasEmptyTab) {
      // All tabs have content — create a fresh blank one
      hatch.createTab();
    } else {
      // There's already an empty tab — just activate it
      const emptyTab = hatch.tabs.find(
        (t) => !t.content || t.content.trim() === ''
      );
      if (emptyTab) {
        hatch.setActiveTabId(emptyTab.id);
      }
    }
  }, [hatch]);

  const closeHatch = useCallback(() => {
    setIsOpen(false);
    setIsFullPage(false);
  }, []);

  const toggleHatch = useCallback(() => {
    if (isOpen) {
      closeHatch();
    } else {
      openHatch();
    }
  }, [isOpen, openHatch, closeHatch]);

  // Wrap routeTab to auto-close drawer when no tabs remain
  const routeTabAndAutoClose = useCallback(
    async (
      tabId: string,
      destination: HatchRoutingDestination,
      options?: {
        mastType?: MastEntryType;
        keelCategory?: KeelCategory;
        journalEntryType?: JournalEntryType;
        meetingId?: string;
        listId?: string;
        trackerId?: string;
      },
    ) => {
      const result = await hatch.routeTab(tabId, destination, options);
      // After routing, check if any active tabs remain (subtract 1 for the tab just routed)
      const remainingCount = hatch.tabs.filter((t) => t.id !== tabId).length;
      if (result.success && remainingCount === 0) {
        setIsOpen(false);
      }
      return result;
    },
    [hatch],
  );

  // Wrap bulkRouteTab to auto-close drawer when no tabs remain
  const bulkRouteTabAndAutoClose = useCallback(
    async (tabId: string, destination: HatchRoutingDestination) => {
      await hatch.bulkRouteTab(tabId, destination);
      const remainingCount = hatch.tabs.filter((t) => t.id !== tabId).length;
      if (remainingCount === 0) {
        setIsOpen(false);
      }
    },
    [hatch],
  );

  // Wrap closeTab to auto-close drawer when no tabs remain
  const closeTabAndAutoClose = useCallback(
    async (tabId: string) => {
      await hatch.closeTab(tabId);
      const remainingCount = hatch.tabs.filter((t) => t.id !== tabId).length;
      if (remainingCount === 0) {
        setIsOpen(false);
      }
    },
    [hatch],
  );

  const enterFullPage = useCallback(() => {
    setIsFullPage(true);
  }, []);

  const exitFullPage = useCallback(() => {
    setIsFullPage(false);
  }, []);

  const value: HatchContextValue = {
    isOpen,
    openHatch,
    closeHatch,
    toggleHatch,
    isFullPage,
    enterFullPage,
    exitFullPage,
    tabs: hatch.tabs,
    activeTabId: hatch.activeTabId,
    setActiveTabId: hatch.setActiveTabId,
    loading: hatch.loading,
    error: hatch.error,
    routingStats: hatch.routingStats,
    createTab: hatch.createTab,
    updateTabContent: hatch.updateTabContent,
    updateTabTitle: hatch.updateTabTitle,
    closeTab: closeTabAndAutoClose,
    routeTab: routeTabAndAutoClose,
    bulkRouteTab: bulkRouteTabAndAutoClose,
    undoRoute: hatch.undoRoute,
    extractItems: hatch.extractItems,
    routeExtractedItem: hatch.routeExtractedItem,
    skipExtractedItem: hatch.skipExtractedItem,
    updateExtractedItemText: hatch.updateExtractedItemText,
    getHistory: hatch.getHistory,
    reopenTab: hatch.reopenTab,
    deleteHistoryItem: hatch.deleteHistoryItem,
  };

  return <HatchContext.Provider value={value}>{children}</HatchContext.Provider>;
}
