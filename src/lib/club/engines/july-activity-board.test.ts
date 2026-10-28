import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  applyFamily, available, boardChanged, boardOf, freshState, fromLegacy, isJulyState, julyFingerprint, julyView, relabel,
  restoreBoard, setActivities, setChild, setFocus, setInterest, setParticipation, setText, toggleActivity, type JulyMember,
} from './july-activity-board';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as JulyMember[];
const rivera = family('rivera');
const id = (n: string) => rivera.find((m) => m.firstName === n)!.id;
const labels = (s: ReturnType<typeof freshState>, t: 'quick' | 'busy' | 'project') => julyView(s, rivera).tiers[t].map((i) => i.label);

describe('July activity board', () => {
  it('starts on the first child’s board, prepared for their age', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const v = julyView(s, rivera);
    expect(v.title).toBe('Sofia\'s activity ideas');
    expect(v.age).toBe(11);
    expect(labels(s, 'busy')).toEqual(['Finish a puzzle', 'Read a whole chapter', 'Make a paper craft']);
  });

  it('a little one gets little-kid ideas; nothing above their age can be added', () => {
    const s = setChild(freshState(rivera), id('Elena'), rivera);
    expect(julyView(s, rivera).age).toBe(5);
    expect(labels(s, 'quick')).toEqual(['Look at a picture book', 'Sort blocks by color', 'Build with blocks']);
    toggleActivity(s, 'quick', 'build', rivera);
    toggleActivity(s, 'quick', 'read', rivera); // 6+
    expect(labels(s, 'quick')).not.toContain('Read a book');
  });

  it('each child keeps their own board', () => {
    const s = freshState(rivera);
    relabel(s, 'quick', 0, 'Read Harry Potter', rivera);
    setChild(s, id('Mateo'), rivera);
    expect(labels(s, 'quick')[0]).toBe('Read a book');
    setChild(s, id('Sofia'), rivera);
    expect(labels(s, 'quick')[0]).toBe('Read Harry Potter');
  });

  it('three at most per group, no duplicates', () => {
    const s = freshState(rivera);
    setActivities(s, 'busy', ['puzzle', 'craft', 'tower', 'bike', 'puzzle'], rivera);
    expect(boardOf(s, rivera).busy.map((x) => x.id)).toEqual(['puzzle', 'craft', 'tower']);
  });

  it('together-ideas come only with playing together; a sibling needs two children', () => {
    const s = freshState(rivera);
    expect(available('quick', boardOf(s, rivera), 11).map((x) => x.id)).not.toContain('sibling-build');
    setParticipation(s, 'sibling', rivera);
    expect(julyView(s, rivera).mode).toBe('WITH A SIBLING');
    expect(labels(s, 'quick')[0]).toBe('Build a LEGO tower together');
    setParticipation(s, 'solo', rivera);
    expect(labels(s, 'quick')).not.toContain('Build a LEGO tower together');
    const brooksOnly = family('okafor');
    const t = freshState(brooksOnly);
    setParticipation(t, 'sibling', brooksOnly);
    expect(julyView(t, brooksOnly).mode).toBe('BY MYSELF');
  });

  it('interest and focus suggest age-right ideas', () => {
    const s = freshState(rivera);
    setInterest(s, 'art', rivera);
    expect(labels(s, 'project')).toContain('Draw a comic strip');
    setFocus(s, 'outside', rivera);
    expect(labels(s, 'busy')).toContain('Ride my bike (ask first)');
  });

  it('restores only the selected board', () => {
    const s = freshState(rivera);
    setText(s, 'intro', 'Ideas for me!', rivera);
    setChild(s, id('Mateo'), rivera);
    setText(s, 'rule', 'Tidy up after.', rivera);
    restoreBoard(s, rivera);
    expect(boardChanged(s, rivera)).toBe(false);
    setChild(s, id('Sofia'), rivera);
    expect(julyView(s, rivera).intro).toBe('Ideas for me!');
  });

  it('approval follows what prints', () => {
    const s = freshState(rivera);
    const a = julyFingerprint(s, rivera);
    setText(s, 'intro', 'Fun things I can do without asking Mom or Dad.', rivera);
    expect(julyFingerprint(s, rivera)).toBe(a);
    setChild(s, id('Mateo'), rivera);
    expect(julyFingerprint(s, rivera)).not.toBe(a);
  });

  it('drops boards for children no longer on the profile', () => {
    const s = setChild(freshState(rivera), id('Mateo'), rivera);
    const later = rivera.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m));
    applyFamily(s, later);
    expect(s.child).toBe(id('Sofia'));
    expect(s.boards[id('Mateo')]).toBeUndefined();
  });

  it('reads the earlier July page’s plan for the same family', () => {
    const raw = JSON.stringify({ profile: 'rivera:sample-rivera', state: { child: id('Mateo'), participation: 'friends', interest: 'mixed', focus: 'mixed',
      quick: [{ id: 'read', label: 'Read comics' }, { id: 'draw', label: 'Draw a superhero', removed: true }, { id: 'build', label: 'Build with blocks' }],
      busy: [], project: [], intro: 'Mine!', rule: 'Before asking: Pick one · Get what you need · Have fun · Put things away.' }, boards: {} });
    const s = fromLegacy(raw, 'rivera:sample-rivera', rivera)!;
    expect(isJulyState(s)).toBe(true);
    const v = julyView(s, rivera);
    expect(v.childName).toBe('Mateo');
    expect(v.tiers.quick.map((i) => i.label)).toEqual(['Read comics', 'Build with blocks']);
    expect(v).toMatchObject({ mode: 'WITH FRIENDS ALREADY HERE', intro: 'Mine!' });
    expect(fromLegacy(raw, 'chen:sample-chen', rivera)).toBeNull();
  });
});
