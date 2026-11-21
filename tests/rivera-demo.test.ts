/**
 * The Rivera demo's admin control (docs/demo/RIVERA_DEMO.md): owner-only database functions, every refusal explained,
 * a confirmation before anything changes, and no billing, email or calendar-sync code in the seed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEMO_ERRORS } from '../src/components/admin/RiveraDemoAdmin';

const src = (p: string) => readFileSync(p, 'utf8');
const MIGRATION = src('supabase/migrations/20261209000000_demo_rivera.sql');

describe('Rivera demo admin control', () => {
  it('uses only the owner-checked demo functions, and asks before installing or resetting', () => {
    const ui = src('src/components/admin/RiveraDemoAdmin.tsx');
    expect(ui).toContain("'demo_rivera_status'");
    expect(ui).toContain("'demo_rivera_reset'");
    expect(ui.match(/adminRpc</g)?.length).toBe(2);
    expect(ui).toMatch(/Reset Rivera Demo/);
    expect((ui.match(/confirm\(/g) ?? []).length).toBe(2);
    expect(src('src/components/admin/ClubAdmin.tsx')).toMatch(/<ClubAccessAdmin \{\.\.\.ctx\} \/><RiveraDemoAdmin \{\.\.\.ctx\} \/>/);
  });
  it('explains every refusal the database can give', () => {
    const codes = [...MIGRATION.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]);
    const guards = [...MIGRATION.matchAll(/return '([a-z_]+)'/g)].map((m) => m[1]).filter((c) => c !== 'ok');
    for (const c of new Set(codes)) expect(DEMO_ERRORS[c], c).toBeTruthy();
    for (const g of new Set(guards)) { expect(DEMO_ERRORS[`owner_${g}`], g).toBeTruthy(); expect(DEMO_ERRORS[`partner_${g}`], g).toBeTruthy(); }
  });
});

describe('Rivera demo seed', () => {
  it('is owner-only and audited', () => {
    for (const fn of ['demo_rivera_status', 'demo_rivera_reset']) {
      const body = MIGRATION.slice(MIGRATION.indexOf(`create function public.${fn}`));
      expect(body.slice(0, 500), fn).toMatch(/if not public\.is_admin\('owner'\) then raise exception 'forbidden'/);
    }
    expect(MIGRATION).toMatch(/admin_log\(case when first_install then 'demo\.rivera\.install' else 'demo\.rivera\.reset' end/);
  });
  it('never writes billing, fulfillment, email, marketing, kits or calendar sync', () => {
    expect(MIGRATION).not.toMatch(/(insert into|update|delete from) public\.(club_subscriptions|club_invoices|club_entitlements|club_fulfillment_orders|club_email_log|tool_email_contacts|shop_orders|calendar_feeds|calendar_google_accounts|club_kits)\b/i);
    expect(MIGRATION).not.toMatch(/club_welcome_save|club_welcome_approve|club_fulfillment_approve|calendar_feed_add|calendar_google_/);
  });
  it('only accepts demo accounts on a domain that never receives mail', () => {
    expect(MIGRATION).toMatch(/@example\\\.com\$/);
  });
});
