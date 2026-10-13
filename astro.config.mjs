// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import offlinePrecache from './offline-precache.mjs';

export default defineConfig({
  // Production domain — used for canonical URLs on public pages.
  site: 'https://organizedmomcollective.com',
  integrations: [react(), mdx(), offlinePrecache()],
  // Old WordPress URLs printed in paid PDFs: keep them working (see README → Redirects).
  redirects: {
    '/command-center-reset-where-did-my-time-go-how-to-spot-and-stop-energy-leaks-in-your-week': '/resources/where-does-my-time-go',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
