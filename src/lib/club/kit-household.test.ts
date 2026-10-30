import { describe, expect, it } from 'vitest';
import { loadKitHousehold, type KitHouseholdEnv } from './kit-household';
import { sampleStore, type ClubStore } from './store';

const SLUG = '2027-10-home-works-together';
const account = (over: Partial<ClubStore> = {}): ClubStore => ({
  kind: 'account',
  label: '',
  me: async () => ({ access: true, onboarded: true, kits: [{ slug: SLUG, can: 'edit' }] }),
  household: async () => ({ id: 'h1', displayName: 'The Parks', preferences: {}, profileVersion: 1, members: [{ id: 'm1', firstName: 'Jo', kind: 'adult', role: 'parent', isAccountHolder: true }] }),
  saveHousehold: async () => { throw new Error('unused'); },
  documents: async () => ({ can: 'edit', documents: {} }),
  saveDocument: async () => 1,
  profile: async () => null,
  saveActivities: async () => { throw new Error('unused'); },
  saveResponsibilities: async () => { throw new Error('unused'); },
  saveFocus: async () => { throw new Error('unused'); },
  ...over,
});
const env = (over: Partial<KitHouseholdEnv> = {}): KitHouseholdEnv => ({
  accountsEnabled: () => false,
  hasSession: async () => false,
  accountStore: account(),
  sampleStore,
  ...over,
});

describe('loadKitHousehold', () => {
  it('uses the default sample, labeled, when Club accounts are off', async () => {
    const r = await loadKitHousehold(SLUG, '', env());
    expect(r).toMatchObject({ status: 'ready', source: 'sample', sample: 'rivera' });
    if (r.status === 'ready') expect(r.sampleLabel).toMatch(/Sample/);
  });

  it('opens the sample named in the URL', async () => {
    expect(await loadKitHousehold(SLUG, '?sample=chen', env())).toMatchObject({ status: 'ready', sample: 'chen' });
  });

  it('reports an empty profile instead of a blank plan', async () => {
    expect(await loadKitHousehold(SLUG, '?sample=new', env())).toMatchObject({ status: 'empty', source: 'sample' });
    const archivedOnly = account({ household: async () => ({ id: 'h', preferences: {}, profileVersion: 1, members: [{ id: 'x', firstName: 'X', kind: 'adult', role: 'parent', archived: true }] }) });
    expect(await loadKitHousehold(SLUG, '', env({ accountsEnabled: () => true, hasSession: async () => true, accountStore: archivedOnly }))).toMatchObject({ status: 'empty', source: 'account' });
  });

  it('never substitutes a sample for a signed-out member when accounts are on', async () => {
    expect(await loadKitHousehold(SLUG, '', env({ accountsEnabled: () => true }))).toEqual({ status: 'signed-out' });
  });

  it('loads the signed-in member’s own household', async () => {
    const r = await loadKitHousehold(SLUG, '', env({ accountsEnabled: () => true, hasSession: async () => true }));
    expect(r).toMatchObject({ status: 'ready', source: 'account', sample: null });
    if (r.status === 'ready') expect(r.household.displayName).toBe('The Parks');
  });

  it('denies a month her account can’t open, and reports load failures', async () => {
    const noKit = account({ me: async () => ({ access: true, onboarded: true, kits: [] }) });
    expect(await loadKitHousehold(SLUG, '', env({ accountsEnabled: () => true, hasSession: async () => true, accountStore: noKit }))).toMatchObject({ status: 'denied' });
    const broken = account({ household: async () => { throw new Error('rpc'); } });
    expect(await loadKitHousehold(SLUG, '', env({ accountsEnabled: () => true, hasSession: async () => true, accountStore: broken }))).toEqual({ status: 'error' });
  });
});
