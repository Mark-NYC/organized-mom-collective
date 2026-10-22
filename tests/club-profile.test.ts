import { describe, expect, it } from 'vitest';
import { ageInMonth, parseMonth, planMembers, validateHousehold, type FamilyMember } from '../src/lib/club/profile';
import { adult, families, family, kid, MONTH } from './club/fixtures';

describe('club profile: ages for a kit month', () => {
  it('counts whole years on the first of the month', () => {
    expect(ageInMonth(2019, 11, '2026-11')).toBe(7); // birthday month counts
    expect(ageInMonth(2019, 12, '2026-11')).toBe(6); // not yet
    expect(ageInMonth(2019, 1, '2026-11')).toBe(7);
    expect(ageInMonth(2019, 12, '2026-12')).toBe(7);
  });

  it('assumes the youngest age when the birth month is missing', () => {
    expect(ageInMonth(2019, undefined, '2026-11')).toBe(6);
    expect(ageInMonth(2019, undefined, '2026-12')).toBe(7);
  });

  it('moves ages up by themselves from month to month', () => {
    const m: FamilyMember = { id: 'k', firstName: 'K', kind: 'child', role: 'child', birthYear: 2014, birthMonth: 1 };
    const h = family('h', [adult('a', true), m]);
    expect(planMembers(h, '2026-12')[1]).toMatchObject({ age: 12, stage: 'child' });
    expect(planMembers(h, '2027-01')[1]).toMatchObject({ age: 13, stage: 'teen' });
  });

  it('rejects malformed months', () => {
    expect(() => parseMonth('2026-13')).toThrow();
    expect(() => parseMonth('Nov 2026')).toThrow();
  });

  it('leaves archived people out of planning and keeps names trimmed', () => {
    const h = family('h', [adult('a', true), { ...kid('gone', 6), archived: true }, { ...kid('k', 5), firstName: '  Zoe ' }]);
    expect(planMembers(h, MONTH).map((p) => p.id)).toEqual(['a', 'k']);
    expect(planMembers(h, MONTH)[1].firstName).toBe('Zoe');
  });

  it('only an adult can be the account holder in planning', () => {
    const h = family('h', [adult('a'), { ...kid('k', 9), isAccountHolder: true }]);
    expect(planMembers(h, MONTH).every((p) => !p.isAccountHolder)).toBe(true);
  });
});

describe('club profile: validation (mirrors club_household_save)', () => {
  it('accepts every test family', () => {
    for (const [name, h] of Object.entries(families)) expect(validateHousehold(h, MONTH), name).toEqual([]);
  });

  const problems = (members: FamilyMember[]) => validateHousehold(family('h', members), MONTH);

  it('needs a birth year for children and none for adults', () => {
    expect(problems([adult('a', true), { id: 'k', firstName: 'K', kind: 'child', role: 'child' }]).join()).toMatch(/birth year/);
    expect(problems([{ ...adult('a', true), birthYear: 1990 }]).join()).toMatch(/no birth date for adults/);
  });

  it('refuses a birth month out of range or a child not born yet', () => {
    expect(problems([adult('a', true), { ...kid('k', 5), birthMonth: 13 }]).join()).toMatch(/birth month/);
    expect(problems([adult('a', true), { ...kid('k', 0), birthYear: 2027 }]).join()).toMatch(/after this month/);
  });

  it('allows one account holder, an adult', () => {
    expect(problems([adult('a', true), adult('b', true)]).join()).toMatch(/only one account holder/);
    expect(problems([adult('a'), { ...kid('k', 9), isAccountHolder: true }]).join()).toMatch(/account holder is an adult/);
  });

  it('needs at least one adult and between 1 and 12 people', () => {
    expect(problems([kid('k', 9)]).join()).toMatch(/at least one adult/);
    expect(problems([]).join()).toMatch(/between 1 and 12/);
    expect(problems(Array.from({ length: 13 }, (_, i) => adult(`a${i}`))).join()).toMatch(/between 1 and 12/);
  });

  it('checks names, roles and ids', () => {
    expect(problems([{ ...adult('a', true), firstName: ' ' }]).join()).toMatch(/first name/);
    expect(problems([{ ...adult('a', true), firstName: 'x'.repeat(31) }]).join()).toMatch(/first name/);
    expect(problems([{ ...adult('a', true), role: 'child' }]).join()).toMatch(/child role/);
    expect(problems([adult('a', true), { ...kid('k', 5), role: 'parent' }]).join()).toMatch(/child role/);
    expect(problems([adult('a', true), adult('a')]).join()).toMatch(/duplicate member id/);
  });
});
