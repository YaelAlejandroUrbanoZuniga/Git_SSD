import { useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Sidebar } from './components/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import type { AppRole } from './types';
import { Inicio } from './pages/Inicio';
import { TrackerStepperView } from './pages/tracker/TrackerStepperView';
import { TrackerStage } from './pages/tracker/TrackerStage';
import { TrackerSupplierDetail } from './pages/tracker/TrackerSupplierDetail';
import { TrackerBlacklisted } from './pages/tracker/TrackerBlacklisted';
import { BlacklistedSupplierDetail } from './pages/tracker/BlacklistedSupplierDetail';
import { TrackerCompleted } from './pages/tracker/TrackerCompleted';
import { CompletedSupplierDetail } from './pages/tracker/CompletedSupplierDetail';
import { MRLList } from './pages/tracker/MRLList';
import { MRLRequirementDetail } from './pages/tracker/MRLRequirementDetail';
import { SuppliersList } from './pages/suppliers/SuppliersList';
import { SuppliersDetail } from './pages/suppliers/SuppliersDetail';
import { EventsList } from './pages/events/EventsList';
import { EventDetail } from './pages/events/EventDetail';
import { StrategyPage } from './pages/strategy/StrategyPage';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { UserManagement } from './pages/UserManagement';
import { Login } from './pages/Login';

// Roles allowed on operational modules (everyone except Guest).
const OPERATIONAL: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

// Redirect legacy /pipeline/* links (e.g. demo notifications) to /tracker/*
function LegacyTrackerRedirect() {
  const location = useLocation();
  return <Navigate to={location.pathname.replace(/^\/pipeline/, '/tracker') + location.search} replace />;
}

/** Wraps a route element so only `allow` roles reach it (Guest blocked). */
function Gate({ allow, children }: { allow?: AppRole[]; children: ReactNode }) {
  return <ProtectedRoute allow={allow}>{children}</ProtectedRoute>;
}

// Keyed on the path so each navigation remounts and replays the fade.
function AppRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade">
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* Open to any authenticated role, including Guest */}
        <Route path="/inicio" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Inicio />} />
        <Route path="/configuracion" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />

        {/* Operational modules — blocked for Guest */}
        <Route path="/tracker" element={<Gate allow={OPERATIONAL}><TrackerStepperView /></Gate>} />
        <Route path="/tracker/stage/:stageName" element={<Gate allow={OPERATIONAL}><TrackerStage /></Gate>} />
        <Route path="/tracker/supplier/:supplierId" element={<Gate allow={OPERATIONAL}><TrackerSupplierDetail /></Gate>} />
        <Route path="/tracker/blacklisted" element={<Gate allow={OPERATIONAL}><TrackerBlacklisted /></Gate>} />
        <Route path="/tracker/blacklisted/supplier/:supplierId" element={<Gate allow={OPERATIONAL}><BlacklistedSupplierDetail /></Gate>} />
        <Route path="/tracker/completed" element={<Gate allow={OPERATIONAL}><TrackerCompleted /></Gate>} />
        <Route path="/tracker/completed/supplier/:supplierId" element={<Gate allow={OPERATIONAL}><CompletedSupplierDetail /></Gate>} />
        <Route path="/strategy/mrl" element={<Gate allow={OPERATIONAL}><MRLList /></Gate>} />
        <Route path="/strategy/mrl/:requirementId" element={<Gate allow={OPERATIONAL}><MRLRequirementDetail /></Gate>} />
        <Route path="/pipeline/mrl" element={<Gate allow={OPERATIONAL}><Navigate to="/strategy/mrl" replace /></Gate>} />
        <Route path="/pipeline/*" element={<Gate allow={OPERATIONAL}><LegacyTrackerRedirect /></Gate>} />
        <Route path="/suppliers" element={<Gate allow={OPERATIONAL}><SuppliersList /></Gate>} />
        <Route path="/suppliers/supplier/:supplierId" element={<Gate allow={OPERATIONAL}><SuppliersDetail /></Gate>} />
        <Route path="/events" element={<Gate allow={OPERATIONAL}><EventsList /></Gate>} />
        <Route path="/events/:eventId" element={<Gate allow={OPERATIONAL}><EventDetail /></Gate>} />
        <Route path="/strategy" element={<Gate allow={OPERATIONAL}><StrategyPage /></Gate>} />
        <Route path="/dashboard" element={<Gate allow={OPERATIONAL}><Navigate to="/visuals" replace /></Gate>} />
        <Route path="/visuals" element={<Gate allow={OPERATIONAL}><Dashboard /></Gate>} />

        {/* Master role only */}
        <Route path="/users" element={<Gate allow={['SSD']}><UserManagement /></Gate>} />
      </Routes>
    </div>
  );
}

/** /login is the only public route; an already-authenticated visit bounces to /home. */
function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/home" replace />;
  return <Login />;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 56 : 240;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen" style={{ backgroundColor: '#EEEEEE' }}>
                <GlobalHeader />
                <Sidebar
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(v => !v)}
                />
                <main
                  style={{
                    marginLeft: sidebarWidth,
                    paddingTop: 44 + 32,
                    paddingLeft: 32,
                    paddingRight: 32,
                    paddingBottom: 32,
                    minHeight: '100vh',
                    backgroundColor: '#EEEEEE',
                    transition: 'margin-left 0.3s',
                  }}
                >
                  <AppRoutes />
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
