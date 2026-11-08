/**
 * Approval and "now" for a Club plan page, shared by the mobile plan screen (screen.ts) and the desktop rail
 * (desktop.ts), so both sides of one page read the same approval.
 *
 * Approval is a prototype: kept in this tab (sessionStorage) against the printable's fingerprint, for the family
 * the page is prepared for (production: approved_revision). Mail by default: approval means "we've checked it",
 * never a condition for receiving the resource.
 */
import { tabStorage } from './storage';

export type Approval = { for: string; print: string; at: string };
export type ApprovalState = 'none' | 'approved' | 'changed';

/**
 * Where an approval lives when it isn't this tab's check mark: the Welcome Family Rhythm keeps hers on her account
 * (club_welcome_plans, through ./account.ts). Registered for one approval key by the page; every other key, and every
 * sample or preview, stays in the tab.
 */
export interface ApprovalStore {
  read(planFor: string | undefined): Approval | null;
  write(a: Approval | null): void;
}
const stores = new Map<string, ApprovalStore>();
export const setApprovalStore = (key: string, store: ApprovalStore | null) => (store ? stores.set(key, store) : stores.delete(key));

export function readApproval(key: string, planFor: string | undefined): Approval | null {
  const store = stores.get(key);
  if (store) return store.read(planFor);
  try {
    const a = JSON.parse(tabStorage.get(key) ?? 'null') as Approval | null;
    return a && a.for === planFor ? a : null;
  } catch {
    return null;
  }
}

export const writeApproval = (key: string, a: Approval | null) => {
  const store = stores.get(key);
  if (store) return store.write(a);
  return a ? tabStorage.set(key, JSON.stringify(a)) : tabStorage.remove(key);
};

export const approvalState = (a: Approval | null, fingerprint: string): ApprovalState => (!a ? 'none' : a.print === fingerprint ? 'approved' : 'changed');

export const approvalDay = (a: Approval | null) => (a ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(a.at)) : '');

/** Now, or in development the ?preview-date= override, for checking the editing cutoff. */
export function planNow() {
  const d = import.meta.env.DEV ? new URLSearchParams(location.search).get('preview-date') : null;
  return d ? new Date(d) : new Date();
}
