import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { memberColors } from '../../../data/club/family-colors';
import { contrast } from '../month-tints';
import type { Household } from '../profile';
import { rhythmView, freshState, type RhythmMember } from '../engines/march-family-rhythm';
import { mayContext, mayRows, DEFAULT_OPTIONS, MAY_KEYS, type MayMember } from '../engines/may-summer-rhythm';
import { applyFamily, augView, freshState as augFresh, type AugMember } from '../engines/august-school-routines';
import { colorFor, familyColors, inkOf, NEUTRAL_COLOR } from './colors';
import { CUE, cueFor, sharedCue } from './cues';
import { familyContext, familySnapshot, inSchool } from './family';
import { setTaskCue, withEdits } from './edits';
import { assignTasks } from './assign';
import { toInput, draftsFrom } from '../../../components/club/FamilyForm';

const rivera = sampleHouseholds.find((s) => s.id === 'rivera')!;
const H = rivera.household;
const custom: Household = { ...H, preferences: { ...H.preferences, colors: { 'sample-rivera-sofia': 'orange', 'sample-rivera-ana': 'teal' } } };
const byName = (colors: Record<string, { id: string }>, h: Household) => Object.fromEntries(h.members.map((m) => [m.firstName, colors[m.id]?.id]));

describe('family-member colors: January’s assignment, everywhere', () => {
  it('is January’s memberColors exactly, by member id', () => {
    const jan = memberColors(H);
    const shared = familyColors(H);
    for (const id of Object.keys(jan)) expect(shared[id]).toMatchObject({ id: jan[id].id, hex: jan[id].hex });
    expect(familyContext(H.members, H.preferences, '2027-03').colors).toEqual(shared);
  });

  it('a customized color shows in March, May and August', () => {
    const march = rhythmView(freshState(), custom.members as RhythmMember[], custom.preferences);
    expect(march.people.find((c) => c.name === 'Sofia')!.color.id).toBe('orange');
    expect(march.people.find((c) => c.name === 'Ana')!.color.id).toBe('teal');
    expect(march.printed.flatMap((m) => m.rows).flatMap((r) => r.owners).find((o) => o.name === 'Sofia')!.color.id).toBe('orange');
    const may = mayRows({ options: DEFAULT_OPTIONS, edits: {}, order: [...MAY_KEYS] }, mayContext(custom.members as MayMember[], custom.preferences, familySnapshot(rivera.profile)));
    const sofia = may.flatMap((r) => r.parts).flatMap((p) => p.owners).find((o) => o.name === 'Sofia')!;
    expect(sofia.color.id).toBe('orange');
    const m = custom.members as AugMember[];
    const aug = augView(applyFamily(augFresh(m), m), m, custom.preferences);
    expect(aug.plan.sections.flatMap((s) => s.tasks).flatMap((t) => t.owners).find((o) => o.name === 'Sofia')!.color.id).toBe('orange');
    expect(aug.charts[0].kids.find((k) => k.name === 'Sofia')!.color.id).toBe('orange');
  });

  it('saved colors never move when members are reordered, added or removed', () => {
    const before = byName(familyColors(custom), custom);
    const reordered = { ...custom, members: [...custom.members].reverse() };
    expect(byName(familyColors(reordered), reordered)).toMatchObject({ Sofia: before.Sofia, Ana: before.Ana });
    const added = { ...custom, members: [...custom.members.slice(0, 2), { id: 'new-kid', firstName: 'Nia', kind: 'child' as const, role: 'child' as const, birthYear: 2024, birthMonth: 1 }, ...custom.members.slice(2)] };
    expect(byName(familyColors(added), added)).toMatchObject({ Sofia: 'orange', Ana: 'teal' });
    expect(familyColors(added)['new-kid'].id).not.toMatch(/orange|teal/);
  });

  it('saving the family page keeps everyone’s current color, so adding someone later shifts nobody', () => {
    // January's flow: the family page saves every current (auto) color with the family; then a new child is added.
    const today = '2026-11';
    const d = draftsFrom(H, today);
    const auto = Object.fromEntries(Object.entries(memberColors(H)).map(([id, c]) => [id, c.id]));
    const saved = toInput(d.me, d.adults, d.kids, { displayName: 'The Rivera Family', pets: true, colors: auto }, H.preferences, today);
    const after: Household = { ...H, preferences: saved.preferences, members: [...H.members, { id: 'new-kid', firstName: 'Nia', kind: 'child', role: 'child', birthYear: 2024, birthMonth: 1 }] };
    const now = familyColors(after);
    for (const m of H.members) expect(now[m.id].id).toBe(auto[m.id]);
    // And reordered: still the same.
    const moved = { ...after, members: [...after.members].reverse() };
    for (const m of H.members) expect(familyColors(moved)[m.id].id).toBe(auto[m.id]);
  });

  it('has a neutral fallback and readable ink for small type on every paper', () => {
    expect(colorFor(familyColors(H), 'nobody')).toBe(NEUTRAL_COLOR);
    expect(colorFor(undefined, undefined)).toBe(NEUTRAL_COLOR);
    for (const c of Object.values(familyColors(sampleHouseholds.find((s) => s.id === 'chen')!.household))) {
      for (const paper of ['#FFFFFF', '#F4ECD9', '#F8E8B5']) expect(contrast(c.ink, paper)).toBeGreaterThanOrEqual(4.5);
    }
    // Light marker inks (orange) are darkened for type; the dot keeps the true marker color.
    expect(inkOf('#D9661F')).not.toBe('#D9661F');
  });
});

