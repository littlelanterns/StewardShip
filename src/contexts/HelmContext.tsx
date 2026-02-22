import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type HelmPageContext =
  | { page: 'crowsnest' }
  | { page: 'compass'; activeView?: string }
  | { page: 'helm' }
  | { page: 'log' }
  | { page: 'charts' }
  | { page: 'mast' }
  | { page: 'keel' }
  | { page: 'wheel'; wheelId?: string }
  | { page: 'lifeinventory' }
  | { page: 'rigging'; planId?: string }
  | { page: 'firstmate' }
  | { page: 'crew'; personId?: string }
  | { page: 'victories' }
  | { page: 'safeharbor' }
  | { page: 'manifest' }
  | { page: 'settings' }
  | { page: 'meetings'; meetingType?: string; personId?: string }
  | { page: 'lists' }
  | { page: 'reveille' }
  | { page: 'reckoning' };

type DrawerState = 'closed' | 'peek' | 'full';

interface HelmContextValue {
  drawerState: DrawerState;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  expandDrawer: () => void;
  setDrawerState: (state: DrawerState) => void;
  pageContext: HelmPageContext;
  setPageContext: (ctx: HelmPageContext) => void;
}

const HelmContext = createContext<HelmContextValue | null>(null);

export function HelmProvider({ children }: { children: ReactNode }) {
  const [drawerState, setDrawerState] = useState<DrawerState>('closed');
  const [pageContext, setPageContext] = useState<HelmPageContext>({ page: 'crowsnest' });

  const openDrawer = useCallback(() => setDrawerState('peek'), []);
  const closeDrawer = useCallback(() => setDrawerState('closed'), []);
  const toggleDrawer = useCallback(
    () => setDrawerState((s) => (s === 'closed' ? 'peek' : 'closed')),
    [],
  );
  const expandDrawer = useCallback(() => setDrawerState('full'), []);

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
      }}
    >
      {children}
    </HelmContext.Provider>
  );
}

export function useHelm() {
  const ctx = useContext(HelmContext);
  if (!ctx) throw new Error('useHelm must be used within HelmProvider');
  return ctx;
}
