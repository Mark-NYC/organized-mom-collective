import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { memberColors } from '../src/data/club/family-colors';
import type { Household } from '../src/lib/club/profile';

/** The app's colors for the shared fixtures; supabase/tests/household-colors.sql checks the database against the same. */
const fx = JSON.parse(readFileSync('supabase/tests/fixtures/member-colors.json', 'utf8')) as {
  households: { name: string; members: { n: string; kind: 'adult' | 'child'; y?: number; archived?: boolean }[]; saved: Record<string, string>; expected: Record<string, string> }[];
};

describe('member colors: the app and the database agree (fixtures)', () => {
  for (const h of fx.households) {
    it(h.name, () => {
      const household = {
        id: 'h', displayName: 'x', profileVersion: 1,
        preferences: { colors: Object.fromEntries(Object.entries(h.saved).map(([n, c]) => [`id-${n}`, c])) },
        members: h.members.map((m) => ({ id: `id-${m.n}`, firstName: m.n, kind: m.kind, role: m.kind === 'child' ? 'child' : 'parent', ...(m.y ? { birthYear: m.y } : {}), ...(m.archived ? { archived: true } : {}) })),
      } as unknown as Household;
      const got = Object.fromEntries(Object.entries(memberColors(household)).map(([id, c]) => [id.slice(3), c.id]));
      expect(got).toEqual(h.expected);
    });
  }
});
