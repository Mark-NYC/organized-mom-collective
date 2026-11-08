/**
 * Where a member goes next, from what the database already says (club_me): one answer for /club/welcome, /club/login,
 * the dashboard and the Welcome Kit progress. Nothing here is stored; refreshing or coming back later lands on the
 * same step. The Welcome Kit (supabase/migrations/20261108000000_club_welcome_kit.sql) is her welcome print and her
 * first month's resource, approved together and mailed in one package; `welcome.readiness` is the kit's.
 */
import type { Membership, MembershipMonth } from './membership';
import { welcomeIsRhythm } from './welcome-item';
export { welcomeIsRhythm };
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
  // The Family Meeting guide is the same sheet for everyone: she can preview it from her Welcome Kit, but it is never
  // a step she has to take. ('meeting_guide' stays in the type for old links; nextStep no longer returns it.)
  if (open(me) && me.welcome!.readiness === 'needs_confirmation' && Boolean(firstMonth(me)?.slug)) return 'first_resource';
  return 'home';
}

/** What her first month's tool shows about her Welcome Kit (WelcomeKitConfirm). */
export type WelcomeKitView = 'none' | 'print_first' | 'confirm';

export function welcomeKitView(me: Membership, kitSlug: string): WelcomeKitView {
  const first = firstMonth(me);
  const w = me.welcome;
  if (!w || !first || first.slug !== kitSlug || first.can !== 'edit' || w.satisfies_month) return 'none';
  if (!['pending', 'on_hold'].includes(w.status)) return 'none';
  if (!w.approved) return 'print_first';
  return w.readiness === 'needs_confirmation' ? 'confirm' : 'none';
}

/** Her first month's real tool in Welcome Kit mode (/app/club/<month>?welcome=1), where she reviews and approves it. */
export function firstResourceHref(me: Pick<Membership, 'months' | 'first_paid_month'>): string | null {
  const first = firstMonth(me);
  return first?.slug ? `${memberPlanHref(first.slug)}?welcome=1` : null;
}

/** The page for a step. Every Welcome Kit step resumes on the Welcome Kit page, which shows all three pieces. */
export function stepHref(me: Membership, step = nextStep(me)): string {
  switch (step) {
    case 'family':
    case 'profile':
    case 'address':
    case 'not_member':
      return routes.clubWelcome;
    case 'print':
    case 'meeting_guide':
    case 'first_resource':
      return routes.clubWelcomeKit;
    default:
      // Club Home (/app/club): her family, her Welcome Kit, her months. Billing and address: /club/dashboard.
      return routes.appClub;
  }
}

// ------------------------------------------------------------------ one journey, three phases

/**
 * The one journey she sees, from checkout to a submitted Welcome Kit: 1. Tell us about your family (the questionnaire
 * and mailing address), 2. Make it yours (her three printed pieces), 3. Confirm your Welcome Kit (all three together,
 * the address, then "Prepare My Welcome Kit"). The questionnaire keeps its own "Step n of 6" inside phase 1.
 */
export const JOURNEY = [
  { id: 'family', label: 'Tell us about your family', short: 'Your family' },
  { id: 'make', label: 'Make it yours', short: 'Make it yours' },
  { id: 'confirm', label: 'Confirm your Welcome Kit', short: 'Confirm' },
] as const;
export type KitProgress = { label: string; short: string; state: 'done' | 'current' | 'next' }[];
/** Where she is: the setup steps are phase 1, the kit's pieces phase 2, the kit page with everything ready phase 3. */
export type KitStage = 'family' | 'address' | 'print' | 'meeting_guide' | 'first_resource' | 'confirm' | 'done';
export function journeyPhase(stage: KitStage): 0 | 1 | 2 | 3 {
  if (stage === 'family' || stage === 'address') return 0;
  if (stage === 'confirm') return 2;
  if (stage === 'done') return 3;
  return 1;
}
export function kitProgress(current: KitStage): KitProgress {
  const at = journeyPhase(current);
  return JOURNEY.map((p, i) => ({ label: p.label, short: p.short, state: i < at ? 'done' : i === at ? 'current' : 'next' }));
}

// ------------------------------------------------------------------ her three printed pieces

const REVIEWED = 'omc:club:kit-reviewed:';
/**
 * She approved her first month on its tool ("Approve for printing"): remembered on this device until she changes the
 * plan again. The approval the database records is the Welcome Kit's one "Prepare My Welcome Kit"
 * (club_fulfillment_approve), so nothing is approved twice, and on a new device she looks it over once more.
 */
