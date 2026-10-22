import { describe, expect, it } from 'vitest';
import { kit } from '../src/data/club/kits/2026-11-family-ownership';
import type { KitItem } from '../src/data/club/types';
import {
  acceptSuggestion, addRow, assign, dismissSuggestion, EditError, initialEdits, move, readEdits, remove, rename, replace,
  resolveDocument, restore, setCoach, setDoneMeans, setFrequency, setLevel, suggestionId, type DocumentEdits,
} from '../src/lib/club/edits';
import { generateOwnership } from '../src/lib/club/engines/responsibilities';
import type { FamilyMember, Household } from '../src/lib/club/profile';
import { adult, families, family, kid, MONTH } from './club/fixtures';

const items = kit.items;
const start = (h: Household) => initialEdits(h, items, MONTH);
const show = (h: Household, e: DocumentEdits, list: readonly KitItem[] = items, month = MONTH) => resolveDocument(h, list, month, e);
const rowOf = (h: Household, e: DocumentEdits, rowId: string) => [...show(h, e).rows, ...show(h, e).hidden].find((r) => r.rowId === rowId)!;
const withMembers = (h: Household, members: FamilyMember[]): Household => ({ ...h, profileVersion: h.profileVersion + 1, members });
/** What she'd see on paper: the parts of each row that edits and profile changes must never move. */
const paper = (h: Household, e: DocumentEdits, list: readonly KitItem[] = items, withLevel = true) =>
  Object.fromEntries([...show(h, e, list).rows, ...show(h, e, list).hidden].map((r) => [r.rowId, { title: r.title, ownerId: r.ownerId, frequency: r.frequency, itemId: r.itemId, section: r.section, ...(withLevel ? { level: r.level } : {}) }]));

describe('club edits: first open', () => {
  it('shows exactly what the engine suggested, with no pending suggestions', () => {
    for (const [name, h] of Object.entries(families)) {
      const e = start(h);
      const engine = generateOwnership(h, items, MONTH).rows;
      const shown = show(h, e);
      expect(shown.rows.map((r) => [r.rowId, r.ownerId, r.level, r.coachId]), name).toEqual(engine.map((r) => [r.rowId, r.ownerId, r.level, r.coachId]));
      expect(shown.suggestions, name).toEqual([]);
      expect(shown.rows.every((r) => !r.edited)).toBe(true);
    }
  });

  it('fits in the database column (32 KB) for the biggest family', () => {
    for (const h of Object.values(families)) expect(JSON.stringify(start(h)).length).toBeLessThan(32_768);
  });
});

