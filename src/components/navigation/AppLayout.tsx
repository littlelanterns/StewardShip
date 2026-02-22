import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import Sidebar from './Sidebar';
import MoreMenu from './MoreMenu';
import HelmDrawer from '../helm/HelmDrawer';
import './AppLayout.css';

export default function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleMorePress = useCallback(() => setMoreOpen((o) => !o), []);
  const handleMoreClose = useCallback(() => setMoreOpen(false), []);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-layout__main">
        <Outlet />
      </main>

      <BottomTabBar onMorePress={handleMorePress} moreOpen={moreOpen} />
      <MoreMenu open={moreOpen} onClose={handleMoreClose} />
      <HelmDrawer />
    </div>
  );
}