export function markFirstResourceReviewed(slug: string, userId?: string | null) {
  try { localStorage.setItem(`${REVIEWED}${userId ?? ''}:${slug}`, new Date().toISOString()); } catch { /* fine */ }
}
export function clearFirstResourceReviewed(slug: string, userId?: string | null) {
  try { localStorage.removeItem(`${REVIEWED}${userId ?? ''}:${slug}`); } catch { /* fine */ }
}
export function firstResourceReviewed(slug: string | null | undefined, userId?: string | null): boolean {
  if (!slug) return false;
  try { return Boolean(localStorage.getItem(`${REVIEWED}${userId ?? ''}:${slug}`)); } catch { return false; }
}

export type KitItemStatus = 'ready' | 'needs_review' | 'approved' | 'preparing';
export const KIT_ITEM_STATUS: Record<KitItemStatus, string> = {
  ready: 'Ready',
  needs_review: 'Needs review',
  approved: 'Approved',
  preparing: 'We’re finishing it',
};
export interface KitItem {
  id: 'print' | 'guide' | 'first';
  name: string;
  about: string;
  status: KitItemStatus;
  /** The printable's own page: preview, edit or approve it there. */
  href: string;
  action: string;
}

/** Her Welcome Kit has gone in (both approvals received), from the queue's status and readiness. */
export function kitSubmitted(me: Pick<Membership, 'welcome'>): boolean {
  const w = me.welcome;
  if (!w || !w.approved) return false;
  if (['approved', 'printed', 'mailed'].includes(w.status)) return true;
  return ['needs_pdf', 'ready'].includes(w.readiness);
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthWord = (iso: string) => MONTHS_LONG[Number(iso.slice(5, 7)) - 1] ?? 'First';

/**
 * Her Welcome Kit's three printed pieces and what each needs from her. `reviewed`: she approved her first month on
 * its tool on this device (firstResourceReviewed). `title`: the printed resource's name (src/data/club/resources.ts).
 * The Family Meeting guide is the same for every family, so it is simply Ready.
 */
export function kitItems(me: Membership, reviewed: boolean, title: (slug: string | null) => string | null = () => null): KitItem[] {
  const w = me.welcome;
  const first = firstMonth(me);
  const submitted = kitSubmitted(me);
  const month = first ? monthWord(first.month) : 'First';
  const firstHref = firstResourceHref(me);
  const printApproved = Boolean(w?.approved);
  const firstStatus: KitItemStatus = submitted ? 'approved'
    : !first?.slug || w?.readiness === 'needs_resource' ? 'preparing'
    : reviewed ? 'approved' : 'needs_review';
  return [
    welcomeIsRhythm(me) ? {
      id: 'print', name: 'Your Family Rhythm', about: 'Two moments your family already shares, and everyone’s part in them. Yours to use today.',
      status: printApproved ? 'approved' : 'needs_review', href: kitStepHref(me, 'print'),
      action: printApproved ? (submitted ? 'View' : 'View or change') : 'Look it over',
    } : {
      id: 'print', name: 'Family Vision Print', about: 'A watercolor keepsake with your family name and the value you chose.',
      status: printApproved ? 'approved' : 'needs_review', href: routes.clubFamilyVision,
      action: printApproved ? (submitted ? 'View' : 'View or change') : 'Make it yours',
    },
    {
      id: 'guide', name: 'Family Meeting Guide', about: 'A one-page guide to short, practical family meetings. The same for every family.',
      status: 'ready', href: routes.clubMeetingGuide, action: 'Preview',
    },
    {
      id: 'first', name: `${month} Resource`, about: `${title(first?.slug ?? null) ?? 'Your first monthly resource'}, prepared with your family’s names.`,
      status: firstStatus,
      href: !submitted && firstHref ? firstHref : first?.slug ? memberPlanHref(first.slug) : routes.appClub,
      action: firstStatus === 'approved' ? (submitted ? 'View' : 'Review again') : firstStatus === 'needs_review' ? 'Review & edit' : 'Preview',
    },
  ];
}

/**
 * Where her membership is, for Club Home: setting up, her Welcome Kit (almost ready, getting ready, on its way), or the
 * ongoing membership. Never says shipped before the kit is marked mailed. Nothing here knows about delivery, so a
 * mailed kit stays "on its way" for three weeks and then gives way to her months.
 */
export type HomeState = 'setup' | 'starts' | 'kit_open' | 'kit_submitted' | 'kit_mailed' | 'ongoing';
export function homeState(me: Membership, step: OnboardingStep, now = Date.now()): HomeState {
  if (step === 'family' || step === 'profile' || step === 'address') return 'setup';
  if (startsWithFirstPayment(me)) return 'starts';
  const w = me.welcome;
  if (!w || w.satisfies_month || ['canceled', 'skipped', 'returned'].includes(w.status)) return 'ongoing';
  if (w.status === 'mailed') {
    const at = w.mailed_at ? Date.parse(w.mailed_at) : NaN;
    return Number.isFinite(at) && now - at > 21 * 864e5 ? 'ongoing' : 'kit_mailed';
  }
  if (kitSubmitted(me)) return 'kit_submitted';
  if (['pending', 'on_hold'].includes(w.status)) return 'kit_open';
  return 'ongoing';
}

/**
 * The Welcome Kit in her words, from its status and readiness (the same answer for both items). Never says it
 * shipped before it was marked mailed.
 */
export function kitText(me: Pick<Membership, 'welcome'>): string {
  const w = me.welcome;
  if (!w) return '';
  const item = welcomeIsRhythm(me) ? 'Family Rhythm' : 'print';
  if (w.status === 'mailed') return 'Your Welcome Kit is on its way.';
  if (w.status === 'printed') return 'Your Welcome Kit is printed and getting ready to mail.';
  if (w.status === 'approved') return 'Your Welcome Kit is ready for printing.';
  if (w.status === 'returned') return 'Your Welcome Kit came back to us. Check your mailing address.';
  return ({
    needs_profile: 'Add your family to start your Welcome Kit.',
    needs_address: 'Add your mailing address so we can mail your Welcome Kit.',
    mail_paused: 'Printed mailings are paused, so your Welcome Kit is waiting.',
    needs_vision: 'Your welcome print is ready for you to approve.',
    needs_rhythm: 'Your Family Rhythm is ready for you to look over and approve.',
    needs_resource: `Your ${item} is approved. We’re finishing your first resource.`,
    needs_confirmation: `Your ${item} is approved. Review your first resource, then prepare your Welcome Kit.`,
    needs_pdf: 'Your package is getting ready. We aim to print and mail it within two business days.',
    ready: 'Your package is getting ready. We aim to print and mail it within two business days.',
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

// ------------------------------------------------------------------ the three pieces as steps, in order

/** Her Welcome Kit's pieces in the order she's walked through them: print, guide, first month, then the kit. */
export type KitStepId = 'print' | 'guide' | 'first';
export const KIT_ORDER: KitStepId[] = ['print', 'guide', 'first'];
export interface KitFlags { reviewed: boolean; guideSeen: boolean }

/** A piece is done: the print approved, the guide opened (it needs nothing else), the month approved for printing. */
export function kitStepDone(me: Membership, id: KitStepId, f: KitFlags): boolean {
  if (kitSubmitted(me)) return true;
  if (id === 'print') return Boolean(me.welcome?.approved);
  if (id === 'guide') return f.guideSeen;
  // A month we're still finishing can't be reviewed yet: never send her there as a step.
  return f.reviewed || !firstMonth(me)?.slug || me.welcome?.readiness === 'needs_resource';
}

export function kitStepHref(me: Membership, id: KitStepId): string {
  if (id === 'print') return welcomeIsRhythm(me) ? `${routes.appClubFamilyRhythm}?welcome=1` : routes.clubFamilyVision;
  if (id === 'guide') return routes.clubMeetingGuide;
  return firstResourceHref(me) ?? routes.clubWelcomeKit;
}

export function kitStepName(me: Membership, id: KitStepId): string {
  if (id === 'print') return welcomeIsRhythm(me) ? 'Family Rhythm' : 'Family Vision Print';
  if (id === 'guide') return 'Family Meeting Guide';
  const first = firstMonth(me);
  return `${first ? monthWord(first.month) : 'First'} Resource`;
}

/**
 * Where "Next" goes after a piece: the next piece in order that still needs her (wrapping to an earlier one she
 * skipped), else her Welcome Kit to confirm it, carrying ?done=<piece> for the "✓ … approved" note there.
 */
export function kitNext(me: Membership, after: KitStepId, f: KitFlags): { href: string; label: string; id: KitStepId | 'kit' } {
  const at = KIT_ORDER.indexOf(after);
  const rest = [...KIT_ORDER.slice(at + 1), ...KIT_ORDER.slice(0, at)];
  const next = rest.find((id) => !kitStepDone(me, id, f));
  if (next) return { href: kitStepHref(me, next), label: `Next: ${kitStepName(me, next)}`, id: next };
  return { href: `${routes.clubWelcomeKit}?done=${after}`, label: 'Review my Welcome Kit', id: 'kit' };
}
