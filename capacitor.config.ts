import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iPhone app (docs/ios/OMC_APP_ROADMAP.md). webDir is the allowlisted member bundle from `npm run build:app`,
 * never dist/ (the website). The app serves it from capacitor://localhost; ios/App/App/OMCRouter.swift maps Astro's
 * folder pages (/app/cleaning → app/cleaning/index.html).
 */
const config: CapacitorConfig = {
  appId: 'com.organizedmomcollective.app',
  appName: 'Organized Mom',
  webDir: 'app-www',
  ios: {
    // Pages handle the notch and home bar themselves (viewport-fit=cover + env(safe-area-inset-*)).
    contentInset: 'never',
    backgroundColor: '#fffdfa',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    // No Capacitor HTTP or cookie patching: the pages call Supabase with fetch, exactly as on the website.
    CapacitorHttp: { enabled: false },
  },
};

export default config;
