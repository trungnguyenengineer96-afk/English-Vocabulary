import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './state/store';
import { App } from './ui/App';
import './ui/styles.css';

// Dev-only: `?forceAudio=1` renders listening modes in browsers without voices (e.g. headless test browsers).
const forceAudio = import.meta.env.DEV && new URLSearchParams(window.location.search).has('forceAudio') ? true : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App forceAudio={forceAudio} />
    </StoreProvider>
  </StrictMode>,
);
