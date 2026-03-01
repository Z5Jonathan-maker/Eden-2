import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// NOTE: This file is ONLY used for vitest configuration. The app builds with CRA + Craco.
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
      // Automatic JSX runtime
      jsxRuntime: 'automatic',
    }),
  ],

  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },

  // Environment variable prefix (Vite uses VITE_ by default)
  envPrefix: ['REACT_APP_', 'VITE_'],

  // Dev server configuration
  server: {
    port: 3000,
    open: false,
    cors: true,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Optimize deps
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@vis.gl/react-google-maps',
      'framer-motion',
    ],
  },

  // Preview server (for build preview)
  preview: {
    port: 3000,
    open: false,
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules/', 'e2e/', 'build/', 'dist/'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'e2e/',
      ],
    },
  },
});
