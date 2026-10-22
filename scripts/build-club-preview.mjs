/**
 * Builds the Organized Family Club member pages as ONE self-contained HTML page (a hosted preview), with the made-up
 * sample households only: src/preview/club-preview.tsx bundled with esbuild, the site's compiled CSS and fonts from a
 * Club-enabled Astro build, the responsibility illustrations as data URIs, React from cdnjs. Run by hand:
 *
 *   PUBLIC_CLUB_ENABLED=true npx astro build --outDir /tmp/dist-club
 *   node scripts/build-club-preview.mjs /tmp/dist-club /tmp/club-preview.html
 *
 * The output is a page fragment (title, styles, root, scripts) for a host that wraps it in its own document.
 */
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [dist, out] = process.argv.slice(2);
if (!dist || !out || !existsSync(join(dist, 'club/dashboard/index.html'))) {
  console.error('Usage: node scripts/build-club-preview.mjs <dist built with PUBLIC_CLUB_ENABLED=true> <out.html>');
  process.exit(1);
}

const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const dataUri = (file) => `data:${MIME[extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

// 1. The CSS every Club page links, fonts inlined (woff2 only; the woff fallbacks are dropped).
const cssFiles = new Set();
for (const page of ['club/dashboard', 'club/family', 'club/start', ...readdirSync(join(dist, 'club/kits')).map((k) => `club/kits/${k}`)]) {
  const html = readFileSync(join(dist, page, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)) cssFiles.add(m[1]);
  for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) cssFiles.add({ inline: m[1] });
}
let css = [...cssFiles].map((f) => (typeof f === 'string' ? readFileSync(join(dist, f), 'utf8') : f.inline)).join('\n');
css = css.replace(/,\s*url\([^)]+\.woff\)\s*format\(["']woff["']\)/g, '');
css = css.replace(/url\((\/_astro\/[^)]+\.woff2)\)/g, (_, p) => `url(${dataUri(join(dist, p))})`);

// 2. Illustrations the chart can show.
const imgDir = join(root, 'public/images/responsibilities');
const images = Object.fromEntries(
  readdirSync(imgDir).filter((f) => f.endsWith('-128.webp')).map((f) => [`/images/responsibilities/${f}`, dataUri(join(imgDir, f))]),
);

// 3. The app. React comes from cdnjs (UMD globals), so it isn't bundled.
const globals = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' };
const result = await build({
  entryPoints: [join(root, 'src/preview/club-preview.tsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  target: 'es2020',
  // Classic React.createElement against the cdnjs React global (the repo's tsconfig asks for React 19's jsx runtime).
  tsconfigRaw: { compilerOptions: { jsx: 'react', jsxFactory: 'React.createElement', jsxFragmentFactory: 'React.Fragment' } },
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  define: {
    'import.meta.env': JSON.stringify({ PUBLIC_CLUB_ENABLED: 'true', PUBLIC_ACCOUNTS_ENABLED: 'false', PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '', DEV: false }),
  },
  plugins: [{
    name: 'umd-globals',
    setup(b) {
      b.onResolve({ filter: /^(react|react-dom|react-dom\/client)$/ }, (a) => ({ path: a.path, namespace: 'umd' }));
      b.onLoad({ filter: /.*/, namespace: 'umd' }, (a) => ({ contents: `module.exports = window.${globals[a.path]};`, loader: 'js' }));
    },
  }],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const page = `<title>Family Club Preview</title>
<meta name="robots" content="noindex">
<style>
html, body { background: #fffdfa; color: #4d4544; }
${css}
</style>
<div id="club-preview"></div>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>window.__CLUB_IMAGES = ${JSON.stringify(images)};</script>
<script>${js}</script>
`;
writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB: ${cssFiles.size} stylesheets, ${Object.keys(images).length} illustrations)`);
