import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // Electron app — large lucide-react icon set is expected
    // No manualChunks: the object form produced an empty "vendor" chunk that
    // nothing referenced (react-dom still landed in the main bundle).
  },
});
