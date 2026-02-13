import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
  envPrefix: 'REACT_APP_',

  // Build configuration
  build: {
    outDir: 'build',
    sourcemap: true,
    // Increase chunk size warning limit (default is 500kb)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunking for better caching
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'vendor-map': ['leaflet', 'react-leaflet'],
          'vendor-utils': ['framer-motion', 'clsx', 'class-variance-authority'],
        },
      },
    },
  },

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
      'leaflet',
      'react-leaflet',
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
