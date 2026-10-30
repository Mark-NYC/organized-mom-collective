/**
 * Where a member goes next, from what the database already says (club_me): one answer for /club/welcome, /club/login,
 * the dashboard and the Welcome Kit progress. Nothing here is stored; refreshing or coming back later lands on the
 * same step. The Welcome Kit (supabase/migrations/20261108000000_club_welcome_kit.sql) is her welcome print and her
 * first month's resource, approved together and mailed in one package; `welcome.readiness` is the kit's.
 */
import type { Membership, MembershipMonth } from './membership';
import { routes } from '../../routes';

export type OnboardingStep = 'not_member' | 'family' | 'address' | 'print' | 'first_resource' | 'home';

/** Her first month: the one her Welcome Kit carries (the household's first paid month). */
export function firstMonth(me: Pick<Membership, 'months' | 'first_paid_month'>): MembershipMonth | null {
  return me.months.find((m) => m.month === me.first_paid_month && m.fulfilled_by === 'monthly_resource') ?? null;
}

/** Her kit still asks something of her (print or first resource) and nothing has gone to print yet. */
const open = (me: Membership) => Boolean(me.welcome && ['pending', 'on_hold'].includes(me.welcome.status));

export function nextStep(me: Membership): OnboardingStep {
  if (!me.member && !me.grant) return 'not_member';
  if (!me.onboarded) return 'family';
  if (!me.has_address) return 'address';
  if (open(me) && !me.welcome!.approved) return 'print';
  if (open(me) && me.welcome!.readiness === 'needs_confirmation' && firstMonth(me)?.slug) return 'first_resource';
  return 'home';
}

/** The page for a step. */
export function stepHref(me: Membership, step = nextStep(me)): string {
  switch (step) {
    case 'family':
    case 'address':
    case 'not_member':
      return routes.clubWelcome;
    case 'print':
      return routes.clubFamilyVision;
    case 'first_resource':
      return `${routes.clubResource(firstMonth(me)!.slug!)}?welcome=1`;
    default:
      // Her Club home (the month library, hers when she's signed in); billing, family and address are on /club/dashboard.
      return routes.appClub;
  }
}

/** The three steps she sees: her family, her print, her first resource. */
export type KitProgress = { label: string; state: 'done' | 'current' | 'next' }[];
export function kitProgress(current: 'family' | 'print' | 'first_resource'): KitProgress {
  const order = ['family', 'print', 'first_resource'] as const;
  const labels = { family: 'Your family', print: 'Your print', first_resource: 'Your first resource' };
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
    needs_confirmation: 'Your print is approved. Take a quick look at your first resource.',
    needs_pdf: 'We’re preparing your Welcome Kit.',
    ready: 'We’re preparing your Welcome Kit.',
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
