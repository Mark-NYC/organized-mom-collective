import { describe, expect, it } from 'vitest';
import { familyNameFrom, firstMonth, kitProgress, kitText, nextStep, startsWithFirstPayment, stepHref, welcomeKitView } from '../src/lib/club/onboarding';
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
    expect(stepHref(confirm)).toBe('/app/club/january?welcome=1');
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

  it('shows five steps and never says shipped before it is', () => {
    expect(kitProgress('print').map((s) => s.state)).toEqual(['done', 'done', 'current', 'next', 'next']);
    expect(kitProgress('address').map((s) => s.label)).toEqual(['Your family', 'Your address', 'Your print', 'Meeting guide', 'Your first resource']);
    expect(kitProgress('done').every((s) => s.state === 'done')).toBe(true);
    expect(kitText(base({ welcome: w('needs_pdf', true) }))).toMatch(/^Submitted\. We aim to print and mail/);
    expect(kitText(base({ welcome: w('ready', true, 'approved') }))).not.toMatch(/mail/i);
    expect(kitText(base({ welcome: w('mailed', true, 'mailed') }))).toBe('Your Welcome Kit is in the mail.');
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

describe('the Family Meeting guide in her setup', () => {
  it('comes after her print and before her first resource, only when she hasn’t seen it', () => {
    const confirm = base({ onboarded: true, welcome: w('needs_confirmation', true) });
    expect(nextStep(confirm, { meetingGuideSeen: false })).toBe('meeting_guide');
    expect(stepHref(confirm, 'meeting_guide')).toBe('/club/family-meeting-guide');
    expect(nextStep(confirm, { meetingGuideSeen: true })).toBe('first_resource');
    expect(nextStep(confirm)).toBe('first_resource'); // unknown: never blocks
    expect(nextStep(base({ onboarded: true, welcome: w('needs_vision', false) }), { meetingGuideSeen: false })).toBe('print');
    expect(nextStep(base({ onboarded: true, welcome: w('needs_pdf', true) }), { meetingGuideSeen: false })).toBe('home'); // never holds a submitted kit
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
