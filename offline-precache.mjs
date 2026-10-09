import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Offline support: after the build, write the list of files the app needs into
 * dist/sw.js, so the service worker can save all of them on its first install.
 * VERSION is a hash of those files, so every deploy refreshes the saved copy.
 */
export default function offlinePrecache() {
  return {
    name: 'omc-offline-precache',
    hooks: {
      /** @param {{ dir: URL }} options */
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        /** @param {string} d @returns {string[]} */
        const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
        const url = (/** @type {string} */ f) => '/' + relative(root, f).split(sep).join('/');

        // App pages (/app/index.html → /app), plus everything they load.
        const pages = walk(join(root, 'app'))
          .filter((f) => f.endsWith('index.html'))
          .map((f) => url(f).replace(/\/index\.html$/, ''));
        const assets = [
          ...walk(join(root, '_astro')),
          ...walk(join(root, 'icons')),
          ...walk(join(root, 'brand')),
          join(root, 'manifest.webmanifest'),
          join(root, 'favicon.ico'),
          join(root, 'favicon-32.png'),
        ].map(url);
        const files = [...pages, ...assets].sort();

        const hash = createHash('sha256');
        for (const f of files) {
          const disk = f.startsWith('/app') ? join(root, f, 'index.html') : join(root, f);
          hash.update(f).update(readFileSync(disk));
        }
        const swPath = join(root, 'sw.js');
        const sw = readFileSync(swPath, 'utf8')
          .replace("const VERSION = 'dev';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
          .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files)};`);
        if (!sw.includes('const PRECACHE = ["')) throw new Error('offline precache: could not fill dist/sw.js');
        writeFileSync(swPath, sw);
      },
    },
  };
}
