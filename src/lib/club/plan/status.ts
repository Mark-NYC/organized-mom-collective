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

export function readApproval(key: string, planFor: string | undefined): Approval | null {
  try {
    const a = JSON.parse(tabStorage.get(key) ?? 'null') as Approval | null;
    return a && a.for === planFor ? a : null;
  } catch {
    return null;
  }
}

export const writeApproval = (key: string, a: Approval | null) => (a ? tabStorage.set(key, JSON.stringify(a)) : tabStorage.remove(key));

export const approvalState = (a: Approval | null, fingerprint: string): ApprovalState => (!a ? 'none' : a.print === fingerprint ? 'approved' : 'changed');

export const approvalDay = (a: Approval | null) => (a ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(a.at)) : '');

/** Now, or in development the ?preview-date= override, for checking the editing cutoff. */
export function planNow() {
  const d = import.meta.env.DEV ? new URLSearchParams(location.search).get('preview-date') : null;
  return d ? new Date(d) : new Date();
}