describe('habit cues: real daily events, true to her answers', () => {
  const ctx = familyContext(H.members, H.preferences, '2027-08', familySnapshot(rivera.profile));
  it('never gives a school-day cue to a child who isn’t in school', () => {
    const okafor = sampleHouseholds.find((s) => s.id === 'okafor')!.household;
    const o = familyContext(okafor.members, {}, '2027-03');
    // Zara is 3 in March 2027: not in school.
    expect(inSchool(o, 'sample-okafor-zara')).toBe(false);
    expect(cueFor(o, CUE.home, 'sample-okafor-zara')).toBe(CUE.lunch);
    expect(cueFor(ctx, CUE.home, 'sample-rivera-sofia')).toBe(CUE.home);
    // A homeschooling family: no "after school".
    const home = familyContext(H.members, { school: 'homeschool' }, '2027-08');
    expect(cueFor(home, CUE.school, 'sample-rivera-mateo')).toBe(CUE.lunch);
    // No children: no cue about the kids.
    const hughes = familyContext(sampleHouseholds.find((s) => s.id === 'hughes')!.household.members, {}, '2027-08');
    expect(cueFor(hughes, CUE.kidsDown)).toBe(CUE.bed);
    expect(sharedCue(ctx, CUE.home, ['sample-rivera-sofia', 'sample-rivera-mateo'])).toBe(CUE.home);
  });

  it('March: every moment has a shared cue (an event, never a time) and a finish line', () => {
    const v = rhythmView(freshState(), H.members as RhythmMember[], H.preferences);
    for (const m of v.printed) { expect(m.cue).toBeTruthy(); expect(m.cue).not.toMatch(/\d/); expect(m.finish).toMatch(/\.$/); }
  });

  it('shared tasks carry their cue; her cue is kept, the prepared one clears it', () => {
    const tasks = [{ id: 'unpack', title: 'Unpack', mode: 'each' as const, who: 'child' as const, minAge: 4, cue: CUE.home }];
    const prepared = assignTasks(tasks, ctx);
    expect(withEdits(prepared, {}, ctx)[0].cue).toBe(CUE.home);
    const edits = {};
    setTaskCue(edits, 'unpack', '  Right after snack. ', CUE.home);
    expect(withEdits(prepared, edits, ctx)[0]).toMatchObject({ cue: 'Right after snack', changed: true });
    setTaskCue(edits, 'unpack', CUE.home, CUE.home);
    expect(edits).toEqual({});
  });
});
