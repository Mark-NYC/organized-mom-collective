import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cloudflare Pages redirects: after the build, write the `redirects` from astro.config.mjs into
 * dist/_redirects as permanent (301) server redirects. Astro's own redirect pages stay as the
 * fallback for `astro preview` and other hosts. One list, in astro.config.mjs.
 */

/** @param {Record<string, string | { destination: string }>} redirects */
export function redirectsFile(redirects) {
  return Object.entries(redirects)
    .map(([from, to]) => `${from} ${typeof to === 'string' ? to : to.destination} 301`)
    .join('\n')
    .concat('\n');
}

export default function cloudflareRedirects() {
  /** @type {Record<string, string | { destination: string }>} */
  let redirects = {};
  return {
    name: 'omc-cloudflare-redirects',
    hooks: {
      /** @param {{ config: { redirects: typeof redirects } }} options */
      'astro:config:done': ({ config }) => {
        redirects = config.redirects;
      },
      /** @param {{ dir: URL }} options */
      'astro:build:done': ({ dir }) => {
        writeFileSync(join(fileURLToPath(dir), '_redirects'), redirectsFile(redirects));
      },
    },
  };
}
