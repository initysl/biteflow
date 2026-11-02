import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initTheme } from './lib/theme';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
