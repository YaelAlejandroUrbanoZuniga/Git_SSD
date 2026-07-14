import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Sidebar } from './components/Sidebar';
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

// Redirect legacy /pipeline/* links (e.g. demo notifications) to /tracker/*
function LegacyTrackerRedirect() {
  const location = useLocation();
  return <Navigate to={location.pathname.replace(/^\/pipeline/, '/tracker') + location.search} replace />;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 56 : 240;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
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
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/inicio" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<Inicio />} />
                  <Route path="/tracker" element={<TrackerStepperView />} />
                  <Route path="/tracker/stage/:stageName" element={<TrackerStage />} />
                  <Route path="/tracker/supplier/:supplierId" element={<TrackerSupplierDetail />} />
                  <Route path="/tracker/blacklisted" element={<TrackerBlacklisted />} />
                  <Route path="/tracker/blacklisted/supplier/:supplierId" element={<BlacklistedSupplierDetail />} />
                  <Route path="/tracker/completed" element={<TrackerCompleted />} />
                  <Route path="/tracker/completed/supplier/:supplierId" element={<CompletedSupplierDetail />} />
                  <Route path="/strategy/mrl" element={<MRLList />} />
                  <Route path="/strategy/mrl/:requirementId" element={<MRLRequirementDetail />} />
                  <Route path="/pipeline/mrl" element={<Navigate to="/strategy/mrl" replace />} />
                  <Route path="/pipeline/*" element={<LegacyTrackerRedirect />} />
                  <Route path="/suppliers" element={<SuppliersList />} />
                  <Route path="/suppliers/supplier/:supplierId" element={<SuppliersDetail />} />
                  <Route path="/events" element={<EventsList />} />
                  <Route path="/events/:eventId" element={<EventDetail />} />
                  <Route path="/strategy" element={<StrategyPage />} />
                  <Route path="/dashboard" element={<Navigate to="/visuals" replace />} />
                  <Route path="/visuals" element={<Dashboard />} />
                  <Route path="/configuracion" element={<Navigate to="/settings" replace />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/users" element={<UserManagement />} />
                </Routes>
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
