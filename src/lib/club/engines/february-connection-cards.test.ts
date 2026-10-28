import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  applyFamily, cardChanged, febFingerprint, febView, freshState, fromLegacy, isFebState, restoreAll, restoreCard,
  setPerson, setText, type FebMember,
} from './february-connection-cards';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as FebMember[];
const rivera = family('rivera');
const id = (name: string, members = rivera) => members.find((m) => m.firstName === name)!.id;
const prepared = (m: FebMember[]) => applyFamily(freshState(), m);
const lines = (s: ReturnType<typeof prepared>, m: FebMember[]) => febView(s, m).map((c) => `${c.owner} → ${c.recipient}: ${c.invite}`);

describe('February connection cards', () => {
  it('prepares four cards from the family, the way the printed example reads', () => {
    expect(lines(prepared(rivera), rivera)).toEqual([
      'Sofia → Dad: Dad, will you play a game with me tonight?',
      'Mateo → Mom: Mom, will you read a book with me after dinner?',
      'Ana → Sofia: Sofia, want to build something with me this weekend?',
      'Luis → Mateo: Mateo, will you make a blanket fort with me?',
    ]);
  });

  it('stores people as member IDs and never sends a card to its sender', () => {
    const s = prepared(rivera);
    expect(s.cards[0]).toMatchObject({ from: id('Sofia'), to: id('Luis') });
    setPerson(s, 0, 'to', id('Sofia'), rivera);
    expect(s.cards[0].from).not.toBe(s.cards[0].to);
    expect(s.cards[0]).toMatchObject({ from: id('Luis'), to: id('Sofia') });
  });

  it('a new recipient carries into the invitation; her own words stay hers', () => {
    const s = prepared(rivera);
    setPerson(s, 0, 'to', id('Ana'), rivera);
    expect(febView(s, rivera)[0].invite).toBe('Mom, will you play a game with me tonight?');
    setText(s, 0, 'invite', 'Mom, can we bake cookies?', rivera);
    setText(s, 0, 'toName', 'Mama', rivera);
    expect(febView(s, rivera)[0]).toMatchObject({ recipient: 'Mama', invite: 'Mama, can we bake cookies?' });
    setText(s, 0, 'invite', 'Cookies tonight?', rivera);
    setPerson(s, 0, 'to', id('Luis'), rivera);
    expect(febView(s, rivera)[0]).toMatchObject({ recipient: 'Dad', invite: 'Cookies tonight?' });
  });

  it('grown-ups see first names; only children call parents Mom and Dad', () => {
    const s = prepared(rivera);
    setPerson(s, 2, 'to', id('Luis'), rivera);
    expect(febView(s, rivera)[2].recipient).toBe('Luis');
  });

  it('re-prepares a card whose person is archived, keeping its wording', () => {
    const s = prepared(rivera);
    setText(s, 0, 'idea', 'Popcorn too!', rivera);
    const later = rivera.map((m) => (m.firstName === 'Sofia' ? { ...m, archived: true } : m));
    applyFamily(s, later);
    expect(s.cards[0].from).not.toBe(id('Sofia'));
    expect(febView(s, later).map((c) => c.owner)).not.toContain('Sofia');
    expect(s.cards[0].idea).toBe('Popcorn too!');
  });

  it('works for every sample family, including a one-person household', () => {
    for (const sample of sampleHouseholds.filter((x) => x.household.members.length)) {
      const m = sample.household.members as FebMember[];
      const v = febView(prepared(m), m);
      for (const c of v) expect(c.from).toBeTruthy();
      if (m.filter((x) => !x.archived).length > 1) for (const c of v) expect(c.to && c.to.id !== c.from!.id).toBeTruthy();
    }
  });

  it('restores one card or all four, and says which are changed', () => {
    const s = prepared(rivera);
    setText(s, 1, 'headline', 'Story time', rivera);
    setText(s, 3, 'idea', 'Pillows!', rivera);
    expect([0, 1, 2, 3].map((i) => cardChanged(s, i, rivera))).toEqual([false, true, false, true]);
    restoreCard(s, 1, rivera);
    expect(s.cards[3].idea).toBe('Pillows!');
    expect(cardChanged(s, 1, rivera)).toBe(false);
    restoreAll(s, rivera);
    expect(s).toEqual(prepared(rivera));
  });

  it('prepared wording or blank is no change; limits hold', () => {
    const s = prepared(rivera);
    setText(s, 0, 'headline', ' Game night? ', rivera);
    setText(s, 0, 'idea', '', rivera);
    expect(s.cards[0]).toEqual({ from: id('Sofia'), to: id('Luis') });
    setText(s, 0, 'invite', 'x'.repeat(200), rivera);
    expect(s.cards[0].invite).toHaveLength(88);
  });

  it('approval follows what prints', () => {
    const s = prepared(rivera);
    const before = febFingerprint(s, rivera);
    setText(s, 2, 'idea', 'You choose what we build.', rivera);
    expect(febFingerprint(s, rivera)).toBe(before);
    setText(s, 2, 'idea', 'Lego!', rivera);
    expect(febFingerprint(s, rivera)).not.toBe(before);
  });

  it('reads the earlier February page’s name-based plan back as people', () => {
    const raw = JSON.stringify({ fingerprint: 'x', cards: [
      { owner: 'Sofia', recipient: 'Mom', headline: 'Game night?', invite: 'Mom, will you play a game with me tonight?', idea: 'I’ll get the game ready!' },
      { owner: 'Mateo', recipient: 'Grandpa', headline: 'Just us two', invite: 'Grandpa, read with me?', idea: 'I’ll pick the book!' },
      { owner: 'Ana', recipient: 'Sofia', headline: 'I picked you!', invite: 'Sofia, want to build something with me this weekend?', idea: 'You choose what we build.' },
      { owner: 'Luis', recipient: 'Mateo', headline: 'Let’s have fun!', invite: 'Mateo, will you make a blanket fort with me?', idea: 'I’ll bring the blankets!' },
    ] });
    const s = fromLegacy(raw, rivera)!;
    expect(isFebState(s)).toBe(true);
    expect(s.cards[0]).toMatchObject({ from: id('Sofia'), to: id('Ana') });
    expect(febView(s, rivera)[1]).toMatchObject({ recipient: 'Grandpa', invite: 'Grandpa, read with me?' });
    expect(cardChanged(s, 2, rivera)).toBe(false);
    expect(fromLegacy('{bad', rivera)).toBeNull();
  });
});
