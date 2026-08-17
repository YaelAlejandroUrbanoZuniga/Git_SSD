import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Sidebar } from './components/Sidebar';
import { LoadingState } from './components/LoadingState';
import { MAIN_PADDING_TOP, MAIN_PADDING_X, MAIN_PADDING_BOTTOM } from './components/layoutConstants';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import type { AppRole } from './types';
import { Login } from './pages/Login';
import { BRAND_COLORS } from './constants/designTokens';

const Inicio = lazy(() => import('./pages/Inicio').then(m => ({ default: m.Inicio })));
const TrackerStepperView = lazy(() => import('./pages/tracker/TrackerStepperView').then(m => ({ default: m.TrackerStepperView })));
const TrackerStage = lazy(() => import('./pages/tracker/TrackerStage').then(m => ({ default: m.TrackerStage })));
const TrackerSupplierDetail = lazy(() => import('./pages/tracker/TrackerSupplierDetail').then(m => ({ default: m.TrackerSupplierDetail })));
const TrackerBlacklisted = lazy(() => import('./pages/tracker/TrackerBlacklisted').then(m => ({ default: m.TrackerBlacklisted })));
const BlacklistedSupplierDetail = lazy(() => import('./pages/tracker/BlacklistedSupplierDetail').then(m => ({ default: m.BlacklistedSupplierDetail })));
const TrackerCompleted = lazy(() => import('./pages/tracker/TrackerCompleted').then(m => ({ default: m.TrackerCompleted })));
const CompletedSupplierDetail = lazy(() => import('./pages/tracker/CompletedSupplierDetail').then(m => ({ default: m.CompletedSupplierDetail })));
const MRLList = lazy(() => import('./pages/tracker/MRLList').then(m => ({ default: m.MRLList })));
const MRLRequirementDetail = lazy(() => import('./pages/tracker/MRLRequirementDetail').then(m => ({ default: m.MRLRequirementDetail })));
const SuppliersList = lazy(() => import('./pages/suppliers/SuppliersList').then(m => ({ default: m.SuppliersList })));
const SuppliersDetail = lazy(() => import('./pages/suppliers/SuppliersDetail').then(m => ({ default: m.SuppliersDetail })));
const EventsList = lazy(() => import('./pages/events/EventsList').then(m => ({ default: m.EventsList })));
const EventDetail = lazy(() => import('./pages/events/EventDetail').then(m => ({ default: m.EventDetail })));
const StrategyPage = lazy(() => import('./pages/strategy/StrategyPage').then(m => ({ default: m.StrategyPage })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const UserManagement = lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));

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

// Delay before the generic Suspense fallback appears, so an already-cached
// chunk (the common case) never flashes it before the module's own loading
// state mounts. A genuinely slow chunk download still shows feedback after
// this threshold.
const SUSPENSE_FALLBACK_DELAY_MS = 200;

/** Mounted only while Suspense is suspended; renders nothing until the delay elapses. */
function DelayedSuspenseFallback() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), SUSPENSE_FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <LoadingState fill />;
}

// Keyed on the path so each navigation remounts and replays the fade.
function AppRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade">
      <Suspense fallback={<DelayedSuspenseFallback />}>
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
          <Route path="/reports" element={<Gate allow={OPERATIONAL}><Reports /></Gate>} />
          <Route path="/dashboard" element={<Gate allow={OPERATIONAL}><Navigate to="/visuals" replace /></Gate>} />
          <Route path="/visuals" element={<Gate allow={OPERATIONAL}><Dashboard /></Gate>} />

          {/* Master role only */}
          <Route path="/users" element={<Gate allow={['SSD']}><UserManagement /></Gate>} />
        </Routes>
      </Suspense>
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
              <div className="min-h-screen" style={{ backgroundColor: BRAND_COLORS.background }}>
                <GlobalHeader />
                <Sidebar
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(v => !v)}
                />
                <main
                  style={{
                    marginLeft: sidebarWidth,
                    paddingTop: MAIN_PADDING_TOP,
                    paddingLeft: MAIN_PADDING_X,
                    paddingRight: MAIN_PADDING_X,
                    paddingBottom: MAIN_PADDING_BOTTOM,
                    minHeight: '100vh',
                    backgroundColor: BRAND_COLORS.background,
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
