import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useHatch } from '../hooks/useHatch';
import { useAuthContext } from './AuthContext';
import { supabase } from '../lib/supabase';
import type {
  HatchTab,
  HatchSourceType,
  HatchRoutingDestination,
  HatchRoutingStat,
  HatchExtractedItem,
  HatchHistoryFilters,
  MastEntryType,
  KeelCategory,
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
      meetingId?: string;
      listId?: string;
      trackerId?: string;
    },
  ) => Promise<{ success: boolean; destinationId?: string }>;
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
    options?: { meetingId?: string; mastType?: MastEntryType; keelCategory?: KeelCategory; listId?: string; trackerId?: string },
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

  // Load initial drawer state from user_settings
  useEffect(() => {
    if (!user || initialLoaded) return;

    const loadPreference = async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('hatch_drawer_open')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.hatch_drawer_open != null) {
          setIsOpen(data.hatch_drawer_open);
        }
      } catch {
        // Default to closed on error
      }
      setInitialLoaded(true);
    };

    loadPreference();
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
    // Create a tab if none exist
    if (hatch.tabs.length === 0) {
      hatch.createTab();
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
    closeTab: hatch.closeTab,
    routeTab: hatch.routeTab,
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
