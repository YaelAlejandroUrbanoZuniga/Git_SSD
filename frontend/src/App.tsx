import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Sidebar } from './components/Sidebar';
import { LoadingState } from './components/LoadingState';
import { MAIN_PADDING_TOP, MAIN_PADDING_X, MAIN_PADDING_BOTTOM } from './components/layoutConstants';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import type { AppRole } from './types';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { BRAND_COLORS } from './constants/designTokens';

/**
 * `lazy()` for a named export, with the chunk-download failure made visible.
 *
 * Without the `.catch`, a chunk that 404s (the realistic case: the app was
 * redeployed with new hashed filenames while this tab stayed open) rejects the
 * Suspense promise with a browser-specific message and React renders nothing —
 * a blank screen with no toast and no way back. Rethrowing a `ChunkLoadError`
 * gives `ErrorBoundary` something it can recognise and offer a reload for.
 */
function lazyPage<T extends Record<string, unknown>>(
  load: () => Promise<T>,
  name: keyof T & string,
) {
  return lazy(() =>
    load()
      .then(m => ({ default: m[name] as ComponentType }))
      .catch(() => {
        const err = new Error(
          `Could not load the "${name}" screen. The application may have been updated since this tab was opened.`,
        );
        err.name = 'ChunkLoadError';
        throw err;
      }),
  );
}

const Inicio = lazyPage(() => import('./pages/Inicio'), 'Inicio');
const TrackerStepperView = lazyPage(() => import('./pages/tracker/TrackerStepperView'), 'TrackerStepperView');
const TrackerStage = lazyPage(() => import('./pages/tracker/TrackerStage'), 'TrackerStage');
const TrackerSupplierDetail = lazyPage(() => import('./pages/tracker/TrackerSupplierDetail'), 'TrackerSupplierDetail');
const TrackerBlacklisted = lazyPage(() => import('./pages/tracker/TrackerBlacklisted'), 'TrackerBlacklisted');
const BlacklistedSupplierDetail = lazyPage(() => import('./pages/tracker/BlacklistedSupplierDetail'), 'BlacklistedSupplierDetail');
const TrackerCompleted = lazyPage(() => import('./pages/tracker/TrackerCompleted'), 'TrackerCompleted');
const CompletedSupplierDetail = lazyPage(() => import('./pages/tracker/CompletedSupplierDetail'), 'CompletedSupplierDetail');
const MRLList = lazyPage(() => import('./pages/tracker/MRLList'), 'MRLList');
const MRLRequirementDetail = lazyPage(() => import('./pages/tracker/MRLRequirementDetail'), 'MRLRequirementDetail');
const SuppliersList = lazyPage(() => import('./pages/suppliers/SuppliersList'), 'SuppliersList');
const SuppliersDetail = lazyPage(() => import('./pages/suppliers/SuppliersDetail'), 'SuppliersDetail');
const EventsList = lazyPage(() => import('./pages/events/EventsList'), 'EventsList');
const EventDetail = lazyPage(() => import('./pages/events/EventDetail'), 'EventDetail');
const StrategyPage = lazyPage(() => import('./pages/strategy/StrategyPage'), 'StrategyPage');
const Reports = lazyPage(() => import('./pages/Reports'), 'Reports');
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard');
const Profile = lazyPage(() => import('./pages/Profile'), 'Profile');
const UserManagement = lazyPage(() => import('./pages/UserManagement'), 'UserManagement');

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
      {/* Inner boundary — inside the pathname-keyed div, so it remounts (and
          therefore resets) on every navigation. Catches a page crash or a failed
          chunk while keeping the header and sidebar usable, which is what lets
          the user navigate away instead of only reloading. The outer boundary in
          `App` still backstops a crash in the shell itself. */}
      <ErrorBoundary>
        <Suspense fallback={<DelayedSuspenseFallback />}>
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/login" replace />} />
            {/* Open to any authenticated role, including Guest */}
            <Route path="/inicio" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Inicio />} />
            {/* `/settings` (and its legacy `/configuracion` alias) is intentionally
                unrouted: `pages/Settings.tsx` still exists but its whole content is
                "There are no configurable preferences yet", so it was the first thing
                a new user found under a menu promising settings. Both paths now fall
                through to the 404 below. Restore them together with the sidebar entry
                once the page has real content. */}
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

            {/* Anything else — a stale bookmark, a notification pointing at a retired
                route — gets an explicit 404 instead of an empty <main>. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
    // Top-level boundary: the last thing between an unhandled render error and a
    // blank document. It covers the shell itself (header, sidebar, Login) — a
    // crash inside a routed page is caught by the inner boundary in `AppRoutes`,
    // which keeps the shell usable and resets on the next navigation.
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
