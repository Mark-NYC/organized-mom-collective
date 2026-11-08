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

describe('May: when it happens (a time, a real event, or flexible)', () => {
  const kinds = (rows: ReturnType<typeof mayRows>) => Object.fromEntries(rows.map((r) => [r.key, r.when]));
  const trig = (rows: ReturnType<typeof mayRows>) => rows.filter((r) => r.slot?.kind === 'trigger');

  it('Brooks, by default: two times and one real event; everything else flexible (no chain of triggers)', () => {
    const rows = mayRows(state(), ctxOf('brooks', false));
    expect(kinds(rows)).toEqual({ morning: 'time', move: 'flexible', lunch: 'time', quiet: 'trigger', free: 'flexible', snack: 'flexible', evening: 'flexible' });
    expect(row(rows, 'morning').slot).toEqual({ kind: 'time', text: '8:00 AM' });
    expect(row(rows, 'lunch').slot).toEqual({ kind: 'time', text: '12:00 PM' });
    expect(row(rows, 'quiet').slot).toEqual({ kind: 'trigger', text: 'After lunch' });
    for (const k of ['move', 'free', 'snack', 'evening']) expect(row(rows, k).slot, k).toBeNull();
    expect(trig(rows)).toHaveLength(1);
    // A flexible block keeps its time underneath (its color follows the time of day).
    expect(row(rows, 'free').time).toBe('14:00');
    expect(mayIssues(rows)).toEqual([]);
  });

  it('no prepared default is ever a chain: no trigger names the block before it, for any day or family', () => {
    for (const id of ['hughes', 'okafor', 'brooks', 'rivera', 'chen', 'lindqvist', 'goering']) {
      const ctx = ctxOf(id);
      for (const days of ['home', 'mixed', 'camp'] as const) for (const structure of ['relaxed', 'balanced', 'structured'] as const) {
        const rows = mayRows(state({ options: { ...familyDefaults(ctx), days, structure } }), ctx);
        expect(mayIssues(rows), `${id} ${days} ${structure}`).toEqual([]);
        expect(trig(rows).length, `${id} ${days} ${structure}`).toBeLessThanOrEqual(1);
        for (const r of trig(rows)) expect(r.slot!.text, r.key).not.toMatch(/quiet time|play|snack|ready/i);
      }
    }
  });

  it('relaxed: no clock; more structured: the daytime by the clock, the evening flexible; camp: home is the event', () => {
    const relaxed = mayRows(state({ options: { ...DEFAULT_OPTIONS, structure: 'relaxed' } }));
    expect(relaxed.some((r) => r.slot?.kind === 'time')).toBe(false);
    const structured = mayRows(state({ options: { ...DEFAULT_OPTIONS, structure: 'structured' } }));
    expect(structured.filter((r) => r.key !== 'evening').every((r) => r.slot?.kind === 'time')).toBe(true);
    expect(row(structured, 'evening').slot).toBeNull();
    const camp = mayRows(state({ options: { ...DEFAULT_OPTIONS, days: 'camp' } }));
    expect(row(camp, 'morning').slot?.kind).toBe('time');
    expect(row(camp, 'snack').slot).toEqual({ kind: 'trigger', text: 'When we get home' });
    // Quiet Time only follows lunch when lunch comes first.
    expect(defaultKind('quiet', DEFAULT_OPTIONS, ['morning', 'quiet', 'lunch'])).not.toBe('trigger');
  });

  it('all times, all triggers, a mix, or mostly flexible: each block on its own', () => {
    const s = state();
    for (const k of MAY_KEYS) setWhen(s as never, k, 'time');
    const allTimes = mayRows(s);
    expect(allTimes.every((r) => r.slot?.kind === 'time')).toBe(true);
    expect(row(allTimes, 'evening').slot).toEqual({ kind: 'time', text: '5:30 PM' });
    expect(mayIssues(allTimes)).toEqual([]);
    for (const k of MAY_KEYS) setWhen(s as never, k, 'trigger');
    expect(mayRows(s).every((r) => r.slot?.kind === 'trigger')).toBe(true);
    for (const k of MAY_KEYS) setWhen(s as never, k, 'flexible');
    setWhen(s as never, 'lunch', 'time');
    const mostly = mayRows(s);
    expect(mostly.filter((r) => r.slot).map((r) => r.key)).toEqual(['lunch']);
    expect(EVENING_TIME).toBe('17:30');
  });

  it('flexible hides a cue without losing it: switching back restores her time and her trigger', () => {
    const s = state();
    setTrigger(s as never, 'free', 'When the pool closes');
    setWhen(s as never, 'free', 'flexible');
    expect(row(mayRows(s), 'free').slot).toBeNull();
    setWhen(s as never, 'free', 'trigger');
    expect(row(mayRows(s), 'free').slot).toEqual({ kind: 'trigger', text: 'When the pool closes' });
    setTime(s as never, 'lunch', '12:30');
    setWhen(s as never, 'lunch', 'flexible');
    setWhen(s as never, 'lunch', 'time');
    expect(row(mayRows(s), 'lunch').slot).toEqual({ kind: 'time', text: '12:30 PM' });
  });

  it('her trigger is kept exactly as she chose it (even the suggested one), short, never cut mid-word', () => {
    const s = state();
    setTrigger(s as never, 'free', 'After lunch');
    expect(s.edits.free?.trigger).toBe('After lunch');
    setTrigger(s as never, 'free', 'When everyone has finished their chores and had a snack outside');
    expect(row(mayRows(s), 'free').slot!.text.length).toBeLessThanOrEqual(TRIGGER_LIMIT);
    expect(row(mayRows(s), 'free').slot!.text).toBe('When everyone has finished their');
  });

  it('says when a trigger only narrates the order of the day, and other things that don’t add up', () => {
    const s = state();
    setTrigger(s as never, 'free', 'After quiet time');
    setTrigger(s as never, 'snack', 'After afternoon play');
    setTrigger(s as never, 'move', 'When it’s time');
    setTrigger(s as never, 'evening', 'Before dinner');
    setWhen(s as never, 'lunch', 'time');
    setTime(s as never, 'lunch', '07:00');
    const kindsOf = Object.fromEntries(mayIssues(mayRows(s)).map((i) => [i.key, i.kind]));
    expect(kindsOf).toMatchObject({ free: 'chain', snack: 'chain', move: 'vague', evening: 'condition', lunch: 'order' });
    // Real events are fine.
    const ok = state();
    setTrigger(ok as never, 'snack', 'When everyone comes inside');
    setTrigger(ok as never, 'evening', 'After dinner');
    expect(mayIssues(mayRows(ok))).toEqual([]);
    // Evening Reset stays one fluid block: its jobs are never checked against each other.
    const ctx = ctxOf('rivera');
    expect(mayRows(state(), ctx).find((r) => r.key === 'evening')!.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['dinner', 'dishes']));
  });

  it('saved plans keep her choices: her times, her triggers and her words for the jobs', () => {
    const saved = state({ edits: { quiet: readEdit({ time: '13:30' })!, snack: readEdit({ cue: 'After the pool' })!, free: readEdit({ when: 'trigger', trigger: 'After quiet time' })!, move: readEdit({ when: 'trigger' })! } });
    const rows = mayRows(saved);
    expect(row(rows, 'quiet').slot).toEqual({ kind: 'time', text: '1:30 PM' });
    expect(row(rows, 'snack').slot).toEqual({ kind: 'trigger', text: 'After the pool' });
    // A trigger she chose stays, even one the generator no longer suggests.
    expect(row(rows, 'free').slot).toEqual({ kind: 'trigger', text: 'After quiet time' });
    expect(row(rows, 'move').slot?.kind).toBe('trigger');
    expect(whenOf('quiet', { time: '13:30' }, { ...DEFAULT_OPTIONS, structure: 'relaxed' }).when).not.toBe('time');
    expect(readEdit({ when: 'clock', time: '25:00', trigger: 5 })).toEqual({});
    expect(readEdit({ when: 'flexible' })).toEqual({ when: 'flexible' });
  });

  it('the approval fingerprint follows what prints in the box', () => {
    const s = state();
    const before = mayFingerprint(s);
    setWhen(s as never, 'lunch', 'flexible');
    expect(mayFingerprint(s)).not.toBe(before);
  });

  it('small and large families: a few anchors, never a cue on every line', () => {
    for (const id of ['hughes', 'okafor', 'brooks', 'rivera', 'chen']) {
      const ctx = ctxOf(id);
      const rows = mayRows(state({ options: familyDefaults(ctx) }), ctx);
      expect(rows.filter((r) => r.slot).length, id).toBeLessThanOrEqual(3);
      expect(mayIssues(rows), id).toEqual([]);
    }
  });
});

describe('May: moving blocks keeps the day in order', () => {
  it('two timed blocks trading places trade times (like August); triggers and flexible blocks just move', () => {
    const s = state();
    setWhen(s as never, 'quiet', 'time');
    moveBlock(s as never, 'quiet', -1);
    const rows = mayRows(s);
    expect(rows.map((r) => r.key).slice(0, 4)).toEqual(['morning', 'move', 'quiet', 'lunch']);
    expect(rows.find((r) => r.key === 'quiet')!.slot).toEqual({ kind: 'time', text: '12:00 PM' });
    expect(rows.find((r) => r.key === 'lunch')!.slot).toEqual({ kind: 'time', text: '1:00 PM' });
    expect(mayIssues(rows)).toEqual([]);
    setTrigger(s as never, 'free', 'When everyone comes inside');
    moveBlock(s as never, 'free', -1);
    expect(mayRows(s).find((r) => r.key === 'free')!.slot).toEqual({ kind: 'trigger', text: 'When everyone comes inside' });
    const before = JSON.stringify(s.order);
    moveBlock(s as never, 'morning', -1);
    expect(JSON.stringify(s.order)).toBe(before);
  });
});
