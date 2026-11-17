import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_ACCESS_KEY } from '../src/lib/companion';
vi.mock('../src/lib/account', () => ({ getSession: vi.fn(), loadOrders: vi.fn() }));
import { getSession, loadOrders } from '../src/lib/account';
import { initCompanionAccess } from '../src/lib/companion-access';
const session = vi.mocked(getSession);
const orders = vi.mocked(loadOrders);
let elements: { hidden: boolean }[];
let values: Map<string, string>;
beforeEach(() => {
  vi.resetAllMocks();
  elements = [{ hidden: true }, { hidden: true }];
  values = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k), setItem: (k: string, v: string) => values.set(k, v) });
  vi.stubGlobal('location', { pathname: '/app', replace: vi.fn() });
  vi.stubGlobal('document', { querySelectorAll: () => elements });
  session.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());
describe('companion access display', () => {
  it('QR mode records calendar access without contacting Club or account services', async () => {
    location.pathname = '/app/calendar';
    await initCompanionAccess();
    expect(values.get(CALENDAR_ACCESS_KEY)).toBe('1');
    expect(session).not.toHaveBeenCalled();
    expect(orders).not.toHaveBeenCalled();
  });
  // Cleaning is free on the website too (owner decision 2026-11-17), as in the app: no QR scan or order needed.
  it('a visitor with no calendar, no account and no Club sees cleaning, without any network call', async () => {
    await initCompanionAccess();
    expect(elements.every(el => !el.hidden)).toBe(true);
    expect(session).not.toHaveBeenCalled();
    expect(orders).not.toHaveBeenCalled();
  });
  it('calendar QR access still reveals cleaning without network', async () => {
    values.set(CALENDAR_ACCESS_KEY, '1');
    await initCompanionAccess();
    expect(elements.every(el => !el.hidden)).toBe(true);
    expect(session).not.toHaveBeenCalled();
  });
  it('offline, a direct cleaning visit stays on cleaning (no redirect, no account check)', async () => {
    location.pathname = '/app/cleaning';
    session.mockRejectedValue(new Error('offline'));
    await initCompanionAccess();
    expect(elements.every(el => !el.hidden)).toBe(true);
    expect(location.replace).not.toHaveBeenCalled();
  });
});
