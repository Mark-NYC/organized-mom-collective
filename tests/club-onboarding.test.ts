import { describe, expect, it } from 'vitest';
import { familyNameFrom, firstMonth, kitProgress, kitText, nextStep, stepHref } from '../src/lib/club/onboarding';
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
    expect(stepHref(confirm)).toBe('/club/resources/2027-01-fresh-start-together?welcome=1');
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

  it('shows three steps and never says shipped before it is', () => {
    expect(kitProgress('print').map((s) => s.state)).toEqual(['done', 'current', 'next']);
    expect(kitText(base({ welcome: w('ready', true, 'approved') }))).not.toMatch(/mail/i);
    expect(kitText(base({ welcome: w('needs_pdf', true) }))).toBe('We’re preparing your Welcome Kit.');
    expect(kitText(base({ welcome: w('mailed', true, 'mailed') }))).toBe('Your Welcome Kit is in the mail.');
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
