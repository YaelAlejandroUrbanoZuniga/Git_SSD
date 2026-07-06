import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { RoleProvider } from './context/RoleContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </StrictMode>
);