describe('club edits: every suggestion is editable, removable and replaceable', () => {
  const h = families.A;
  const e0 = start(h);

  it('reassigns, rewords, changes frequency, level and coach', () => {
    let e = assign(e0, h, 'set-the-table', 'ben');
    e = rename(e, 'set-the-table', '  Set the table,   every night ');
    e = setFrequency(e, 'set-the-table', 'weekdays');
    e = setLevel(e, 'set-the-table', 'owns');
    const r = rowOf(h, e, 'set-the-table');
    expect(r).toMatchObject({ ownerId: 'ben', title: 'Set the table, every night', frequency: 'weekdays', level: 'owns', coachId: null, edited: true });
    e = setLevel(e, 'set-the-table', 'with-check');
    e = setCoach(e, h, 'set-the-table', 'dad');
    expect(rowOf(h, e, 'set-the-table')).toMatchObject({ level: 'with-check', coachId: 'dad' });
    expect(rowOf(h, rename(e, 'set-the-table', ''), 'set-the-table').title).toBe(items.find((i) => i.id === 'set-the-table')!.title);
  });

  it('rewords what “done” looks like, and puts the suggestion back when cleared', () => {
    const e = setDoneMeans(e0, 'set-the-table', '  Plates and cups out by 5:45. ');
    expect(rowOf(h, e, 'set-the-table')).toMatchObject({ doneMeans: 'Plates and cups out by 5:45.', edited: true });
    expect(rowOf(h, setDoneMeans(e, 'set-the-table', ''), 'set-the-table').doneMeans).toBe(items.find((i) => i.id === 'set-the-table')!.doneMeans);
    expect(() => setDoneMeans(e0, 'set-the-table', 'x'.repeat(161))).toThrow('invalid_done');
    // Swapping the job drops wording written for the old one.
    expect(rowOf(h, replace(e, items, 'set-the-table', 'water-the-plants'), 'set-the-table').doneMeans).toBe(items.find((i) => i.id === 'water-the-plants')!.doneMeans);
    expect(readEdits(JSON.parse(JSON.stringify(e))).done).toEqual({ 'set-the-table': 'Plates and cups out by 5:45.' });
  });

  it('removes a suggestion (hidden, restorable) and never suggests it again', () => {
    const e = remove(e0, 'set-the-table');
    expect(show(h, e).rows.some((r) => r.rowId === 'set-the-table')).toBe(false);
    expect(show(h, e).hidden.map((r) => r.rowId)).toContain('set-the-table');
    expect(show(h, e).suggestions.some((s) => s.kind === 'add' && s.row.itemId === 'set-the-table')).toBe(false);
    expect(show(h, restore(e, 'set-the-table')).rows.some((r) => r.rowId === 'set-the-table')).toBe(true);
  });

  it('replaces a suggestion with another library job, keeping its place and owner', () => {
    const before = show(h, e0).rows;
    const at = before.findIndex((r) => r.rowId === 'set-the-table');
    const owner = before[at].ownerId;
    const e = replace(e0, items, 'set-the-table', 'water-the-plants');
    const after = show(h, e);
    expect(after.rows[at]).toMatchObject({ rowId: 'set-the-table', itemId: 'water-the-plants', ownerId: owner, edited: true });
    expect(after.rows[at].title).toBe(items.find((i) => i.id === 'water-the-plants')!.title);
    // Neither the old job nor the new one comes back as a suggestion.
    expect(after.suggestions.filter((s) => s.kind === 'add' && ['set-the-table', 'water-the-plants'].includes(s.row.itemId))).toEqual([]);
    expect(() => replace(e0, items, 'set-the-table', 'nope')).toThrow(EditError);
  });

  it('adds her own jobs, typed or from the library, and deletes them outright', () => {
    let e = addRow(e0, h, { title: 'Walk to the mailbox', ownerId: 'ava', frequency: 'daily' });
    e = addRow(e, h, { title: '', item: items.find((i) => i.id === 'vacuum-the-living-room'), ownerId: 'cal' });
    const added = show(h, e).rows.filter((r) => r.custom);
    expect(added.map((r) => [r.rowId, r.title, r.ownerId])).toEqual([
      ['custom-1', 'Walk to the mailbox', 'ava'],
      ['custom-2', 'Vacuum the living room', 'cal'],
    ]);
    expect(added[1]).toMatchObject({ itemId: 'vacuum-the-living-room', level: expect.any(String) });
    const gone = remove(e, 'custom-1');
    expect(show(h, gone).rows.some((r) => r.rowId === 'custom-1')).toBe(false);
    expect(show(h, gone).hidden.some((r) => r.rowId === 'custom-1')).toBe(false);
    expect(addRow(gone, h, { title: 'Another' }).added.map((r) => r.rowId)).toEqual(['custom-2', 'custom-3']);
  });

  it('reorders rows, and keeps the order when anything else changes', () => {
    const ids = show(h, e0).rows.map((r) => r.rowId);
    const last = ids[ids.length - 1];
    const e = move(e0, ids, last, 0);
    expect(show(h, e).rows[0].rowId).toBe(last);
    const later = addRow(assign(e, h, ids[1], 'dad'), h, { title: 'Water the garden' });
    expect(show(h, later).rows[0].rowId).toBe(last);
  });

  it('flags a job given to someone younger than suggested, without blocking it', () => {
    const e = assign(e0, h, 'take-out-the-trash', 'ava');
    expect(rowOf(h, e, 'take-out-the-trash')).toMatchObject({ ownerId: 'ava', belowSuggestedAge: true });
  });

  it('refuses edits it can’t keep', () => {
    expect(() => assign(e0, h, 'nope', 'ben')).toThrow('unknown_row');
    expect(() => assign(e0, h, 'set-the-table', 'stranger')).toThrow('unknown_member');
    const archived = withMembers(h, h.members.map((m) => (m.id === 'cal' ? { ...m, archived: true } : m)));
    expect(() => assign(e0, archived, 'set-the-table', 'cal')).toThrow('unknown_member');
    expect(() => rename(e0, 'set-the-table', 'x'.repeat(81))).toThrow('invalid_title');
    expect(() => addRow(e0, h, { title: '   ' })).toThrow('invalid_title');
    expect(() => setFrequency(e0, 'set-the-table', 'hourly' as never)).toThrow('invalid_frequency');
  });

  it('never mutates the edits it was given', () => {
    const frozen = JSON.stringify(e0);
    assign(e0, h, 'set-the-table', 'ben');
    remove(e0, 'set-the-table');
    addRow(e0, h, { title: 'X' });
    expect(JSON.stringify(e0)).toBe(frozen);
  });
});

