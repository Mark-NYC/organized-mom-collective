/**
 * V20 household notifications in the browser (docs/ios/V20_LAUNCH.md): Web Push for the website and the installed
 * PWA. The rules that decide WHAT to send are src/lib/v20/notify.ts (the locked notification rules); this file only
 * subscribes this device for the signed-in adult, queues what the rules decided (the database dedupes per household,
 * so two phones computing the same notification send it once), and reads a tapped notification back.
 *
 * The native iPhone app needs APNs instead (not part of the web launch; docs/ios/V20_LAUNCH.md → Native).
 */
import { accountRpc } from '../account';
import type { PushNote } from './notify';

/** The VAPID public key (public by design; the private key is a Supabase Edge Function secret). */
export const VAPID_PUBLIC_KEY = 'BPr0Nt4jZDDcBxPmDLesx-wxnma5JHm617yElP-qKKHeobgecyT2rhPZ-d8RWAmOzYu_eaVPXnzxSOe4ZjWCG1Q';

export type PushSupport = 'supported' | 'unsupported' | 'denied' | 'install-first';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  // iPhone Safari delivers web notifications only to an app added to the Home Screen.
  if (!('PushManager' in window) || typeof Notification === 'undefined') return ios && !standalone ? 'install-first' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'supported';
}

const key = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '');

async function registration() {
  const reg = (await navigator.serviceWorker.getRegistration('/app')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/app' }));
  await navigator.serviceWorker.ready;
  return reg;
}

/** Is this device already receiving this adult's notifications? */
export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/app');
  return Boolean(await reg?.pushManager.getSubscription());
}

/** Ask once (only when the adult chooses to turn notifications on), then register this device. */
export async function enablePush(): Promise<'on' | 'denied' | 'unsupported' | 'error'> {
  if (pushSupport() !== 'supported') return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC_KEY) }));
    await accountRpc('household_push_subscribe', { p_endpoint: sub.endpoint, p_p256dh: b64(sub.getKey('p256dh')), p_auth: b64(sub.getKey('auth')) });
    return 'on';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/app');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await accountRpc('household_push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** A local date and time ('YYYY-MM-DD', 'HH:MM') on this device, as an instant. */
const instant = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

/** What the rules decided to send (delivered now, held for quiet hours, or scheduled) → the household's queue. */
export function queueItems(notes: PushNote[]) {
  return notes.filter((n) => n.status === 'deliver' || n.status === 'quiet' || n.status === 'held' || n.status === 'scheduled').map((n) => ({
    key: n.key, to: n.to, purpose: n.purpose, kind: n.kind, title: n.title.slice(0, 120), body: n.body.slice(0, 240),
    deliver_after: n.status === 'held' || n.status === 'scheduled' ? instant(n.at.date, n.at.time) : null,
    data: { actions: n.actions, partId: n.partId ?? null, insightKey: n.insightKey ?? null, insightFp: n.insightFp ?? null, urgent: n.urgent },
  }));
}

export async function queueNotifications(household: string, notes: PushNote[]): Promise<number> {
  const items = queueItems(notes);
  if (!items.length) return 0;
  const r = await accountRpc<{ added: number }>('household_notify', { p_household: household, p_items: items.slice(0, 20) });
  return r.added;
}

export interface TappedNotification { id: string; kind: PushNote['kind']; purpose: PushNote['purpose']; title: string; body: string; to: string; data: { partId?: string | null; insightKey?: string | null; insightFp?: string | null } }
export const readNotification = (id: string) => accountRpc<TappedNotification | null>('household_notification', { p_id: id });

/** The notification this page was opened from (?notification=…&action=…), once. */
export function tappedFromUrl(): { id: string; action: string } | null {
  if (typeof location === 'undefined') return null;
  const u = new URL(location.href);
  const id = u.searchParams.get('notification');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const action = u.searchParams.get('action') ?? 'open';
  u.searchParams.delete('notification'); u.searchParams.delete('action');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  return { id, action };
}
