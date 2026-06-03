import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { CastleProvider } from './castle/CastleProvider.tsx';
import './index.css';

const publishableKey = import.meta.env.VITE_CASTLE_PK;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CastleProvider publishableKey={publishableKey}>
      <App />
    </CastleProvider>
  </StrictMode>,
);