describe('club edits: family changes never overwrite her chart', () => {
  const h = families.A;
  const edited = (() => {
    let e = start(h);
    e = assign(e, h, 'set-the-table', 'dad');
    e = rename(e, 'empty-the-dishwasher', 'Dishwasher out before school');
    e = setFrequency(e, 'take-out-the-trash', 'twice-weekly');
    return e;
  })();

  it('a new child: nothing on the chart moves; their jobs arrive as suggestions she can add or dismiss', () => {
    const h2 = withMembers(h, [...h.members, kid('dot', 8)]);
    expect(paper(h2, edited)).toEqual(paper(h, edited));
    const s = show(h2, edited).suggestions;
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.kind === 'add' && x.row.ownerId === 'dot')).toBe(true);
    const first = s[0];
    const accepted = acceptSuggestion(edited, first);
    expect(show(h2, accepted).rows.some((r) => first.kind === 'add' && r.rowId === first.row.rowId)).toBe(true);
    const dismissed = dismissSuggestion(edited, s[1]);
    expect(show(h2, dismissed).suggestions.map((x) => (x.kind === 'add' ? x.row.rowId : x.rowId))).not.toContain(s[1].kind === 'add' ? s[1].row.rowId : '');
    // Dismissed stays dismissed after further changes.
    const h3 = withMembers(h2, h2.members.map((m) => (m.id === 'dot' ? { ...m, firstName: 'Dorothy' } : m)));
    expect(show(h3, dismissed).suggestions.some((x) => x.kind === 'add' && s[1].kind === 'add' && x.row.rowId === s[1].row.rowId)).toBe(false);
  });

  it('a birthday or a corrected age: owners, wording and frequency stay as they were', () => {
    const older = withMembers(h, h.members.map((m) => (m.id === 'ava' ? { ...m, birthYear: m.birthYear! - 3 } : m)));
    expect(paper(older, edited)).toEqual(paper(h, edited));
    expect(paper(h, edited)).toEqual(paper(h, edited));
    // A year later the same chart, same owners.
    expect(paper(h, edited)).toEqual(Object.fromEntries(Object.entries(paper({ ...h }, edited))));
    const nextYear = show(h, edited, items, '2027-10').rows;
    expect(Object.fromEntries(nextYear.map((r) => [r.rowId, r.ownerId]))).toEqual(Object.fromEntries(Object.entries(paper(h, edited)).map(([k, v]) => [k, v.ownerId])));
  });

  it('a renamed person: same rows, same owner ids', () => {
    const renamed = withMembers(h, h.members.map((m) => (m.id === 'ben' ? { ...m, firstName: 'Benjamin' } : m)));
    expect(paper(renamed, edited)).toEqual(paper(h, edited));
    expect(show(renamed, edited).suggestions).toEqual([]);
  });

  it('someone leaves: their jobs stay, marked "Needs a new owner", with an owner offered, never auto-applied', () => {
    const gone = withMembers(h, h.members.map((m) => (m.id === 'cal' ? { ...m, archived: true } : m)));
    const shown = show(gone, edited);
    const cals = shown.rows.filter((r) => r.ownerId === 'cal');
    expect(cals.length).toBeGreaterThan(0);
    expect(cals.every((r) => r.needsOwner && r.level === null)).toBe(true);
    // Everything but the level of Cal's own jobs (a job with no owner has no level).
    expect(paper(gone, edited, items, false)).toEqual(paper(h, edited, items, false));
    const offers = shown.suggestions.filter((s) => s.kind === 'owner');
    expect(offers.length).toBeGreaterThan(0);
    const taken = acceptSuggestion(edited, offers[0]);
    const r = rowOf(gone, taken, offers[0].kind === 'owner' ? offers[0].rowId : '');
    expect(r).toMatchObject({ needsOwner: false, edited: true });
    expect(show(gone, dismissSuggestion(edited, offers[0])).suggestions).not.toContainEqual(offers[0]);
  });

  it('owner offers for open jobs never pile onto the account holder', () => {
    const partnerGone = withMembers(h, h.members.map((m) => (m.id === 'dad' ? { ...m, archived: true } : m)));
    const offers = show(partnerGone, start(h)).suggestions.filter((s) => s.kind === 'owner');
    const toMom = offers.filter((s) => s.kind === 'owner' && s.ownerId === 'mom').length;
    const open = show(partnerGone, start(h)).rows.filter((r) => r.needsOwner).length;
    expect(toMom).toBeLessThan(open);
  });

  it('a job she deliberately left without an owner gets no owner offers', () => {
    const open = assign(start(h), h, 'set-the-table', null);
    expect(rowOf(h, open, 'set-the-table')).toMatchObject({ ownerId: null, needsOwner: true });
    expect(show(h, open).suggestions.filter((s) => s.kind === 'owner' && s.rowId === 'set-the-table')).toEqual([]);
  });

  it('a job she edited is never re-suggested, even when its owner leaves', () => {
    const gone = withMembers(h, h.members.map((m) => (m.id === 'dad' ? { ...m, archived: true } : m)));
    const s = show(gone, edited).suggestions;
    expect(s.filter((x) => x.kind === 'add' && x.row.rowId === 'set-the-table')).toEqual([]);
    expect(rowOf(gone, edited, 'set-the-table')).toMatchObject({ ownerId: 'dad', needsOwner: true, edited: true });
  });

  it('kit rules change: a job dropped from the library stays on her chart as she had it', () => {
    const fewer = items.filter((i) => i.id !== 'empty-the-dishwasher');
    const r = show(h, edited, fewer).rows.find((x) => x.rowId === 'empty-the-dishwasher')!;
    expect(r).toMatchObject({ title: 'Dishwasher out before school' });
    expect(paper(h, edited, fewer)).toEqual(paper(h, edited));
  });
});

