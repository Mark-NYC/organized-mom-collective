import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import { familySnapshot } from '../personalize/family';
import { setTaskOwners, setTaskSkip } from '../personalize/edits';
import {
  EVENING_TIME, TRIGGER_LIMIT, defaultKind, mayIssues, moveBlock, readEdit, setTime, setTrigger, setWhen, whenOf,
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

describe('May: when it happens (a time or a trigger, block by block)', () => {
  const kinds = (rows: ReturnType<typeof mayRows>) => Object.fromEntries(rows.map((r) => [r.key, r.slot?.kind ?? null]));

  it('prepared defaults: morning and lunch by the clock, the rest by what comes before; one box per block', () => {
    const rows = mayRows(state(), ctxOf('brooks', false));
    expect(kinds(rows)).toEqual({ morning: 'time', move: 'trigger', lunch: 'time', quiet: 'trigger', free: 'trigger', snack: 'trigger', evening: 'trigger' });
    expect(row(rows, 'morning').slot).toEqual({ kind: 'time', text: '8:00 AM' });
    expect(row(rows, 'quiet').slot).toEqual({ kind: 'trigger', text: 'After lunch' });
    expect(row(rows, 'evening').slot).toEqual({ kind: 'trigger', text: 'When we’re ready for dinner' });
    // A block keeps its time while it shows a trigger (its color follows the time of day).
    expect(row(rows, 'quiet').time).toBe('13:00');
    expect(mayIssues(rows)).toEqual([]);
  });

  it('a relaxed day is all triggers; a more structured day is all times except the flexible evening', () => {
    expect(Object.values(kinds(mayRows(state({ options: { ...DEFAULT_OPTIONS, structure: 'relaxed' } }))))).toEqual(expect.arrayContaining(['trigger']));
    expect(Object.values(kinds(mayRows(state({ options: { ...DEFAULT_OPTIONS, structure: 'relaxed' } })))).every((k) => k === 'trigger')).toBe(true);
    const structured = kinds(mayRows(state({ options: { ...DEFAULT_OPTIONS, structure: 'structured' } })));
    expect(Object.entries(structured).filter(([k]) => k !== 'evening').every(([, v]) => v === 'time')).toBe(true);
    expect(structured.evening).toBe('trigger');
    expect(defaultKind('morning', { ...DEFAULT_OPTIONS, days: 'camp' })).toBe('time');
  });

  it('all times, all triggers, or a mix: each block on its own', () => {
    const s = state();
    for (const k of MAY_KEYS) setWhen(s as never, k, 'time');
    const allTimes = mayRows(s);
    expect(allTimes.every((r) => r.slot?.kind === 'time')).toBe(true);
    expect(row(allTimes, 'evening').slot).toEqual({ kind: 'time', text: '5:30 PM' });
    expect(mayIssues(allTimes)).toEqual([]);
    for (const k of MAY_KEYS) setWhen(s as never, k, 'trigger');
    expect(mayRows(s).every((r) => r.slot?.kind === 'trigger')).toBe(true);
    setWhen(s as never, 'lunch', 'time');
    setTime(s as never, 'lunch', '12:30');
    const mixed = mayRows(s);
    expect(row(mixed, 'lunch').slot).toEqual({ kind: 'time', text: '12:30 PM' });
    expect(row(mixed, 'quiet').slot?.kind).toBe('trigger');
    // Switching back restores the time she set.
    setWhen(s as never, 'lunch', 'trigger');
    setWhen(s as never, 'lunch', 'time');
    expect(row(mayRows(s), 'lunch').time).toBe('12:30');
    expect(EVENING_TIME).toBe('17:30');
  });

  it('her own trigger words, kept short; a long one is cut to the limit, never spilling off the sheet', () => {
    const s = state();
    setTrigger(s as never, 'free', '  When the pool closes ');
    expect(row(mayRows(s), 'free').slot).toEqual({ kind: 'trigger', text: 'When the pool closes' });
    setTrigger(s as never, 'free', 'When everyone has finished their chores and had a snack outside');
    expect(row(mayRows(s), 'free').slot!.text.length).toBeLessThanOrEqual(TRIGGER_LIMIT);
    expect(row(mayRows(s), 'free').slot!.text).toBe('When everyone has finished their');
    // Choosing the prepared one again clears her override.
    setTrigger(s as never, 'free', 'After quiet time');
    expect(s.edits.free?.trigger).toBeUndefined();
  });

  it('says what doesn’t add up, and never calls the flexible evening a contradiction', () => {
    const s = state();
    setTrigger(s as never, 'quiet', 'Before dinner');
    setTrigger(s as never, 'free', 'When we’re ready');
    setTrigger(s as never, 'move', 'After snack');
    setWhen(s as never, 'lunch', 'time');
    setTime(s as never, 'lunch', '07:00');
    const kindsOf = Object.fromEntries(mayIssues(mayRows(s)).map((i) => [i.key, i.kind]));
    expect(kindsOf).toMatchObject({ quiet: 'condition', free: 'vague', move: 'circular', lunch: 'order' });
    const ctx = ctxOf('rivera');
    const evening = mayRows(state(), ctx).find((r) => r.key === 'evening')!;
    expect(evening.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['dinner', 'dishes']));
    expect(mayIssues(mayRows(state(), ctx)).filter((i) => i.key === 'evening')).toEqual([]);
  });

  it('plans saved before triggers read as they were: her times stay times; her jobs’ moment becomes the trigger', () => {
    // A time she set on a block that now defaults to a trigger keeps showing that time.
    const saved = state({ edits: { quiet: readEdit({ time: '13:30' })!, snack: readEdit({ cue: 'After the pool' })!, free: readEdit({ time: '' })! } });
    const rows = mayRows(saved);
    expect(row(rows, 'quiet').slot).toEqual({ kind: 'time', text: '1:30 PM' });
    expect(row(rows, 'snack').slot).toEqual({ kind: 'trigger', text: 'After the pool' });
    // "No set time" stays as she left it: the prepared trigger, since no time was shown before.
    expect(row(rows, 'free').slot?.kind).toBe('trigger');
    // A relaxed day never printed times, so a stored time doesn't suddenly appear.
    expect(whenOf('quiet', { time: '13:30' }, { ...DEFAULT_OPTIONS, structure: 'relaxed' }).when).toBe('trigger');
    // Malformed saved values are dropped.
    expect(readEdit({ when: 'clock', time: '25:00', trigger: 5 })).toEqual({});
    // Choosing a kind keeps her earlier words.
    setWhen(saved as never, 'snack', 'trigger');
    expect(row(mayRows(saved), 'snack').slot!.text).toBe('After the pool');
  });

  it('reordering keeps each block’s own time or trigger; a removed block takes its timing with it', () => {
    const s = state({ order: ['morning', 'lunch', 'move', 'create', 'quiet', 'free', 'snack', 'evening'] });
    setTrigger(s as never, 'move', 'After lunch');
    const rows = mayRows(s);
    expect(rows.map((r) => r.key)).toEqual(['morning', 'lunch', 'move', 'quiet', 'free', 'snack', 'evening']);
    expect(row(rows, 'move').slot!.text).toBe('After lunch');
    expect(mayRows({ ...s, options: { ...DEFAULT_OPTIONS, snack: false } }).some((r) => r.key === 'snack')).toBe(false);
  });

  it('the approval fingerprint follows what prints in the box', () => {
    const s = state();
    const before = mayFingerprint(s);
    setWhen(s as never, 'quiet', 'time');
    expect(mayFingerprint(s)).not.toBe(before);
  });

  it('small and large families: the same timing for everyone, jobs stay on their blocks', () => {
    for (const id of ['hughes', 'okafor', 'brooks', 'rivera', 'chen']) {
      const ctx = ctxOf(id);
      const rows = mayRows(state({ options: familyDefaults(ctx) }), ctx);
      expect(rows.every((r) => r.slot !== null)).toBe(true);
      expect(mayIssues(rows), id).toEqual([]);
    }
  });
});

describe('May: moving blocks keeps the day in order', () => {
  it('two timed blocks trading places trade times (like August); a trigger moves with its block', () => {
    const s = state();
    setWhen(s as never, 'quiet', 'time');
    moveBlock(s as never, 'quiet', -1);
    const rows = mayRows(s);
    expect(rows.map((r) => r.key).slice(0, 4)).toEqual(['morning', 'move', 'quiet', 'lunch']);
    expect(rows.find((r) => r.key === 'quiet')!.slot).toEqual({ kind: 'time', text: '12:00 PM' });
    expect(rows.find((r) => r.key === 'lunch')!.slot).toEqual({ kind: 'time', text: '1:00 PM' });
    expect(mayIssues(rows)).toEqual([]);
    // A trigger block just moves.
    moveBlock(s as never, 'free', -1);
    expect(mayRows(s).find((r) => r.key === 'free')!.slot).toEqual({ kind: 'trigger', text: 'After quiet time' });
    // Nothing past the ends.
    const before = JSON.stringify(s.order);
    moveBlock(s as never, 'morning', -1);
    expect(JSON.stringify(s.order)).toBe(before);
  });
});
