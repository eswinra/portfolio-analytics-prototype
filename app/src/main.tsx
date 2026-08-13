import '@fontsource/mulish/400.css';
import '@fontsource/mulish/500.css';
import '@fontsource/mulish/600.css';
import '@fontsource/mulish/700.css';
import '@fontsource/mulish/800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
