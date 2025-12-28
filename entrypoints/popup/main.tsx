/**
 * Entry point for the Popup app
 */

import { render } from 'preact';
import { App } from './App';
import { createLogger } from '@/utils/logger';
import './style.css';

const log = createLogger('Popup');

// Initialize the Preact app
const container = document.getElementById('app');

if (!container) {
  throw new Error('Root element #app not found');
}

log.info('Popup initialized');

render(<App />, container);
