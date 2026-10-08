import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initMonitoring } from './lib/monitoring';
import './index.css';

// Before render, so a crash during the first paint is still reported.
// Inert unless VITE_SENTRY_DSN is set.
initMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
