import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import Sidebar from './Sidebar';
import MoreMenu from './MoreMenu';
import HelmDrawer from '../helm/HelmDrawer';
import HatchDrawer from '../hatch/HatchDrawer';
import GuidedHelmModal from '../helm/GuidedHelmModal';
import { SundayReflection } from '../rhythms/SundayReflection';
import { useRhythmCards } from '../../hooks/useRhythmCards';
import { supabase } from '../../lib/supabase';
import './AppLayout.css';

export default function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [showSundayReflection, setShowSundayReflection] = useState(false);
  const { checkRhythmDue } = useRhythmCards();

  const handleMorePress = useCallback(() => setMoreOpen((o) => !o), []);
  const handleMoreClose = useCallback(() => setMoreOpen(false), []);

  // Check if Sunday Reflection should show on mount
  useEffect(() => {
    let mounted = true;

    const checkSunday = async () => {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .maybeSingle();

      if (!mounted) return;

      const isDue = await checkRhythmDue('sunday_reflection', settings);
      if (mounted && isDue) {
        setShowSundayReflection(true);
      }
    };

    checkSunday();
    return () => { mounted = false; };
  }, [checkRhythmDue]);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-layout__main">
        <Outlet />
      </main>

      <BottomTabBar onMorePress={handleMorePress} moreOpen={moreOpen} />
      <MoreMenu open={moreOpen} onClose={handleMoreClose} />
      <HelmDrawer />
      <HatchDrawer />
      <GuidedHelmModal />

      {/* Sunday Reflection overlay — shows on configured day */}
      {showSundayReflection && (
        <SundayReflection onDismiss={() => setShowSundayReflection(false)} />
      )}
    </div>
  );
}
