/**
 * Public App Store launch (docs/ios/APP_STORE_LAUNCH.md): the app is free, sells nothing, and says plainly that Family
 * Meeting Club is by invitation; App Review can sign in with a password; complimentary access is the Club's existing
 * grant, managed only from /admin/club.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLUB_INVITATION, CLUB_INVITATION_GATE, FREE_FOR_EVERYONE } from '../src/data/club/invitation';
import { classifyLink } from '../src/lib/native/links';
import { endOfDay, STATUS_LABEL } from '../src/components/admin/ClubAccessAdmin';

const src = (p: string) => readFileSync(p, 'utf8');
const HERE = 'capacitor://localhost/app';

describe('Family Meeting Club by invitation, in the app', () => {
  it('says it plainly, with what stays free, and no price, trial or purchase words', () => {
    expect(CLUB_INVITATION).toBe('Family Meeting Club is currently available by invitation.');
    const [title, text] = CLUB_INVITATION_GATE('January');
    expect(title).toBe('January is part of Family Meeting Club');
    expect(text).toContain(CLUB_INVITATION);
    expect(text).toContain(FREE_FOR_EVERYONE);
    for (const t of [CLUB_INVITATION, FREE_FOR_EVERYONE, title, text]) expect(t).not.toMatch(/\$|price|trial|subscri|buy|purchase|upgrade|join|checkout/i);
  });

  it('the Club gates send an app user back to Club Home, never to the sales or checkout page', () => {
    const family = src('src/lib/club/plan/family.ts');
    // App branch of the Welcome Family Rhythm gate and of a never-member's month gate: invitation text + Club Home.
    expect(family).toMatch(/const WELCOME_DENIED[^=]*= appShellBuild\(\)\s*\? \[\.\.\.CLUB_INVITATION_GATE\('Your Family Rhythm'\), 'Go to Club Home', routes\.appClub\]/);
    expect(family).toMatch(/if \(!me\.access && !me\.months\?\.length\) \{\s*return appShellBuild\(\)\s*\? \[\.\.\.CLUB_INVITATION_GATE\(month\), 'Go to Club Home', routes\.appClub\]/);
    // "Your membership has ended" is only for someone who received months.
    expect(family.indexOf('if (!me.access && !me.months?.length)')).toBeLessThan(family.indexOf('Your membership has ended'));
    // And even if a sales link slipped in, the app keeps it inside: /club → Club Home, the account page → Account.
    expect(classifyLink('/club', HERE)).toEqual({ kind: 'in-app', href: '/app/club' });
    expect(classifyLink('/club/dashboard', HERE)).toEqual({ kind: 'in-app', href: '/app/account' });
  });

  it('the app Club page shows the invitation line only in the app build', () => {
    const page = src('src/pages/app/club.astro');
    expect(page).toMatch(/\{appShell && <p[^>]*data-club-invitation>\{CLUB_INVITATION\} \{FREE_FOR_EVERYONE\}<\/p>\}/);
  });

  it('the app build turns checkout and the shop off', () => {
    const build = src('scripts/build-app.mjs');
    expect(build).toMatch(/PUBLIC_CLUB_CHECKOUT_ENABLED: 'false'/);
    expect(build).toMatch(/PUBLIC_SHOP_ENABLED: 'false'/);
  });
});

describe('iOS Club access is complimentary-invitation only', () => {
  it('does not unlock the iOS Club for a paid web membership without a live grant', async () => {
    const { membershipForAppStore } = await import('../src/lib/club/membership');
    const me = {
      access: true, grant: null, member: true, plan: 'monthly' as const,
      status: 'active', payment_problem: false, renews: null, ends: null,
      ended_at: null, revoked: false, onboarded: true, has_address: true,
      enrolled_at: null, first_paid_month: null, current_month: '2026-11',
      membership_year: null, welcome: null, next: null, months: [],
    };
    const ios = membershipForAppStore(me, true);
    expect(ios.access).toBe(false);
    expect(ios.member).toBe(false);
    expect(ios.grant).toBe(null);
    expect(membershipForAppStore(me, false)).toEqual(me);
  });

  it('allows an explicit live grant, including when the household also pays on the web', async () => {
    const { membershipForAppStore } = await import('../src/lib/club/membership');
    const paidAndInvited = {
      access: true, grant: 'complimentary', member: true, plan: 'monthly' as const,
      status: 'active', payment_problem: false, renews: null, ends: null,
      ended_at: null, revoked: false, onboarded: true, has_address: true,
      enrolled_at: null, first_paid_month: null, current_month: '2026-11',
      membership_year: null, welcome: null, next: null, months: [],
    };
    expect(membershipForAppStore(paidAndInvited, true).access).toBe(true);
    expect(membershipForAppStore({ ...paidAndInvited, access: false }, true).access).toBe(false);
  });

  it('the app library and meeting entitlement checks both require a grant', () => {
    const store = src('src/lib/club/store.ts');
    expect(store).toMatch(/const access = r\.access && \(!appShellBuild\(\) \|\| Boolean\(r\.grant\)\)/);
    expect(store).toMatch(/kits: access \? r\.kits\.filter/);
    const membership = src('src/lib/club/membership.ts');
    expect(membership).toMatch(/membershipForAppStore\(await accountRpc<Membership>\('club_me'\)\)/);
    const meeting = src('src/components/ourweek/WeeklyMeeting.tsx');
    const meetingClient = src('src/lib/family-development/client.ts');
    expect(meeting).toContain('useMeetingAccess()');
    expect(meetingClient).toContain('accountStore.me()');
  });
});

describe('App Review basics in the app', () => {
  it('the Account page links the Privacy Policy, Terms and Help, and they open on the website', () => {
    const account = src('src/components/FamilySummary.tsx');
    expect(account).toMatch(/data-account-policies>[\s\S]*href=\{routes\.privacy\}[\s\S]*href=\{routes\.terms\}[\s\S]*href="\/support"/);
    expect(classifyLink('/privacy', HERE)).toEqual({ kind: 'website', url: 'https://www.organizedmomcollective.com/privacy' });
    expect(classifyLink('/terms', HERE)).toEqual({ kind: 'website', url: 'https://www.organizedmomcollective.com/terms' });
  });
  it('account deletion is in the app', () => {
    expect(src('src/components/FamilySummary.tsx')).toMatch(/data-delete-account>Delete my account</);
  });
});

describe('App Review sign-in with a password', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const stubStorage = () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: () => null, length: 0 });
    return data;
  };

  it('uses Supabase\'s password grant and keeps the same session as a code sign-in', async () => {
    const data = stubStorage();
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 'review@example.com' } }), { status: 200 });
    });
    const { signInWithPassword } = await import('../src/lib/account');
    const r = await signInWithPassword(' Review@Example.com ', 'secret');
    expect(r.ok).toBe(true);
    expect(calls[0].url).toMatch(/\/auth\/v1\/token\?grant_type=password$/);
    expect(calls[0].body).toEqual({ email: 'review@example.com', password: 'secret' });
    expect(JSON.parse(data.get('omc:account:session')!)).toMatchObject({ access_token: 'a', user_id: 'u1', email: 'review@example.com' });
  });

  it('says a wrong password plainly and stores nothing', async () => {
    const data = stubStorage();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const { signInWithPassword } = await import('../src/lib/account');
    expect(await signInWithPassword('a@b.co', 'nope')).toEqual({ ok: false, error: 'wrong_password' });
    expect(await signInWithPassword('a@b.co', '')).toEqual({ ok: false, error: 'wrong_password' });
    expect(data.size).toBe(0);
  });

  it('is a quiet secondary option on the app sign-in; the emailed code stays the main path', () => {
    const page = src('src/components/ourweek/OurWeekSignIn.tsx');
    expect(page).toMatch(/data-use-password>Have a password\? Sign in with it</);
    expect(page.indexOf("'Email me a code'")).toBeLessThan(page.indexOf('data-use-password'));
    expect(page).not.toMatch(/sign ?up|create a password|set a password/i); // no way for anyone to create a password here
  });
});

describe('Complimentary access, admin side', () => {
  it('names the four states the owner sees', () => {
    expect(STATUS_LABEL).toEqual({ free: 'Free', complimentary: 'Complimentary Club', paid: 'Paid Club', paid_and_complimentary: 'Paid Club + Complimentary' });
  });
  it('an expiry date means through the end of that day', () => {
    const d = new Date(endOfDay('2027-03-31'));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2027, 2, 31, 23, 59]);
  });
  it('every change goes through the owner-checked database functions, never a direct table write', () => {
    const ui = src('src/components/admin/ClubAccessAdmin.tsx');
    for (const fn of ['club_admin_access_search', 'club_admin_access_detail', 'club_admin_access_grant', 'club_admin_access_revoke', 'club_admin_access_expiry']) expect(ui).toContain(`'${fn}'`);
    expect(ui).not.toMatch(/adminSelect|clubAdmin\(|'club_access_grants'|'club_subscriptions'/); // only the owner-checked functions; no table reads, no Stripe calls
    const sql = src('supabase/migrations/20261208000000_club_complimentary_access.sql');
    for (const fn of ['search', 'detail', 'grant', 'revoke', 'expiry']) {
      const body = sql.slice(sql.indexOf(`create function public.club_admin_access_${fn}`));
      expect(body.slice(0, 600), fn).toMatch(/if not public\.is_admin\('owner'\) then raise exception 'forbidden'/);
    }
    expect(sql).not.toMatch(/(update|insert into|delete from) public\.club_subscriptions/i);
    expect(sql).not.toMatch(/(update|insert into|delete from) public\.club_invoices/i);
  });
  it('the Club admin page has a Club access tab', () => {
    expect(src('src/components/admin/ClubAdmin.tsx')).toMatch(/\{ id: 'access', label: 'Club access', note: 'Complimentary, by invitation' \}/);
  });
});

describe('In the app, the Club opens only for an explicit live grant (owner decision on PR 516)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
  const paid = { access: true, grant: null, member: true, plan: 'monthly', status: 'active', renews: '2027-01-01', months: [{ month: '2026-11-01' }], kits: [{ slug: '2026-11-family-ownership', can: 'open' }], onboarded: true };
  const stubClubMe = (me: object) => vi.stubGlobal('fetch', async () => new Response(JSON.stringify(me), { status: 200 }));
  const signedIn = () => {
    const data = new Map([['omc:account:session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600e3, user_id: 'u1', email: 'a@b.co' })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: () => null, length: 0 });
  };

  it('a paying website member with no grant sees the free app: no access, no months, no billing details', async () => {
    const { membershipForAppStore } = await import('../src/lib/club/membership');
    const me = membershipForAppStore(paid as never, true);
    expect(me).toMatchObject({ access: false, member: false, grant: null, plan: null, status: null, renews: null, months: [] });
  });
  it('a complimentary or beta grant opens it, with or without a paid subscription', async () => {
    const { membershipForAppStore } = await import('../src/lib/club/membership');
    for (const grant of ['complimentary', 'beta']) {
      expect(membershipForAppStore({ ...paid, grant } as never, true).access).toBe(true);
      expect(membershipForAppStore({ ...paid, grant, plan: null, status: null, member: false } as never, true).access).toBe(true);
    }
  });
  it('the website is unchanged: paid members keep the Club', async () => {
    const { membershipForAppStore } = await import('../src/lib/club/membership');
    expect(membershipForAppStore(paid as never, false)).toEqual(paid);
  });
  it('the Club meeting and the MAWL layer (accountStore.me) follow the same rule in the app build', async () => {
    vi.stubEnv('PUBLIC_APP_SHELL', 'ios'); signedIn();
    stubClubMe(paid);
    let { accountStore } = await import('../src/lib/club/store');
    expect(await accountStore.me()).toMatchObject({ access: false, kits: [] });
    vi.resetModules(); stubClubMe({ ...paid, grant: 'complimentary' });
    ({ accountStore } = await import('../src/lib/club/store'));
    expect((await accountStore.me())?.access).toBe(true);
  });
  it('and on the website a paid member still gets the Club meeting', async () => {
    vi.stubEnv('PUBLIC_APP_SHELL', ''); signedIn(); stubClubMe(paid);
    const { accountStore } = await import('../src/lib/club/store');
    expect((await accountStore.me())?.access).toBe(true);
  });
});

describe('In the app, the Club content loaders need the grant too (no side door through a direct link)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
  const paid = { access: true, grant: null, member: true, months: [], kits: [{ slug: '2026-11-family-ownership', can: 'edit' }], onboarded: true };
  const setup = (me: object, shell: string) => {
    vi.stubEnv('PUBLIC_APP_SHELL', shell);
    const data = new Map([['omc:account:session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600e3, user_id: 'u1', email: 'a@b.co' })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: () => null, length: 0 });
    const called: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const fn = String(url).split('/rpc/')[1];
      called.push(fn);
      const body = fn === 'club_me' ? me : fn === 'club_document_get' ? { can: 'edit', documents: {} } : fn === 'club_welcome_get' ? { status: 'pending' } : { can: 'edit', state: {}, revision: 1, month: '2026-11-01', approved_at: null, mailing: null };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    return called;
  };

  it('a paid-only member: months, the welcome plan, Family Vision and kit documents stay closed, and never reach the server', async () => {
    const called = setup(paid, 'ios');
    const m = await import('../src/lib/club/membership');
    const { accountStore } = await import('../src/lib/club/store');
    await expect(m.loadResource('2026-11-family-ownership')).rejects.toThrow('not_found');
    await expect(m.saveResource('2026-11-family-ownership', {}, 1)).rejects.toThrow('not_found');
    await expect(m.loadWelcomePlan()).rejects.toThrow('not_found');
    await expect(m.loadWelcome()).resolves.toBeNull();
    await expect(m.saveWelcome({ family_name: 'X', value: 'Love' })).rejects.toThrow('not_found');
    await expect(accountStore.documents('2026-11-family-ownership')).rejects.toThrow('not_found');
    expect(called.filter((f) => f !== 'club_me')).toEqual([]);
  });
  it('with a grant they open in the app', async () => {
    const called = setup({ ...paid, grant: 'complimentary' }, 'ios');
    const m = await import('../src/lib/club/membership');
    await expect(m.loadResource('2026-11-family-ownership')).resolves.toMatchObject({ can: 'edit' });
    expect(called).toContain('club_resource_get');
  });
  it('on the website a paid member opens them exactly as before (no extra check)', async () => {
    const called = setup(paid, '');
    const m = await import('../src/lib/club/membership');
    await expect(m.loadResource('2026-11-family-ownership')).resolves.toMatchObject({ can: 'edit' });
    expect(called).toEqual(['club_resource_get']);
  });
  it('the month page shows the invitation in the app, never "the months you pay for"', () => {
    const page = src('src/components/club/ClubResourceAccess.tsx');
    expect(page).toMatch(/state === 'denied' && appShellBuild\(\)[\s\S]*CLUB_INVITATION_GATE[\s\S]*Go to Club Home/);
    expect(page.indexOf("state === 'denied' && appShellBuild()")).toBeLessThan(page.indexOf('Members receive each month they pay for.'));
  });
});
