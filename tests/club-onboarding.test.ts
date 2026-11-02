import { describe, expect, it } from 'vitest';
import { familyNameFrom, firstMonth, firstResourceHref, homeState, kitItems, kitProgress, kitSubmitted, kitText, nextStep, startsWithFirstPayment, stepHref, welcomeKitView } from '../src/lib/club/onboarding';
import type { Membership } from '../src/lib/club/membership';

/** A founding member right after checkout: free January, her Welcome Kit waiting for her family. */
const base = (over: Partial<Membership> = {}): Membership => ({
  access: true, grant: null, member: true, plan: 'monthly', status: 'trialing', payment_problem: false, renews: '2027-02-01T05:00:00Z',
  ends: null, ended_at: null, revoked: false, onboarded: false, has_address: true, enrolled_at: '2026-10-30', first_paid_month: '2027-01-01',
  current_month: '2026-10-01', membership_year: 1, next: null, intro: { month: '2027-01-01', trial_ends: '2027-02-01T05:00:00Z' },
  welcome: { status: 'pending', readiness: 'needs_profile', approved: false, personalized: false, satisfies_month: null, mailed_at: null },
  months: [{ month: '2027-01-01', free: true, slug: '2027-01-fresh-start-together', title: 'A Fresh Start, Together', published: true, can: 'edit',
    state: 'available', membership_year: 1, plan: 'monthly', fulfilled_by: 'monthly_resource', mailing: null }],
  ...over,
});
const w = (readiness: string, approved: boolean, status = 'pending') => ({ status, readiness, approved, personalized: approved, satisfies_month: null, mailed_at: null });

describe('the Welcome Kit steps', () => {
  it('goes family → address → print → first resource → account, from what the database says', () => {
    expect(nextStep(base())).toBe('family');
    expect(nextStep(base({ onboarded: true, has_address: false, welcome: w('needs_address', false) }))).toBe('address');
    expect(nextStep(base({ onboarded: true, welcome: w('needs_vision', false) }))).toBe('print');
    const confirm = base({ onboarded: true, welcome: w('needs_confirmation', true) });
    expect(nextStep(confirm)).toBe('first_resource');
    // Every kit step resumes on the Welcome Kit page; the tool itself opens in Welcome Kit mode from there.
    expect(stepHref(confirm)).toBe('/club/welcome-kit');
    expect(stepHref(base({ onboarded: true, welcome: w('needs_vision', false) }))).toBe('/club/welcome-kit');
    expect(firstResourceHref(confirm)).toBe('/app/club/january?welcome=1');
    expect(nextStep(base({ onboarded: true, welcome: w('needs_pdf', true) }))).toBe('home');
  });

  it('never sends her to a first resource that isn’t published, or back into a kit that went to print', () => {
    expect(nextStep(base({ onboarded: true, welcome: w('needs_resource', true) }))).toBe('home');
    expect(nextStep(base({ onboarded: true, welcome: w('approved', true, 'approved') }))).toBe('home');
    expect(nextStep(base({ onboarded: true, welcome: w('mailed', true, 'mailed') }))).toBe('home');
  });

  it('a member without a welcome print (or a grant) still lands somewhere sensible', () => {
    expect(nextStep(base({ onboarded: true, welcome: null }))).toBe('home');
    expect(nextStep(base({ member: false, grant: null }))).toBe('not_member');
  });

  it('her first month is her household’s first paid month', () => {
    expect(firstMonth(base())?.slug).toBe('2027-01-fresh-start-together');
    expect(firstMonth(base({ first_paid_month: '2027-02-01' }))).toBeNull();
  });

  it('shows one journey in three phases and never says shipped before it is', () => {
    expect(kitProgress('family').map((s) => s.label)).toEqual(['Tell us about your family', 'Make it yours', 'Confirm your Welcome Kit']);
    expect(kitProgress('address').map((s) => s.state)).toEqual(['current', 'next', 'next']);
    expect(kitProgress('print').map((s) => s.state)).toEqual(['done', 'current', 'next']);
    expect(kitProgress('first_resource').map((s) => s.state)).toEqual(['done', 'current', 'next']);
    expect(kitProgress('confirm').map((s) => s.state)).toEqual(['done', 'done', 'current']);
    expect(kitProgress('done').every((s) => s.state === 'done')).toBe(true);
    expect(kitText(base({ welcome: w('needs_pdf', true) }))).toMatch(/^Your package is getting ready\. We aim to print and mail/);
    expect(kitText(base({ welcome: w('ready', true, 'approved') }))).not.toMatch(/mail/i);
    expect(kitText(base({ welcome: w('mailed', true, 'mailed') }))).toBe('Your Welcome Kit is on its way.');
  });
});

describe('her three printed pieces', () => {
  const title = (slug: string | null) => (slug ? 'Our Family Weekly Meeting' : null);
  it('print needs her approval; the guide is simply ready; her first month needs a review', () => {
    const items = kitItems(base({ onboarded: true, welcome: w('needs_vision', false) }), false, title);
    expect(items.map((i) => [i.id, i.status])).toEqual([['print', 'needs_review'], ['guide', 'ready'], ['first', 'needs_review']]);
    expect(items[2].name).toBe('January Resource');
    expect(items[2].about).toMatch(/^Our Family Weekly Meeting/);
    expect(items[2].href).toBe('/app/club/january?welcome=1');
    expect(items[1].href).toBe('/club/family-meeting-guide');
  });
  it('approved on its tool (this device) or once the kit is submitted', () => {
    const open = base({ onboarded: true, welcome: w('needs_confirmation', true) });
    expect(kitItems(open, true).map((i) => i.status)).toEqual(['approved', 'ready', 'approved']);
    expect(kitSubmitted(open)).toBe(false);
    const sent = base({ onboarded: true, welcome: w('needs_pdf', true) });
    expect(kitSubmitted(sent)).toBe(true);
    expect(kitItems(sent, false).map((i) => i.status)).toEqual(['approved', 'ready', 'approved']);
    expect(kitItems(sent, false)[2].href).toBe('/app/club/january');
  });
  it('a first month that isn’t published yet is being finished, never “needs review”', () => {
    expect(kitItems(base({ onboarded: true, welcome: w('needs_resource', true) }), false)[2].status).toBe('preparing');
  });
});

