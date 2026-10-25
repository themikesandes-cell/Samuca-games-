import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the game from https://themikesandes-cell.github.io/Samuca-games-/
export default defineConfig({
  base: '/Samuca-games-/',
  root: 'web',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2019',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
