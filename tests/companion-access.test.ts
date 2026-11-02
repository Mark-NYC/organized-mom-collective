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
  it('Club alone does not reveal cleaning', async () => {
    await initCompanionAccess();
    expect(elements.every(el => el.hidden)).toBe(true);
  });
  it('calendar QR access reveals cleaning in the combined shell without network', async () => {
    values.set(CALENDAR_ACCESS_KEY, '1');
    await initCompanionAccess();
    expect(elements.every(el => !el.hidden)).toBe(true);
    expect(session).not.toHaveBeenCalled();
  });
  it('account failure keeps cleaning hidden and redirects a direct cleaning visit', async () => {
    location.pathname = '/app/cleaning';
    session.mockRejectedValue(new Error('offline'));
    await initCompanionAccess();
    expect(elements.every(el => el.hidden)).toBe(true);
    expect(location.replace).toHaveBeenCalledWith('/app');
  });
});