describe('Club Home follows her membership', () => {
  const at = Date.parse('2026-11-10T12:00:00Z');
  it('setup, kit almost ready, getting ready, on its way, then ongoing', () => {
    expect(homeState(base(), 'family', at)).toBe('setup');
    expect(homeState(base({ onboarded: true, welcome: w('needs_vision', false) }), 'print', at)).toBe('kit_open');
    expect(homeState(base({ onboarded: true, welcome: w('needs_confirmation', true) }), 'first_resource', at)).toBe('kit_open');
    expect(homeState(base({ onboarded: true, welcome: w('needs_pdf', true) }), 'home', at)).toBe('kit_submitted');
    expect(homeState(base({ onboarded: true, welcome: w('ready', true, 'printed') }), 'home', at)).toBe('kit_submitted');
    const mailed = { ...w('mailed', true, 'mailed'), mailed_at: '2026-11-05T15:00:00Z' };
    expect(homeState(base({ onboarded: true, welcome: mailed }), 'home', at)).toBe('kit_mailed');
    expect(homeState(base({ onboarded: true, welcome: mailed }), 'home', Date.parse('2026-12-01T12:00:00Z'))).toBe('ongoing');
    expect(homeState(base({ onboarded: true, welcome: null }), 'home', at)).toBe('ongoing');
  });
  it('never says it is on its way before it is marked mailed', () => {
    expect(homeState(base({ onboarded: true, welcome: w('ready', true, 'approved') }), 'home', at)).toBe('kit_submitted');
  });
});

describe('the family profile in her setup', () => {
  const profile = (setupCompleted: boolean) => ({ setupCompleted });
  it('comes right after the family form, before the address and the print, until finished', () => {
    const fam = base({ onboarded: true, has_address: false, welcome: w('needs_address', false) });
    expect(nextStep(fam, { profile: profile(false) })).toBe('profile');
    expect(stepHref(fam, 'profile')).toBe('/club/welcome');
    expect(nextStep(fam, { profile: profile(true) })).toBe('address');
    expect(nextStep(fam, { profile: profile(false), profileDeferred: true })).toBe('address');
    expect(nextStep(base(), { profile: profile(false) })).toBe('family');
  });
  it('also for a member with no Welcome Kit yet (the case that skipped it)', () => {
    const later = base({ onboarded: true, welcome: null, months: [], intro: null, next: { month: '2027-01-01', payment_on: '2027-01-01T05:00:00Z', slug: '2027-01-fresh-start-together', title: null, regular_cutoff_at: null } });
    expect(nextStep(later, { profile: profile(false) })).toBe('profile');
    expect(nextStep(later, { profile: profile(true) })).toBe('home');
    expect(startsWithFirstPayment(later)).toBe(true);
    expect(startsWithFirstPayment(base({ onboarded: true }))).toBe(false);
  });
});

describe('the Family Meeting guide', () => {
  it('is never a required step: the same sheet for every family, previewed from her Welcome Kit', () => {
    const confirm = base({ onboarded: true, welcome: w('needs_confirmation', true) });
    expect(nextStep(confirm, { meetingGuideSeen: false })).toBe('first_resource');
    expect(nextStep(confirm, { meetingGuideSeen: true })).toBe('first_resource');
    expect(stepHref(confirm, 'meeting_guide')).toBe('/club/welcome-kit');
    expect(nextStep(base({ onboarded: true, welcome: w('needs_vision', false) }), { meetingGuideSeen: false })).toBe('print');
    expect(nextStep(base({ onboarded: true, welcome: w('needs_pdf', true) }), { meetingGuideSeen: false })).toBe('home');
  });
});

describe('her first month’s confirmation on the tool', () => {
  const slug = '2027-01-fresh-start-together';
  it('asks her only when her kit waits on it, and never for another month', () => {
    expect(welcomeKitView(base({ onboarded: true, welcome: w('needs_confirmation', true) }), slug)).toBe('confirm');
    expect(welcomeKitView(base({ onboarded: true, welcome: w('needs_vision', false) }), slug)).toBe('print_first');
    expect(welcomeKitView(base({ onboarded: true, welcome: w('needs_pdf', true) }), slug)).toBe('none');
    expect(welcomeKitView(base({ onboarded: true, welcome: w('needs_confirmation', true) }), '2027-02-better-together')).toBe('none');
    expect(welcomeKitView(base({ onboarded: true, welcome: w('approved', true, 'approved') }), slug)).toBe('none');
    expect(welcomeKitView(base({ onboarded: true, welcome: null, months: [] }), slug)).toBe('none');
  });
});

describe('family name from the checkout name', () => {
  it('suggests “The <surname> Family”, or nothing', () => {
    expect(familyNameFrom('Ana Rivera')).toBe('The Rivera Family');
    expect(familyNameFrom('  ana  maría  de la cruz ')).toBe('The Cruz Family');
    expect(familyNameFrom('Ana')).toBe('');
    expect(familyNameFrom(null)).toBe('');
  });
});
