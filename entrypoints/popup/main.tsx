/**
 * Entry point for the Popup app
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createLogger } from '@/utils/logger';
import './style.css';

const log = createLogger('Popup');

// Initialize the React app
const container = document.getElementById('app');

if (!container) {
  throw new Error('Root element #app not found');
}

log.info('Popup initialized');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
