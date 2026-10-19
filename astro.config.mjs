// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import offlinePrecache from './offline-precache.mjs';

export default defineConfig({
  // Production host — used for canonical URLs, og:url, JSON-LD and the sitemap. www, because Vercel serves
  // the site there and 308-redirects the bare domain to it (Pinterest's catalog feed uses www too).
  site: 'https://www.organizedmomcollective.com',
  integrations: [react(), mdx(), offlinePrecache()],
  // Old WordPress URLs printed in paid PDFs: keep them working (see README → Redirects).
  redirects: {
    // The policy page's old address: now Returns & Refunds. On Vercel, vercel.json answers it first with a
    // permanent (308) redirect; this page is the fallback for other hosts and `astro preview`.
    '/refunds': '/returns',
    '/command-center-reset-where-did-my-time-go-how-to-spot-and-stop-energy-leaks-in-your-week': '/resources/where-does-my-time-go',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
