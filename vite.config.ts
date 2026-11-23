import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// L'app est servie sous https://lepetitperchoir.fr/remboursement/ par le routeur du portail.
export default defineConfig({
  base: '/remboursement/',
  server: { port: 5179, strictPort: true },
  preview: { port: 5179 },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: false, // seul le portail est installable
      workbox: {
        navigateFallback: '/remboursement/index.html',
        navigateFallbackAllowlist: [/^\/remboursement\/(index\.html)?$/],
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
});
