/**
 * iPhone app bootstrap, loaded only by app-bundle builds (PUBLIC_APP_SHELL=ios) from AppLayout and ClubLayout.
 * On the website this file isn't on the page at all; in a desktop browser preview of the app bundle it does
 * nothing (no native bridge).
 *
 * 1. Links: our pages that aren't bundled (shop, calendar product page, Club offer, billing, support, articles)
 *    and other sites open in an in-app Safari sheet; nothing is sold inside the app.
 * 2. Storage: localStorage writes are mirrored to native storage and restored after iOS clears them.
 * 3. Lifecycle: returning to the foreground fires `omc:app:resume` (and `focus`, which today's screens
 *    already listen to) so "today" rolls over at midnight.
 */
import { classifyLink } from './links';
import { mirrorWrites, restore, seed, type Mirror } from './durable-storage';
import { APP_RESUME_EVENT, isNativeApp } from './platform';

const SEEDED_FLAG = 'meta:seeded'; // not an omc: key, so it's never restored into localStorage

async function openOnWeb(url: string) {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function interceptLinks() {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute('download')) return;
      const action = classifyLink(a.getAttribute('href') ?? '', location.href);
      if (action.kind === 'default') return;
      e.preventDefault();
      if (action.kind === 'in-app') location.assign(action.href);
      else void openOnWeb(action.url);
    },
    true,
  );
}

async function durableStorage() {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.configure({ group: 'omc' });
  const mirror: Mirror = {
    get: async (key) => (await Preferences.get({ key })).value,
    set: (key, value) => Preferences.set({ key, value }),
    remove: (key) => Preferences.remove({ key }),
    keys: async () => (await Preferences.keys()).keys,
  };
  const restored = await restore(localStorage, mirror);
  if ((await mirror.get(SEEDED_FLAG)) !== '1') {
    await seed(localStorage, mirror);
    await mirror.set(SEEDED_FLAG, '1');
  }
  mirrorWrites(localStorage, mirror);
  // Screens read storage when they mount; after a restore, show them the restored copy.
  if (restored > 0) location.reload();
}

async function lifecycle() {
  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    window.dispatchEvent(new Event(APP_RESUME_EVENT));
    window.dispatchEvent(new Event('focus'));
  });
}

if (isNativeApp()) {
  document.documentElement.classList.add('omc-native');
  interceptLinks();
  void durableStorage().catch(() => {
    /* No native storage: the app keeps working on localStorage alone, like Safari. */
  });
  void lifecycle().catch(() => {});
}
