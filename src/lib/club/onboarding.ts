/**
 * Where a member goes next, from what the database already says (club_me): one answer for /club/welcome, /club/login,
 * the dashboard and the Welcome Kit progress. Nothing here is stored; refreshing or coming back later lands on the
 * same step. The Welcome Kit (supabase/migrations/20261108000000_club_welcome_kit.sql) is her welcome print and her
 * first month's resource, approved together and mailed in one package; `welcome.readiness` is the kit's.
 */
import type { Membership, MembershipMonth } from './membership';
import { routes } from '../../routes';
import { memberPlanHref } from './plan/account';
import { accountRpc } from '../account';

/**
 * Her setup, in order: family (step 1 of the family profile), the rest of the profile (steps 2–6, each optional),
 * mailing address, then her Welcome Kit: approve the print, then look over and confirm her first month's resource.
 * 'profile' only when the caller passes her profile (club_me doesn't carry it) and she hasn't finished it or chosen
 * "Finish later" on this device.
 */
export type OnboardingStep = 'not_member' | 'family' | 'profile' | 'address' | 'print' | 'meeting_guide' | 'first_resource' | 'home';

/** What nextStep needs to know about her family profile (src/lib/club/family-profile.ts). */
export interface StepOptions {
  profile?: { setupCompleted: boolean } | null;
  /** She picked "Finish later" (deferProfile) on this device. */
  profileDeferred?: boolean;
  /** She has looked at the Family Meeting guide (loadMeetingGuideSeen). Only `false` adds the step; it never holds the kit. */
  meetingGuideSeen?: boolean;
}

const GUIDE = 'omc:club:meeting-guide-seen:';
/** Whether she has reviewed the Family Meeting guide: her account (20261110), else this device (before that migration). */
export async function loadMeetingGuideSeen(userId: string | null | undefined): Promise<boolean> {
  try {
    return Boolean(await accountRpc<string | null>('club_meeting_guide_seen'));
  } catch {
    try { return Boolean(userId && localStorage.getItem(GUIDE + userId)); } catch { return false; }
  }
}
export async function markMeetingGuideSeen(userId: string | null | undefined): Promise<void> {
  try { if (userId) localStorage.setItem(GUIDE + userId, '1'); } catch { /* fine */ }
  await accountRpc('club_meeting_guide_mark').catch(() => undefined);
}

const LATER = 'omc:club:profile-later:';
/** "Finish later": remembered per account on this device, so she isn't sent back into the questions every visit. */
export function profileDeferred(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(LATER + userId) === '1';
  } catch {
    return false;
  }
}
export function deferProfile(userId: string | null | undefined) {
  if (!userId) return;
  try {
    localStorage.setItem(LATER + userId, '1');
  } catch {
    /* private mode: she's asked again next visit, nothing lost */
  }
}

/**
 * A member whose membership has no month yet: her free first month wasn't available (one per household) so it starts
 * with her first payment, which brings that month and her Welcome Kit. Nothing is granted early.
 */
export function startsWithFirstPayment(me: Membership): boolean {
  return Boolean(me.member && me.access && me.months.length === 0 && !me.welcome && me.next?.payment_on);
}

/** Her first month: the one her Welcome Kit carries (the household's first paid month). */
export function firstMonth(me: Pick<Membership, 'months' | 'first_paid_month'>): MembershipMonth | null {
  return me.months.find((m) => m.month === me.first_paid_month && m.fulfilled_by === 'monthly_resource') ?? null;
}

/** Her kit still asks something of her (print or first resource) and nothing has gone to print yet. */
const open = (me: Membership) => Boolean(me.welcome && ['pending', 'on_hold'].includes(me.welcome.status));

export function nextStep(me: Membership, opts: StepOptions = {}): OnboardingStep {
  if (!me.member && !me.grant) return 'not_member';
  if (!me.onboarded) return 'family';
  if (opts.profile && !opts.profile.setupCompleted && !opts.profileDeferred) return 'profile';
  if (!me.has_address) return 'address';
  if (open(me) && !me.welcome!.approved) return 'print';
  const confirm = open(me) && me.welcome!.readiness === 'needs_confirmation' && Boolean(firstMonth(me)?.slug);
  if (confirm && opts.meetingGuideSeen === false) return 'meeting_guide';
  if (confirm) return 'first_resource';
  return 'home';
}

