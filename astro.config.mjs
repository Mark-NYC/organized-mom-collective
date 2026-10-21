// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import offlinePrecache from './offline-precache.mjs';
import cloudflareRedirects from './cloudflare-redirects.mjs';

export default defineConfig({
  // Production host — used for canonical URLs, og:url, JSON-LD and the sitemap. www, because the site is
  // served there (Pinterest's catalog feed uses www too).
  site: 'https://www.organizedmomcollective.com',
  integrations: [react(), mdx(), offlinePrecache(), cloudflareRedirects()],
  // Old WordPress URLs printed in paid PDFs: keep them working (see README → Redirects). On Cloudflare
  // each is also a permanent (301) server redirect, written to dist/_redirects by cloudflare-redirects.mjs.
  redirects: {
    // The policy page's old address: now Returns & Refunds.
    '/refunds': '/returns',
    '/command-center-reset-where-did-my-time-go-how-to-spot-and-stop-energy-leaks-in-your-week': '/resources/where-does-my-time-go',
    // Short address for IF-03 (Pins, print). One page, one canonical: the article.
    '/chores-for-kids-by-age': '/resources/chores-for-kids-by-age',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
