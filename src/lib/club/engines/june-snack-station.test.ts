import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  addCustom, applyFamily, foodsChanged, freshState, fromLegacy, isJuneState, juneFingerprint, juneView, restoreFoods,
  restoreWording, setLevel, setPeanuts, setReset, setRule, setText, toggleFood, wordingChanged, RESETS, type JuneMember,
} from './june-snack-station';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as JuneMember[];
const rivera = family('rivera');
const id = (n: string) => rivera.find((m) => m.firstName === n)!.id;

describe('June snack station', () => {
  it('prepares four foods a side and levels from age: 7 and under ask for help', () => {
    const v = juneView(freshState(), rivera, 'the Rivera family');
    expect(v.fridge.map((i) => i.label)).toEqual(['Yogurt cup', 'Cheese stick', 'Apple slices', 'Cucumber sticks']);
    expect(v.pantry).toHaveLength(4);
    expect(v.levels).toEqual([{ level: 'help', names: ['Elena'] }, { level: 'independent', names: ['Sofia', 'Mateo'] }]); // Mateo is 8 in June 2027
    expect(v.family).toBe('THE RIVERA FAMILY · SNACK STATION');
  });

  it('a family with no children prints the plain help line', () => {
    expect(juneView(freshState(), family('hughes')).levels).toEqual([{ level: 'help', names: [] }]);
  });

  it('keeps four foods a side, one custom food per station, foods in their own zone', () => {
    const s = freshState();
    toggleFood(s, 'fridge', 'egg');
    expect(s.fridge).toHaveLength(4);
    toggleFood(s, 'fridge', 'yogurt');
    toggleFood(s, 'fridge', 'egg');
    expect(s.fridge.map((i) => i.id)).toContain('egg');
    toggleFood(s, 'fridge', 'crackers');
    expect(s.fridge.map((i) => i.id)).not.toContain('crackers');
    toggleFood(s, 'pantry', 'bagel');
    addCustom(s, 'pantry', 'Rice cakes');
    addCustom(s, 'fridge', 'Second custom');
    expect([...s.fridge, ...s.pantry].filter((i) => i.id === 'custom').map((i) => i.label)).toEqual(['Rice cakes']);
  });

  it('excluding peanuts removes them and refuses them', () => {
    const s = freshState();
    toggleFood(s, 'pantry', 'bagel');
    toggleFood(s, 'pantry', 'nut-butter');
    setPeanuts(s, true);
    expect(s.pantry.map((i) => i.id)).not.toContain('nut-butter');
    toggleFood(s, 'pantry', 'nut-butter');
    expect(s.pantry.map((i) => i.id)).not.toContain('nut-butter');
  });

  it('a new rule or reminder replaces only that line’s wording', () => {
    const s = freshState();
    setText(s, 'rule', 'Pick two things.');
    setText(s, 'headline', 'my snack!');
    setRule(s, 'big');
    expect(juneView(s, rivera)).toMatchObject({ rule: 'Choose 2 from the fridge + 1 from the pantry.', headline: 'my snack!', fridgeChoose: 'Choose two' });
    setReset(s, RESETS[2].value);
    expect(juneView(s, rivera).cleanup).toBe('Put food away · Throw wrappers away');
    setRule(s, 'pantry');
    expect(juneView(s, rivera).showFridge).toBe(false);
  });

  it('levels are by member ID, can go back to the age suggestion, and leave with the person', () => {
    const s = freshState();
    setLevel(s, id('Mateo'), 'help');
    expect(juneView(s, rivera).levels[0].names).toEqual(['Mateo', 'Elena']);
    setLevel(s, id('Mateo'), null);
    expect(juneView(s, rivera).levels[1].names).toContain('Mateo');
    setLevel(s, id('Elena'), 'independent');
    applyFamily(s, rivera.map((m) => (m.firstName === 'Elena' ? { ...m, archived: true } : m)));
    expect(s.levels).toEqual({});
  });

  it('restores foods and wording separately', () => {
    const s = freshState();
    toggleFood(s, 'fridge', 'yogurt');
    setText(s, 'subtitle', 'Snack time!');
    restoreFoods(s);
    expect(foodsChanged(s)).toBe(false);
    expect(wordingChanged(s)).toBe(true);
    restoreWording(s);
    expect(s).toEqual(freshState());
  });

  it('approval follows what prints', () => {
    const s = freshState();
    const a = juneFingerprint(s, rivera);
    setText(s, 'headline', 'my own snack!');
    expect(juneFingerprint(s, rivera)).toBe(a);
    setLevel(s, id('Sofia'), 'help');
    expect(juneFingerprint(s, rivera)).not.toBe(a);
  });

  it('reads the earlier June page’s tab plan for the same family', () => {
    const raw = JSON.stringify({ profile: 'rivera:sample-rivera', state: {
      fridge: [{ id: 'egg', label: 'Eggs' }, { id: 'custom', label: 'My snack', removed: true }],
      pantry: [{ id: 'crackers', label: 'Crackers' }], levels: { '0:sofia': 'help' }, rule: 'big',
      reset: 'Put food away · Wipe your spot', text: { headline: 'my snack!' }, excludePeanuts: true } });
    const s = fromLegacy(raw, 'rivera:sample-rivera', rivera)!;
    expect(isJuneState(s)).toBe(true);
    expect(s).toMatchObject({ rule: 'big', excludePeanuts: true, reset: 'Put food away · Wipe your spot', text: { headline: 'my snack!' }, levels: { [id('Sofia')]: 'help' } });
    expect(s.fridge).toEqual([{ id: 'egg', label: 'Eggs' }]);
    expect(fromLegacy(raw, 'chen:sample-chen', rivera)).toBeNull();
  });
});
