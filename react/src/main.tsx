import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { CastleProvider } from './castle/CastleProvider.tsx';
import { readAccountConfig } from './config.ts';
import './index.css';

// Config is injected by the Express/Pug shell on the /account page
// (window.CASTLE_ACCOUNT), with import.meta.env as a fallback for standalone
// React development.
const config = readAccountConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CastleProvider publishableKey={config.pk}>
      <App user={config.user} />
    </CastleProvider>
  </StrictMode>,
);