describe('club edits: levels are part of her chart', () => {
  it('a partner joining a one-adult home doesn’t quietly lower the kids’ levels', () => {
    const solo = families.B;
    const e = start(solo);
    const levels = (h: Household) => Object.fromEntries(show(h, e).rows.map((r) => [r.rowId, r.level]));
    const withPartner = withMembers(solo, [...solo.members, adult('co')]);
    expect(levels(withPartner)).toEqual(levels(solo));
  });

  it('a birthday doesn’t move a job up by itself; she does', () => {
    const h = families.A;
    const e = start(h);
    const row = show(h, e).rows.find((r) => r.ownerId === 'ava' && r.level === 'learning')!;
    const older = withMembers(h, h.members.map((m) => (m.id === 'ava' ? { ...m, birthYear: m.birthYear! - 4 } : m)));
    expect(rowOf(older, e, row.rowId).level).toBe('learning');
    expect(rowOf(older, setLevel(e, row.rowId, 'owns'), row.rowId).level).toBe('owns');
  });

  it('reassigning a job works out the level for its new owner', () => {
    const h = families.A;
    const e = start(h);
    const household = new Set(items.filter((i) => i.scope === 'household').map((i) => i.id));
    const row = show(h, e).rows.find((r) => r.ownerId === 'ava' && household.has(r.itemId ?? '') && r.level === 'learning')!;
    expect(rowOf(h, assign(e, h, row.rowId, 'cal'), row.rowId).level).not.toBe('learning');
  });

  it('reads saves made before levels were kept', () => {
    const h = families.A;
    const e = start(h);
    const old = JSON.parse(JSON.stringify(e));
    for (const r of old.accepted) delete r.level;
    expect(show(h, readEdits(old)).rows.map((r) => r.level)).toEqual(show(h, e).rows.map((r) => r.level));
  });
});

