#!/usr/bin/env node
/**
 * npm run build:app — the iPhone app bundle (docs/ios/OMC_APP_ROADMAP.md → 2.1).
 *
 * 1. astro build with astro.app.config.mjs → dist-app/ (the website's dist/ is never touched), with the app flags on
 *    for this build only: PUBLIC_APP_SHELL=ios (native bridge, no GA/Pinterest), PUBLIC_CLUB_ENABLED and
 *    PUBLIC_ACCOUNTS_ENABLED (members sign in inside the app). Whether anyone can actually open a Club month is still
 *    decided by the server (entitlements, RLS); nothing here sells anything.
 * 2. scripts/build-app-shell.mjs → app-www/ (allowlisted member pages and only the files they use, plus checks).
 *
 * Asset preparation runs first via `npm run prepare:assets` (package.json).
 */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  PUBLIC_APP_SHELL: 'ios',
  PUBLIC_CLUB_ENABLED: 'true',
  PUBLIC_ACCOUNTS_ENABLED: 'true',
  // The app never offers checkout; the Club's offer page isn't bundled either.
  PUBLIC_CLUB_CHECKOUT_ENABLED: 'false',
  PUBLIC_SHOP_ENABLED: 'false',
};

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npx', ['astro', 'build', '--config', 'astro.app.config.mjs']);
run(process.execPath, ['scripts/build-app-shell.mjs']);
