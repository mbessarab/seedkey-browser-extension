import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import preact from '@preact/preset-vite';

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
    version: '0.0.3',
    default_locale: 'en',

    // Firefox specific settings
    "browser_specific_settings": {
      "gecko": {
        "id": "@extension-without-data-collection",
        "data_collection_permissions": {
          "required": ["none"]
        }
      }
    },

    "applications": {
      "gecko": {
          "id": "maks@besssarab.ru"
      }
    },

    // Minimal permissions
    permissions: [
      'storage',
    ],

    // Icons
    // SVG / PNG
    icons: {
      16: '/icon/icon-16x16.png',
      32: '/icon/icon-32x32.png',
      48: '/icon/icon-48x48.png',
      128: '/icon/icon-128x128.png',
    },

    // Action (popup)
    action: {
      default_popup: 'popup/index.html',
      default_title: 'SeedKey Auth',
      default_icon: {
        16: '/icon/icon-16x16.png',
        32: '/icon/icon-32x32.png',
        48: '/icon/icon-48x48.png',
      },
    },

    // CSP for WASM (cryptographic operations)
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },

  },

  // Vite config with Preact
  vite: () => ({
    plugins: [preact()],
    resolve: {
      alias: {
        '@': resolve(__dirname),
        // React compatibility aliases
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react/jsx-runtime': 'preact/jsx-runtime',
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