describe('club edits: workload balance suggestions', () => {
  const solo = family('hh-bal-e', [adult('mom', true), kid('ben', 9), kid('cal', 6)]);
  const withPartner = withMembers(solo, [...solo.members, adult('dad')]);

  it('offers optional moves when a partner joins, applies none by itself, and records an accepted one as her choice', () => {
    const e = start(solo);
    const before = paper(withPartner, e);
    const moves = show(withPartner, e).suggestions.filter((s) => s.kind === 'balance');
    expect(moves.length).toBeGreaterThan(0);
    expect(paper(withPartner, e)).toEqual(before);
    const m = moves[0];
    if (m.kind !== 'balance') throw new Error('kind');
    const taken = acceptSuggestion(e, m);
    expect(rowOf(withPartner, taken, m.rowId)).toMatchObject({ ownerId: 'dad', edited: true });
    // Once she's chosen, that job is hers to decide: no more moves offered for it.
    expect(show(withPartner, taken).suggestions.some((s) => s.kind === 'balance' && s.rowId === m.rowId)).toBe(false);
  });

  it('“Not now” keeps a balance move from coming back', () => {
    const e = start(solo);
    const m = show(withPartner, e).suggestions.find((s) => s.kind === 'balance')!;
    const later = dismissSuggestion(e, m);
    expect(show(withPartner, later).suggestions.map(suggestionId)).not.toContain(suggestionId(m));
    expect(paper(withPartner, later)).toEqual(paper(withPartner, e));
  });

  it('never offers to move a job she assigned or added herself', () => {
    let e = start(solo);
    for (const r of show(solo, e).rows.filter((x) => x.ownerId === 'mom')) e = assign(e, solo, r.rowId, 'mom');
    e = addRow(e, solo, { title: 'Pay the sitter', ownerId: 'mom' });
    expect(show(withPartner, e).suggestions.filter((s) => s.kind === 'balance')).toEqual([]);
  });
});

