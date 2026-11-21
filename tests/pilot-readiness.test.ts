/**
 * Pilot readiness (docs/pilot/PILOT_TESTING.md): a new family's first steps, the in-app feedback, privacy-safe events,
 * and the first-session fixes (free setup without Club wording, Cleaning without the paper-calendar walkthrough).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { firstSteps, gettingStarted, nextStep } from '../src/lib/app/first-steps';
import { screenFrom } from '../src/components/app/AppFeedback';
import { FUNNEL_ROWS } from '../src/components/admin/PilotAdmin';
import type { Household } from '../src/lib/club/profile';

const src = (p: string) => readFileSync(p, 'utf8');
const MIGRATION = src('supabase/migrations/20261210000000_app_events.sql');
const fam = (adults: number): Household => ({
  id: 'h', displayName: 'X', preferences: {}, profileVersion: 1,
  members: [
    ...Array.from({ length: adults }, (_, i) => ({ id: `a${i}`, firstName: `A${i}`, kind: 'adult' as const, role: i ? 'partner' as const : 'parent' as const, isAccountHolder: i === 0 })),
    { id: 'k', firstName: 'Kid', kind: 'child' as const, role: 'child' as const, birthYear: 2017 },
  ],
});
const base = { signedIn: true, hasPlans: false, shared: false, agreedCount: 0, offerClub: false };

describe('a new family\'s first steps (Today and Family)', () => {
  it('starts with setting up the family, signed out or in', () => {
    expect(nextStep(firstSteps({ ...base, household: null, signedIn: false }))).toMatchObject({ id: 'household', href: '/app/sign-in?next=/app/family/setup' });
    expect(nextStep(firstSteps({ ...base, household: null }))).toMatchObject({ id: 'household', href: '/app/family/setup' });
  });
  it('then this week, then the other grown-up, then the first meeting; done when all are', () => {
    expect(nextStep(firstSteps({ ...base, household: fam(2) }))?.id).toBe('week');
    expect(nextStep(firstSteps({ ...base, household: fam(2), hasPlans: true }))?.id).toBe('adult');
    expect(nextStep(firstSteps({ ...base, household: fam(2), hasPlans: true, shared: true }))?.id).toBe('meeting');
    expect(gettingStarted(firstSteps({ ...base, household: fam(2), hasPlans: true, shared: true, agreedCount: 1 }))).toBe(false);
  });
  it('a single parent has nobody to invite: that step is done, so the list can finish', () => {
    const steps = firstSteps({ ...base, household: fam(1), hasPlans: true, agreedCount: 1 });
    expect(steps.find((s) => s.id === 'adult')?.done).toBe(true);
    expect(gettingStarted(steps)).toBe(false);
  });
  it('the Club is only a website step, never what "next" points to', () => {
    const steps = firstSteps({ ...base, household: fam(2), hasPlans: true, shared: true, agreedCount: 1, offerClub: true });
    expect(steps.at(-1)?.id).toBe('club');
    expect(gettingStarted(steps)).toBe(false);
    expect(nextStep(steps)).toBeNull();
    expect(src('src/components/app/TodayDashboard.tsx')).toMatch(/offerClub: !appShellBuild\(\) && !showsClub/);
  });
});

describe('first-session fixes', () => {
  it('free family setup has one title and no Club wording', () => {
    const setup = src('src/components/ourweek/OurWeekFamilySetup.tsx');
    expect(setup).toMatch(/variant="app"/);
    const form = src('src/components/club/FamilyForm.tsx');
    expect(form).toMatch(/\{app \? null : mode === 'start' \?/);            // no second title, no welcome-gift intro
    expect(form).toMatch(/\{!app && <section aria-labelledby="club-art-style-heading"/); // no illustration style in the free app
  });
  it('right after the first save: "You\'re set up" with one next step', () => {
    const setup = src('src/components/ourweek/OurWeekFamilySetup.tsx');
    expect(setup).toMatch(/data-setup-done/);
    expect((setup.match(/data-setup-next/g) ?? []).length).toBe(1);
    expect(setup).toMatch(/<details className="family-note" data-setup-edit>/);
  });
  it('Cleaning in the app goes straight to the checklist (the paper-calendar walkthrough stays on the QR pages)', () => {
    expect(src('src/components/TodayApp.tsx')).toMatch(/forceSetup \? false : variant === 'app' \|\| isOnboarded\(\)/);
    expect(src('src/layouts/AppLayout.astro')).toMatch(/\/\^\\\/app\\\/calendar\\\/\?\$\/\.test\(location\.pathname\)/);
  });
});

describe('in-app feedback', () => {
  it('keeps only an app path as "where it came from"', () => {
    expect(screenFrom('?from=/app/cleaning')).toBe('/app/cleaning');
    expect(screenFrom('?from=https://evil.example/x')).toBe('/app');
    expect(screenFrom('?from=/app/<script>')).toBe('/app');
    expect(screenFrom('')).toBe('/app');
  });
  it('is quiet: a line on Today and a link on Account, and the page is in the iPhone app', () => {
    expect(src('src/components/app/TodayDashboard.tsx')).toMatch(/data-feedback-quiet/);
    expect(src('src/components/FamilySummary.tsx')).toMatch(/href="\/app\/feedback\?from=\/app\/account"/);
    expect(src('src/data/app/shell-routes.json')).toMatch(/family-calendar\|feedback\)\$/);
  });
  it('sends only the message, its kind and where it came from', () => {
    const ui = src('src/components/app/AppFeedback.tsx');
    expect(ui).toMatch(/accountRpc\('app_feedback', \{ p_kind: kind, p_message: text\.trim\(\), p_screen: screen, p_platform: appShellBuild\(\) \? 'ios' : 'web', p_width: Math\.round\(window\.innerWidth\) \}\)/);
  });
});

describe('privacy-safe events', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const stub = (signedIn: boolean, search = '') => {
    const data = new Map<string, string>(signedIn ? [['omc:account:session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600e3, user_id: 'u', email: 'a@b.co' })]] : []);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: () => null, length: 0 });
    vi.stubGlobal('location', { search });
    vi.stubGlobal('window', {});
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response('null', { status: 200 }); });
    return calls;
  };
  it('sends one event name and the platform, once a day', async () => {
    const calls = stub(true);
    const { track } = await import('../src/lib/app/events');
    track('app_open'); track('app_open');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ body: { p_event: 'app_open', p_platform: 'web' } });
    expect(String((calls[0] as { url: string }).url)).toMatch(/\/rpc\/app_event$/);
  });
  it('sends nothing when signed out or in the demo', async () => {
    let calls = stub(false);
    let { track } = await import('../src/lib/app/events');
    track('app_open'); await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(0);
    vi.resetModules();
    calls = stub(true, '?demo=1');
    ({ track } = await import('../src/lib/app/events'));
    track('app_open'); await new Promise((r) => setTimeout(r, 0));
    expect(calls).toHaveLength(0);
  });
  it('the app\'s event names are exactly the database\'s allowlist', () => {
    const sqlNames = [...MIGRATION.slice(MIGRATION.indexOf('event text not null check'), MIGRATION.indexOf('platform text not null')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const tsNames = [...src('src/lib/app/events.ts').slice(0, 1200).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((n) => sqlNames.includes(n)).sort();
    expect(tsNames).toEqual(sqlNames);
  });
  it('the owner\'s Pilot tab shows every funnel number, and the funnel is owner-only', () => {
    const keys = [...MIGRATION.slice(MIGRATION.indexOf("'accounts_created'"), MIGRATION.indexOf("'platforms'")).matchAll(/'([a-z_0-9]+)', \(/g)].map((m) => m[1]);
    expect(FUNNEL_ROWS.map(([k]) => k).sort()).toEqual(keys.sort());
    for (const fn of ['pilot_funnel', 'pilot_feedback']) {
      const body = MIGRATION.slice(MIGRATION.indexOf(`create function public.${fn}(`));
      expect(body.slice(0, 400), fn).toMatch(/if not public\.is_admin\('owner'\) then raise exception 'forbidden'/);
    }
  });
});
