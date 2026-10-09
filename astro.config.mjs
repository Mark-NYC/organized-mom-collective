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
  vite: {
    plugins: [tailwindcss()],
  },
});
