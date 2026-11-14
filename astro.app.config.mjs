/**
 * The iPhone app bundle's build (npm run build:app; docs/ios/OMC_APP_ROADMAP.md → 2.1). Same source and settings as
 * the website (astro.config.mjs), with three differences: output in dist-app/ (never dist/, which Cloudflare deploys),
 * no service worker precache (the app's files are inside the app), no Cloudflare _redirects. The app flags
 * (PUBLIC_APP_SHELL, PUBLIC_CLUB_ENABLED, PUBLIC_ACCOUNTS_ENABLED) are set by scripts/build-app.mjs for this build
 * only. scripts/build-app-shell.mjs then copies just the member pages into app-www/.
 */
import base from './astro.config.mjs';

export default {
  ...base,
  outDir: './dist-app',
  integrations: (base.integrations ?? []).filter(
    (i) => i && typeof i === 'object' && 'name' in i && !['omc-offline-precache', 'omc-cloudflare-redirects'].includes(i.name),
  ),
};
