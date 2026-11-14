/**
 * Is this page running inside the iPhone app? Capacitor's native bridge defines window.Capacitor before any page
 * script runs. Nothing here imports Capacitor, so the website never loads it.
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export function isNativeApp(): boolean {
  try {
    const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Built for the app bundle (npm run build:app). Pages may show app-only UI even before the bridge answers. */
export const appShellBuild = () => import.meta.env.PUBLIC_APP_SHELL === 'ios';

/** Fired on the window when the app returns to the foreground, so screens can refresh "today". */
export const APP_RESUME_EVENT = 'omc:app:resume';
