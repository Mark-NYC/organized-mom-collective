import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot } from '../personalize/family';
import { setTaskOwners, setTaskSkip } from '../personalize/edits';
import {
  DEFAULT_OPTIONS, MAY_KEYS, familyDefaults, interestsOf, mayContext, mayFingerprint, mayParts, mayRows, readSaved, starter, visibleKeys,
  type MayMember, type MayState,
} from './may-summer-rhythm';

const sample = (id: string) => sampleHouseholds.find((s) => s.id === id)!;
const ctxOf = (id: string, withProfile = true) => {
  const s = sample(id);
  return mayContext(s.household.members as MayMember[], s.household.preferences, withProfile ? familySnapshot(s.profile) : undefined);
};
const state = (over: Partial<MayState> = {}): Pick<MayState, 'options' | 'edits' | 'order' | 'parts' | 'familyLabel'> =>
  ({ options: { ...DEFAULT_OPTIONS }, edits: {}, order: [...MAY_KEYS], familyLabel: 'X', ...over });
const row = (rows: ReturnType<typeof mayRows>, key: string) => rows.find((r) => r.key === key)!;

describe('May: Our Summer Day, prepared from the family', () => {
  it('keeps the established anchors and order, flexible times, Create & Explore only on camp days', () => {
    expect(visibleKeys(MAY_KEYS, DEFAULT_OPTIONS)).toEqual(['morning', 'move', 'lunch', 'quiet', 'free', 'snack', 'evening']);
    expect(visibleKeys(MAY_KEYS, { ...DEFAULT_OPTIONS, structure: 'relaxed' })).not.toContain('move');
    expect(visibleKeys(MAY_KEYS, { ...DEFAULT_OPTIONS, days: 'camp' })).toContain('create');
    expect(starter('evening', DEFAULT_OPTIONS).time).toBe('');
    expect(starter('morning', { ...DEFAULT_OPTIONS, start: 7.5 }).time).toBe('07:30');
  });

  it('quiet time and play from the children’s ages and interests', () => {
    // Rivera: Sofia plays soccer. Okafor: a toddler rests. Lindqvist: robotics and hockey.
    expect(familyDefaults(ctxOf('rivera')).play).toBe('active');
    expect(interestsOf(ctxOf('rivera')).sports).toEqual(['Soccer']);
    expect(familyDefaults(ctxOf('okafor')).quiet).toBe('rest');
    // Nils is 11 in May 2027, so the Lindqvists keep independent quiet time; teens alone get a recharge.
    expect(familyDefaults(ctxOf('lindqvist')).quiet).toBe('independent');
    const teens = mayContext([{ id: 'p', firstName: 'Pat', kind: 'adult' }, { id: 't1', firstName: 'Ty', kind: 'child', birthYear: 2012, birthMonth: 1 }, { id: 't2', firstName: 'Bo', kind: 'child', birthYear: 2010, birthMonth: 1 }], {});
    expect(familyDefaults(teens).quiet).toBe('older');
    expect(familyDefaults(ctxOf('lindqvist')).play).toBe('mixed');
    // Chen: piano, a swim team; a six-year-old: independent quiet time.
    const chen = ctxOf('chen');
    expect(starter('move', familyDefaults(chen), chen).desc).toContain('Swim team practice');
    // No profile: the prepared day, unchanged.
    expect(familyDefaults(ctxOf('brooks', false))).toEqual({ ...DEFAULT_OPTIONS });
  });

  it('every activity line stays within the printable’s limit', () => {
    for (const id of ['rivera', 'chen', 'lindqvist', 'brooks', 'okafor']) {
      const ctx = ctxOf(id);
      for (const days of ['home', 'mixed', 'camp'] as const) {
        for (const r of mayRows(state({ options: { ...familyDefaults(ctx), days } }), ctx)) expect(r.desc.length).toBeLessThanOrEqual(78);
      }
    }
  });

  it('shared family responsibilities sit on their anchors, with real names; grown-ups too', () => {
    const ctx = ctxOf('rivera');
    const rows = mayRows(state(), ctx);
    const parts = rows.flatMap((r) => r.parts);
    expect(row(rows, 'morning').parts.find((p) => p.id === 'beds')!.who).toBe('Sofia, Mateo and Elena');
    // Sofia already feeds the dog; meals are Ana and Luis's: dinner is a grown-up's.
    expect(row(rows, 'morning').parts.find((p) => p.id === 'pets')!.who).toBe('Mateo');
    expect(['Ana', 'Luis']).toContain(row(rows, 'evening').parts.find((p) => p.id === 'dinner')!.who);
    // The shared jobs are spread: no child holds every one.
    const shared = parts.filter((p) => p.ownerIds.length === 1 && p.ownerIds[0].includes('sofia'));
    expect(shared.length).toBeLessThan(parts.filter((p) => p.ownerIds.length === 1).length);
    // No pets, no pet job; a toddler gets only what fits.
    expect(mayParts(ctxOf('brooks', false)).some((p) => p.id === 'pets')).toBe(false);
    const ok = mayParts(ctxOf('okafor'));
    expect(ok.filter((p) => p.ownerIds.includes('sample-okafor-zara')).map((p) => p.id)).toEqual(['beds', 'pets', 'set-table', 'clear', 'snack-away', 'pickup'].filter((x) => ok.find((p) => p.id === x)?.ownerIds.includes('sample-okafor-zara')));
    for (const p of ok.filter((x) => x.ownerIds.includes('sample-okafor-zara'))) expect(['beds', 'pets', 'set-table', 'clear', 'snack-away', 'pickup']).toContain(p.id);
  });

  it('never assumes the account holder: she leans last among the grown-ups', () => {
    const parts = mayParts(ctxOf('rivera'));
    const ana = parts.filter((p) => p.ownerIds.length === 1 && p.ownerIds[0] === 'sample-rivera-ana').length;
    const luis = parts.filter((p) => p.ownerIds.length === 1 && p.ownerIds[0] === 'sample-rivera-luis').length;
    expect(ana).toBeLessThanOrEqual(luis);
  });

  it('her changes to who helps print, and are kept when they’re saved', () => {
    const ctx = ctxOf('rivera');
    const s = state({ parts: {} });
    const before = mayFingerprint(s, ctx);
    setTaskOwners(s.parts!, 'dinner', ['sample-rivera-sofia', 'sample-rivera-luis']);
    setTaskSkip(s.parts!, 'set-table', true);
    const rows = mayRows(s, ctx);
    expect(row(rows, 'evening').parts.find((p) => p.id === 'dinner')!.who).toBe('Sofia and Luis');
    expect(row(rows, 'lunch').parts.some((p) => p.id === 'set-table')).toBe(false);
    expect(mayFingerprint(s, ctx)).not.toBe(before);
    const saved = readSaved(JSON.parse(JSON.stringify({ parts: s.parts, snapshot: familySnapshot(sample('rivera').profile) })));
    expect(saved.parts).toEqual(s.parts);
    expect(saved.snapshot?.v).toBe(1);
    expect(readSaved({ parts: { x: { owners: 3 } }, snapshot: { v: 7 } })).toEqual({});
  });

  it('a limited profile or no children still gives a complete, honest rhythm', () => {
    const goering = mayRows(state(), ctxOf('goering'));
    expect(goering.map((r) => r.key)).toEqual(['morning', 'move', 'lunch', 'quiet', 'free', 'snack', 'evening']);
    expect(goering.flatMap((r) => r.parts).every((p) => p.who)).toBe(true);
    const hughes = mayRows(state(), ctxOf('hughes'));
    expect(hughes.flatMap((r) => r.parts).every((p) => p.ownerIds.every((i) => i === 'sample-hughes-claire'))).toBe(true);
    // Without a family (before it loads): the prepared day, no names.
    expect(mayRows(state()).every((r) => r.parts.length === 0)).toBe(true);
  });
});