/** What her first month's tool shows about her Welcome Kit (WelcomeKitConfirm). 'done': she just confirmed it. */
export type WelcomeKitView = 'none' | 'print_first' | 'confirm' | 'done';

export function welcomeKitView(me: Membership, kitSlug: string): WelcomeKitView {
  const first = firstMonth(me);
  const w = me.welcome;
  if (!w || !first || first.slug !== kitSlug || first.can !== 'edit' || w.satisfies_month) return 'none';
  if (!['pending', 'on_hold'].includes(w.status)) return 'none';
  if (!w.approved) return 'print_first';
  return w.readiness === 'needs_confirmation' ? 'confirm' : 'none';
}

/** The page for a step. */
export function stepHref(me: Membership, step = nextStep(me)): string {
  switch (step) {
    case 'family':
    case 'profile':
    case 'address':
    case 'not_member':
      return routes.clubWelcome;
    case 'print':
      return routes.clubFamilyVision;
    case 'meeting_guide':
      return routes.clubMeetingGuide;
    case 'first_resource':
      // Her month's real tool (/app/club/<month>), where she looks it over and confirms it (WelcomeKitConfirm).
      return `${memberPlanHref(firstMonth(me)!.slug!)}?welcome=1`;
    default:
      // Club Home (/app/club): her family, her Welcome Kit, her months. Billing and address: /club/dashboard.
      return routes.appClub;
  }
}

/** The five steps she sees: family, address, print, the Family Meeting guide, her first resource. 'done': submitted. */
export type KitProgress = { label: string; state: 'done' | 'current' | 'next' }[];
export type KitStage = 'family' | 'address' | 'print' | 'meeting_guide' | 'first_resource' | 'done';
export function kitProgress(current: KitStage): KitProgress {
  const order = ['family', 'address', 'print', 'meeting_guide', 'first_resource'] as const;
  const labels = { family: 'Your family', address: 'Your address', print: 'Your print', meeting_guide: 'Meeting guide', first_resource: 'Your first resource' };
  if (current === 'done') return order.map((s) => ({ label: labels[s], state: 'done' as const }));
  const at = order.indexOf(current);
  return order.map((s, i) => ({ label: labels[s], state: i < at ? 'done' : i === at ? 'current' : 'next' }));
}

/**
 * The Welcome Kit in her words, from its status and readiness (the same answer for both items). Never says it
 * shipped before it was marked mailed.
 */
export function kitText(me: Pick<Membership, 'welcome'>): string {
  const w = me.welcome;
  if (!w) return '';
  if (w.status === 'mailed') return 'Your Welcome Kit is in the mail.';
  if (w.status === 'printed') return 'Your Welcome Kit is printed and getting ready to mail.';
  if (w.status === 'approved') return 'Your Welcome Kit is approved for print.';
  if (w.status === 'returned') return 'Your Welcome Kit came back to us. Check your mailing address.';
  return ({
    needs_profile: 'Add your family to start your Welcome Kit.',
    needs_address: 'Add your mailing address so we can mail your Welcome Kit.',
    mail_paused: 'Printed mailings are paused, so your Welcome Kit is waiting.',
    needs_vision: 'Your welcome print is ready for you to approve.',
    needs_resource: 'Your print is approved. We’re finishing your first resource.',
    needs_confirmation: 'Your print is approved. Take a quick look at your first resource and confirm it.',
    needs_pdf: 'Submitted. We aim to print and mail your Welcome Kit within two business days.',
    ready: 'Submitted. We aim to print and mail your Welcome Kit within two business days.',
    first_month_canceled: 'We’re looking at your Welcome Kit. Reply to any of our emails with questions.',
  } as Record<string, string>)[w.readiness] ?? 'We’re preparing your Welcome Kit.';
}

/** "The Rivera Family" from the name on her mailing address ("Ana Rivera"), when it has a surname; else ''. */
export function familyNameFrom(addressName: string | null | undefined): string {
  const parts = (addressName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  const last = parts[parts.length - 1].replace(/[^\p{L}'’-]/gu, '');
  if (!last || last.length > 30) return '';
  return `The ${last.charAt(0).toUpperCase()}${last.slice(1)} Family`;
}
