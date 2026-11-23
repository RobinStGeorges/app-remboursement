import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    // Le plugin PWA n'est pas chargé pendant les tests : on remplace son module virtuel.
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./test/stubs/pwa-register.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