describe('club edits: property test (seeded, deterministic)', () => {
  /** A small seeded generator, so a failure reproduces exactly. */
  const rng = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

  it('across 200 random runs of edits and family changes, everything she edited stays exactly as she left it', () => {
    for (let run = 0; run < 200; run++) {
      const r = rng(run + 1);
      const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
      const names = Object.keys(families);
      let h: Household = structuredClone(families[pick(names)]);
      let e = start(h);
      const expected = new Map<string, Partial<{ ownerId: string | null; title: string; frequency: string }>>();
      const active = () => h.members.filter((m) => !m.archived).map((m) => m.id);

      for (let step = 0; step < 25; step++) {
        const rows = show(h, e).rows;
        const row = rows.length ? pick(rows) : null;
        const roll = r();
        if (row && roll < 0.2) {
          const who = pick([...active(), null]);
          e = assign(e, h, row.rowId, who);
          expected.set(row.rowId, { ...expected.get(row.rowId), ownerId: who });
        } else if (row && roll < 0.35) {
          const t = `Job ${run}-${step}`;
          e = rename(e, row.rowId, t);
          expected.set(row.rowId, { ...expected.get(row.rowId), title: t });
        } else if (row && roll < 0.45) {
          const f = pick(['daily', 'weekly', 'as-needed'] as const);
          e = setFrequency(e, row.rowId, f);
          expected.set(row.rowId, { ...expected.get(row.rowId), frequency: f });
        } else if (roll < 0.6) {
          h = withMembers(h, [...h.members, kid(`new-${step}`, 3 + Math.floor(r() * 13))]);
        } else if (roll < 0.7) {
          const kids = h.members.filter((m) => m.kind === 'child' && !m.archived);
          if (kids.length) {
            const k = pick(kids);
            h = withMembers(h, h.members.map((m) => (m.id === k.id ? { ...m, archived: true } : m)));
          }
        } else if (roll < 0.8) {
          const kids = h.members.filter((m) => m.kind === 'child');
          if (kids.length) {
            const k = pick(kids);
            h = withMembers(h, h.members.map((m) => (m.id === k.id ? { ...m, birthYear: m.birthYear! - 1 } : m)));
          }
        } else if (roll < 0.9) {
          const s = show(h, e).suggestions;
          if (s.length) {
            const one = pick(s);
            if (r() < 0.5) {
              e = acceptSuggestion(e, one);
              // Taking an owner offer is her choice, recorded like any assignment.
              if (one.kind === 'owner') expected.set(one.rowId, { ...expected.get(one.rowId), ownerId: one.ownerId });
              if (one.kind === 'balance') expected.set(one.rowId, { ...expected.get(one.rowId), ownerId: one.toId });
            } else e = dismissSuggestion(e, one);
            for (const x of show(h, e).suggestions) if (x.kind === 'owner') expect(expected.get(x.rowId)?.ownerId, `offer on a row she left open`).not.toBe(null);
          }
        } else {
          // A round trip through the database (jsonb reorders object keys).
          e = readEdits(JSON.parse(JSON.stringify(e, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v))));
        }

        const all = [...show(h, e).rows, ...show(h, e).hidden];
        for (const [rowId, want] of expected) {
          const got = all.find((x) => x.rowId === rowId);
          expect(got, `run ${run} step ${step}: ${rowId} vanished`).toBeDefined();
          for (const [k, v] of Object.entries(want)) expect((got as unknown as Record<string, unknown>)[k], `run ${run} step ${step}: ${rowId}.${k}`).toEqual(v);
        }
      }
    }
  });
});

describe('club edits: reading saved edits', () => {
  it('round-trips through JSON with object keys in any order', () => {
    const h = families.D;
    let e = start(h);
    e = assign(e, h, e.accepted[3].rowId, 'jo');
    e = addRow(e, h, { title: 'Feed the fish', ownerId: 'fin' });
    const json = JSON.parse(JSON.stringify(e));
    expect(show(h, readEdits(json))).toEqual(show(h, e));
  });

  it('drops anything malformed instead of breaking the page', () => {
    expect(readEdits(null)).toEqual(readEdits({}));
    expect(readEdits('nope').accepted).toEqual([]);
    const e = readEdits({
      accepted: [{ rowId: 'a', itemId: 'set-the-table', title: 'T', section: 'family', frequency: 'daily', ownerId: null }, { rowId: 'a', itemId: 'x' }, 'junk', { rowId: 'b', title: 'bad', section: 'roof', frequency: 'daily', ownerId: null, itemId: 'y' }],
      assign: { a: 'x', b: 5 },
      frequency: { a: 'hourly', b: 'weekly' },
      level: { a: 'boss' },
      text: { a: '', b: 'ok' },
      hidden: ['a', 7],
    });
    expect(e.accepted.map((r) => r.rowId)).toEqual(['a']);
    expect(e.assign).toEqual({ a: 'x' });
    expect(e.frequency).toEqual({ b: 'weekly' });
    expect(e.level).toEqual({});
    expect(e.text).toEqual({ b: 'ok' });
    expect(e.hidden).toEqual(['a']);
  });
});

describe('club edits: the team reset works the same way', () => {
  it('fills the November reset and keeps her changes when the family changes', () => {
    const h = families.B;
    const reset = kit.reset!.items;
    let e = initialEdits(h, reset, MONTH);
    expect(resolveDocument(h, reset, MONTH, e).rows.length).toBe(reset.length);
    e = assign(e, h, 'nov-table', 'dee');
    const h2 = withMembers(h, [...h.members, adult('co')]);
    expect(resolveDocument(h2, reset, MONTH, e).rows.find((r) => r.rowId === 'nov-table')!.ownerId).toBe('dee');
  });
});
