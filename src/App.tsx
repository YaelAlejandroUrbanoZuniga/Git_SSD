import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalHeader } from './components/GlobalHeader';
import { Sidebar } from './components/Sidebar';
import { Inicio } from './pages/Inicio';
import { PipelineKanban } from './pages/pipeline/PipelineKanban';
import { PipelineStage } from './pages/pipeline/PipelineStage';
import { PipelineSupplierDetail } from './pages/pipeline/PipelineSupplierDetail';
import { PipelineBlacklisted } from './pages/pipeline/PipelineBlacklisted';
import { MRLList } from './pages/pipeline/MRLList';
import { SuppliersList } from './pages/suppliers/SuppliersList';
import { SuppliersDetail } from './pages/suppliers/SuppliersDetail';
import { EventsList } from './pages/events/EventsList';
import { EventDetail } from './pages/events/EventDetail';
import { StrategyPage } from './pages/strategy/StrategyPage';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { UserManagement } from './pages/UserManagement';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed ? 56 : 240;

  return (
    <BrowserRouter>
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
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/inicio" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Inicio />} />
            <Route path="/pipeline" element={<PipelineKanban />} />
            <Route path="/pipeline/stage/:stageName" element={<PipelineStage />} />
            <Route path="/pipeline/supplier/:supplierId" element={<PipelineSupplierDetail />} />
            <Route path="/pipeline/blacklisted" element={<PipelineBlacklisted />} />
            <Route path="/strategy/mrl" element={<MRLList />} />
            <Route path="/pipeline/mrl" element={<Navigate to="/strategy/mrl" replace />} />
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
    </BrowserRouter>
  );
}

export default App;
