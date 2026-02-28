import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { HelmProvider } from './contexts/HelmContext';
import { HatchProvider } from './contexts/HatchContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AppLayout from './components/navigation/AppLayout';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import CrowsNest from './pages/CrowsNest';
import Compass from './pages/Compass';
import Helm from './pages/Helm';
import Log from './pages/Log';
import Charts from './pages/Charts';
import Mast from './pages/Mast';
import Keel from './pages/Keel';
import Wheel from './pages/Wheel';
import LifeInventory from './pages/LifeInventory';
import Rigging from './pages/Rigging';
import FirstMate from './pages/FirstMate';
import Crew from './pages/Crew';
import Victories from './pages/Victories';
import SafeHarbor from './pages/SafeHarbor';
import Manifest from './pages/Manifest';
import Settings from './pages/Settings';
import Meetings from './pages/Meetings';
import Lists from './pages/Lists';
import Reflections from './pages/Reflections';
import Reports from './pages/Reports';
import Reveille from './pages/Reveille';
import Reckoning from './pages/Reckoning';
import UnloadTheHold from './pages/UnloadTheHold';
import Hatch from './pages/Hatch';
import CaptainsBriefing from './pages/CaptainsBriefing';
import { RhythmInterceptor } from './components/navigation/RhythmInterceptor';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes — no nav shell */}
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* Authenticated routes — nav shell + Helm drawer */}
            <Route
              element={
                <ProtectedRoute>
                  <HelmProvider>
                    <HatchProvider>
                      <AppLayout />
                    </HatchProvider>
                  </HelmProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<RhythmInterceptor><CrowsNest /></RhythmInterceptor>} />
              <Route path="compass" element={<Compass />} />
              <Route path="helm" element={<Helm />} />
              <Route path="log" element={<Log />} />
              <Route path="charts" element={<Charts />} />
              <Route path="mast" element={<Mast />} />
              <Route path="keel" element={<Keel />} />
              <Route path="wheel" element={<Wheel />} />
              <Route path="life-inventory" element={<LifeInventory />} />
              <Route path="rigging" element={<Rigging />} />
              <Route path="first-mate" element={<FirstMate />} />
              <Route path="crew" element={<Crew />} />
              <Route path="victories" element={<Victories />} />
              <Route path="safe-harbor" element={<SafeHarbor />} />
              <Route path="manifest" element={<Manifest />} />
              <Route path="settings" element={<Settings />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="lists" element={<Lists />} />
              <Route path="reflections" element={<Reflections />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reveille" element={<Reveille />} />
              <Route path="reckoning" element={<Reckoning />} />
              <Route path="unload-the-hold" element={<UnloadTheHold />} />
              <Route path="hatch" element={<Hatch />} />
              <Route path="captains-briefing" element={<CaptainsBriefing />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
