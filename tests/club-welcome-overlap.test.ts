// Phase 2d (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md): the monthly resources that are a new member's Welcome win,
// one list in the site and the database. SQL behavior: supabase/tests/club-welcome-overlap.sql.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clubResources } from '../src/data/club/resources';
import { kitItems, kitText, nextStep } from '../src/lib/club/onboarding';
import { kitPieces, welcomeIsMonthly } from '../src/lib/club/welcome-item';
import type { Membership } from '../src/lib/club/membership';

const generator = readFileSync('scripts/generate-welcome-overlap-migration.py', 'utf8');
const migration = readFileSync('supabase/migrations/20261123000000_club_welcome_overlap.sql', 'utf8');

describe('which first months are her Welcome win', () => {
  const site = clubResources.filter((r) => r.dailyRhythm).map((r) => r.slug).sort();
  it('May’s Summer Day Rhythm and August’s School Day Routines', () => {
    expect(site).toEqual(['2027-05-finish-the-school-year', '2027-08-school-year']);
    expect(clubResources.filter((r) => r.dailyRhythm).map((r) => r.component).sort()).toEqual(['august', 'may']);
  });
  it('the site, the generator and the migration list the same kits', () => {
    const listed = [...(/OVERLAP_KITS = \[([^\]]*)\]/.exec(generator)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(site);
    const flagged = [...(/establishes_daily_rhythm = true where slug in \(([^)]*)\)/.exec(migration)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(flagged).toEqual(site);
  });
});

const base = (welcome: Membership['welcome']): Membership => ({
  access: true, grant: null, member: true, plan: 'monthly', status: 'active', payment_problem: false, renews: '2027-06-03T05:00:00Z',
  ends: null, ended_at: null, revoked: false, onboarded: true, has_address: true, enrolled_at: '2027-05-03', first_paid_month: '2027-05-01',
  current_month: '2027-05-01', membership_year: 1, next: null, intro: null, welcome,
  months: [{ month: '2027-05-01', slug: '2027-05-finish-the-school-year', title: 'Our Summer Day Rhythm', published: true, can: 'edit',
    state: 'available', membership_year: 1, plan: 'monthly', fulfilled_by: 'monthly_resource', mailing: null }],
} as unknown as Membership);
const monthly = (readiness: string, status = 'pending') => ({ kind: 'monthly' as const, status, readiness, approved: true, personalized: true, satisfies_month: null, mailed_at: null });

describe('a Welcome Kit that is her first month alone', () => {
  it('two pieces: the guide and her first month; nothing to approve before it', () => {
    const me = base(monthly('needs_confirmation'));
    expect(welcomeIsMonthly(me)).toBe(true);
    expect(kitPieces(me)).toBe('two');
    expect(kitItems(me, false).map((i) => i.id)).toEqual(['guide', 'first']);
    expect(nextStep(me)).toBe('first_resource');
    expect(kitText(me)).toBe('Review your first resource, then prepare your Welcome Kit.');
  });
  it('a kit with a welcome item still has three pieces', () => {
    const me = base({ kind: 'rhythm', status: 'pending', readiness: 'needs_rhythm', approved: false, personalized: false, satisfies_month: null, mailed_at: null });
    expect(kitPieces(me)).toBe('three');
    expect(kitItems(me, false).map((i) => i.id)).toEqual(['print', 'guide', 'first']);
    expect(nextStep(me)).toBe('print');
  });
});
