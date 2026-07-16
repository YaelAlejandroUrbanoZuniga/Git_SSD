import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { RoleProvider } from './context/RoleContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoleProvider>
      {/* Above the router so a toast survives the navigation that follows an action. */}
      <ToastProvider>
        <App />
      </ToastProvider>
    </RoleProvider>
  </StrictMode>
);
