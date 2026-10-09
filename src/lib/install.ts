/**
 * "Add to Home Screen": which instructions to show, whether to invite at all,
 * and carrying progress from Safari into the iPhone Home Screen app.
 *
 * Browser support (2026):
 *   - Android Chrome / Edge / Samsung Internet fire `beforeinstallprompt`, so we can offer a real Install button.
 *   - iPhone has no install API; people use Share → Add to Home Screen (Safari, and other iOS browsers since iOS 16.4).
 *   - On iPhone the Home Screen app gets its OWN storage, separate from Safari. Cache Storage is shared,
 *     so we leave a snapshot there for the installed app to pick up on first launch (best effort).
 */
import { exportProgress, importMissing, hasAnyProgress, readFlag, writeFlag } from './storage';

export type Platform = 'ios-safari' | 'ios-other' | 'android' | 'other';

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function currentPlatform(): Platform {
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

/** Already opened from the Home Screen. */
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export interface InstallGuide {
  steps: string[];
  note?: string;
}

export function installGuide(platform: Platform): InstallGuide {
  switch (platform) {
    case 'ios-safari':
      return {
        steps: [
          'Tap the Share button (the square with an arrow). On newer iPhones, tap ••• first, then Share.',
          'Scroll down and tap Add to Home Screen.',
          'Tap Add. If you see Open as Web App, leave it on.',
        ],
        note: 'iPhone keeps the Home Screen app separate from Safari, so open it from the new icon from now on.',
      };
    case 'ios-other':
      return {
        steps: ['Tap the Share button in your browser.', 'Tap Add to Home Screen, then Add.'],
        note: 'Don’t see it? Open organizedmomcollective.com/app in Safari and add it from there.',
      };
    case 'android':
      return {
        steps: ['Tap your browser’s menu (⋮).', 'Tap Install app or Add to home screen.', 'Tap Install.'],
      };
    default:
      return { steps: ['Open organizedmomcollective.com/app on your phone and add it to your Home Screen from there.'] };
  }
}

/* --- The invitation: shown after a checkmark, until she dismisses it or installs. --- */

const INVITE_FLAG = 'install-invite';

export function inviteDismissed(): boolean {
  return readFlag(INVITE_FLAG) === 'dismissed';
}

export function dismissInvite(): void {
  writeFlag(INVITE_FLAG, 'dismissed');
}

/** Only on phones, only in the browser, and only where progress can actually be saved. */
export function shouldOfferInstall(platform: Platform, standalone: boolean, saving: boolean): boolean {
  return platform !== 'other' && !standalone && saving && !inviteDismissed();
}

/* --- Android: the browser's own install prompt, captured early in AppLayout. --- */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PromptWindow = Window & { __omcInstallPrompt?: InstallPromptEvent | null };

export function installPromptAvailable(): boolean {
  return !!(window as PromptWindow).__omcInstallPrompt;
}

/** Shows the browser's install dialog. Resolves true if she installed. */
export async function promptInstall(): Promise<boolean> {
  const w = window as PromptWindow;
  const e = w.__omcInstallPrompt;
  if (!e) return false;
  w.__omcInstallPrompt = null; // each prompt can only be used once
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

/* --- iPhone: carry progress from Safari to the Home Screen app. --- */

const HANDOFF_CACHE = 'omc-handoff';
const HANDOFF_URL = '/app/__handoff';

/** Leave a copy of this browser's progress where the iPhone Home Screen app can find it. */
export async function saveHandoff(): Promise<void> {
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open(HANDOFF_CACHE);
    await cache.put(HANDOFF_URL, new Response(JSON.stringify(exportProgress()), { headers: { 'content-type': 'application/json' } }));
  } catch {
    /* best effort */
  }
}

/**
 * First launch of the Home Screen app with nothing saved yet: bring in the copy
 * left by Safari. Never overwrites anything already saved here.
 */
export async function restoreHandoff(): Promise<number> {
  try {
    if (!('caches' in window) || hasAnyProgress()) return 0;
    const res = await caches.match(HANDOFF_URL, { cacheName: HANDOFF_CACHE });
    if (!res) return 0;
    const data: unknown = await res.json();
    return data && typeof data === 'object' ? importMissing(data as Record<string, unknown>) : 0;
  } catch {
    return 0;
  }
}
