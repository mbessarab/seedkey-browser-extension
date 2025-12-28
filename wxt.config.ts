import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * WXT Configuration
 * @see https://wxt.dev/api/config.html
 */
export default defineConfig({
  srcDir: '.',

  // Public files (copied to the build root)
  publicDir: 'public',

  // Extension manifest
  manifest: {
    name: 'SeedKey Auth',
    description: 'Passwordless authentication. Your key is you.',
    version: '0.0.1',
    default_locale: 'en',

    // Minimal permissions
    permissions: [
      'storage',
    ],

    // Icons
    // SVG / PNG
    icons: {
      16: '/icon/icon.svg',
      32: '/icon/icon.svg',
      48: '/icon/icon.svg',
      128: '/icon/icon.svg',
    },

    // Action (popup)
    action: {
      default_popup: 'popup/index.html',
      default_title: 'SeedKey Auth',
      default_icon: {
        16: '/icon/icon.svg',
        32: '/icon/icon.svg',
        48: '/icon/icon.svg',
      },
    },

    // CSP for WASM (cryptographic operations)
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },

  },

  // Vite config with React
  vite: () => ({
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname),
      },
    },
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
      // Increase chunk warning limit
      chunkSizeWarningLimit: 600,
    },
    esbuild: {
      legalComments: 'none',
    },
  }),

  // ZIP archive settings
  zip: {
    excludeSources: ['**/*.map', '**/*.ts.map'],
  },
});
