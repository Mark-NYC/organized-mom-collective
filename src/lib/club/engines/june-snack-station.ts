/**
 * June 2027 Snack Station: the rules behind the one-page, kid-facing printable
 * (src/components/club/JuneSnackStation.astro). Pure functions only, so the printable, the desktop rail and the mobile
 * plan screen (JunePlanMobile.astro) read one plan.
 *
 * Four foods from the fridge and four from the pantry (one may be her own), a snack rule, an after-snack reminder,
 * and who chooses alone or asks for help. Children are by member ID; by default 7 and under ask for help.
 * Foods are examples, not allergy- or age-screened recommendations: a parent checks them.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-06';
export type Zone = 'fridge' | 'pantry';
export const ZONES: readonly Zone[] = ['fridge', 'pantry'];
export type Level = 'help' | 'independent';
export type Rule = 'standard' | 'big' | 'fridge' | 'pantry';
export const SLOTS = 4;

export const FOODS: readonly { id: string; name: string; zone: Zone }[] = [
  { id: 'ranch', name: 'Ranch dip', zone: 'fridge' }, { id: 'peanut-butter', name: 'Peanut butter', zone: 'fridge' },
  { id: 'yogurt-tube', name: 'Yogurt tube', zone: 'fridge' }, { id: 'strawberries', name: 'Strawberries', zone: 'fridge' },
  { id: 'blueberries', name: 'Blueberries', zone: 'fridge' }, { id: 'other-fruit', name: 'Other fruit', zone: 'fridge' },
  { id: 'cream-cheese', name: 'Cream cheese', zone: 'fridge' }, { id: 'muffin', name: 'Muffin', zone: 'pantry' },
  { id: 'other-baked', name: 'Other baked good', zone: 'pantry' }, { id: 'applesauce', name: 'Applesauce pouch', zone: 'pantry' },
  { id: 'carrots-ranch', name: 'Carrots + ranch', zone: 'fridge' }, { id: 'carrots-hummus', name: 'Carrots + hummus', zone: 'fridge' },
  { id: 'apples-peanut', name: 'Apples + peanut butter', zone: 'fridge' }, { id: 'bagel-cream', name: 'Bagel + cream cheese', zone: 'pantry' },
  { id: 'yogurt', name: 'Yogurt cup', zone: 'fridge' }, { id: 'cheese-stick', name: 'Cheese stick', zone: 'fridge' },
  { id: 'apple', name: 'Apple slices', zone: 'fridge' }, { id: 'carrot-big', name: 'Carrot sticks', zone: 'fridge' },
  { id: 'cucumber', name: 'Cucumber sticks', zone: 'fridge' }, { id: 'hummus', name: 'Hummus cup', zone: 'fridge' },
  { id: 'egg', name: 'Hard-boiled egg', zone: 'fridge' }, { id: 'cheese-cubes', name: 'Cheese cubes', zone: 'fridge' },
  { id: 'crackers', name: 'Crackers', zone: 'pantry' }, { id: 'granola-bar', name: 'Granola bar', zone: 'pantry' },
  { id: 'dried-fruit', name: 'Dried fruit', zone: 'pantry' }, { id: 'bagel', name: 'Mini bagel', zone: 'pantry' },
  { id: 'bread', name: 'Bread', zone: 'pantry' }, { id: 'nut-butter', name: 'Nut butter pack', zone: 'pantry' },
];
export const SNACK_ICONS: Record<string, string> = {
  'nut-butter': '/images/club/snacks/nut-butter-pack.png', 'peanut-butter': '/images/club/snacks/peanut-butter.png',
  yogurt: '/images/club/icon-library/yogurt-cup.png', 'yogurt-tube': '/images/club/snacks/yogurt-tube.png',
  strawberries: '/images/club/snacks/strawberries.png', blueberries: '/images/club/snacks/blueberries.png',
  'other-fruit': '/images/club/icon-library/fruit.png', ranch: '/images/club/snacks/ranch-dip.png',
  'cream-cheese': '/images/club/snacks/cream-cheese.png', muffin: '/images/club/snacks/muffin.png',
  'other-baked': '/images/club/icon-library/bread.png', applesauce: '/images/club/snacks/apple-sauce-pouch.png',
  'carrots-ranch': '/images/club/icon-library/carrot-sticks.png', 'carrots-hummus': '/images/club/icon-library/carrot-sticks.png',
  'apples-peanut': '/images/club/icon-library/fruit.png', 'bagel-cream': '/images/club/icon-library/mini-bagels.png',
  'cheese-stick': '/images/club/icon-library/cheese-wedge.png', apple: '/images/club/icon-library/fruit.png',
  'carrot-big': '/images/club/icon-library/carrot-sticks.png', hummus: '/images/club/icon-library/hummus-cup.png',
  cucumber: '/images/club/icon-library/cucumber-sticks.png', bagel: '/images/club/icon-library/mini-bagels.png',
  egg: '/images/club/icon-library/hard-boiled-egg.png', 'cheese-cubes': '/images/club/icon-library/cheese-wedge.png',
  crackers: '/images/club/icon-library/crackers.png', 'granola-bar': '/images/club/icon-library/granola-bar.png',
  'dried-fruit': '/images/club/icon-library/fruit.png', bread: '/images/club/icon-library/bread.png',
};
export const STARTER: Record<Zone, readonly string[]> = { fridge: ['yogurt', 'cheese-stick', 'apple', 'cucumber'], pantry: ['crackers', 'granola-bar', 'dried-fruit', 'bagel'] };
export const PEANUT = new Set(['nut-butter', 'peanut-butter', 'apples-peanut']);
export const RULES: Record<Rule, { label: string; text: string }> = {
  standard: { label: 'Standard: 1 fridge + 1 pantry', text: 'Choose 1 from the fridge + 1 from the pantry.' },
  big: { label: 'Big Appetite: 2 fridge + 1 pantry', text: 'Choose 2 from the fridge + 1 from the pantry.' },
  fridge: { label: 'Fridge Only', text: 'Choose from the fridge.' },
  pantry: { label: 'Pantry Only', text: 'Choose from the pantry.' },
};
export const RESETS: readonly { value: string; label: string }[] = [
  { value: "When you're done, bring your snack and dishes back to the kitchen counter.", label: 'Bring snack and dishes to the kitchen counter' },
  { value: 'Put food away · Bring dishes to the sink', label: 'Put food away + dishes to the sink' },
  { value: 'Put food away · Throw wrappers away', label: 'Put food away + wrappers in trash' },
  { value: 'Put food away · Wipe your spot', label: 'Put food away + wipe your spot' },
];
export const TEXT_DEFAULTS = { headline: 'my own snack!', subtitle: 'Pick it. Enjoy it. Put it away.', fridgeTitle: 'From the fridge', pantryTitle: 'From the pantry' } as const;
export type TextKey = keyof typeof TEXT_DEFAULTS | 'rule' | 'cleanup';
export const TEXT_LIMIT = 110;
export const LABEL_LIMIT = 36;
export const LEVEL_TEXT: Record<Level, string> = { help: 'Ask for help.', independent: 'Choose. Prepare. Clean up.' };

export interface Item { id: string; label: string }
export interface JuneMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }
export interface JuneState {
  fridge: Item[];
  pantry: Item[];
  rule: Rule;
  reset: string;
  text: Partial<Record<TextKey, string>>;
  excludePeanuts: boolean;
  /** Children whose level she chose; the rest follow their age. */
  levels: Record<string, Level>;
}

export const foodById = (id: string) => FOODS.find((f) => f.id === id);
const starterItems = (zone: Zone): Item[] => STARTER[zone].map((id) => ({ id, label: foodById(id)!.name }));
export const freshState = (): JuneState => ({ fridge: starterItems('fridge'), pantry: starterItems('pantry'), rule: 'standard', reset: RESETS[0].value, text: {}, excludePeanuts: false, levels: {} });

export const children = <M extends JuneMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived);
export const ageOf = (m: JuneMember) => (m.birthYear === undefined ? null : ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH));
export const suggestedLevel = (m: JuneMember): Level | null => { const a = ageOf(m); return a === null ? null : a <= 7 ? 'help' : 'independent'; };
export const levelOf = (s: JuneState, m: JuneMember): Level | null => s.levels[m.id] ?? suggestedLevel(m);
export const allowed = (s: JuneState, id: string) => !(s.excludePeanuts && PEANUT.has(id));

/** Drop levels for people no longer on the sheet. Mutates `s`. */
export const applyFamily = (s: JuneState, members: readonly JuneMember[]) => {
  const ids = new Set(children(members).map((m) => m.id));
  for (const id of Object.keys(s.levels)) if (!ids.has(id)) delete s.levels[id];
  return s;
};

const isItem = (x: unknown): x is Item => Boolean(x) && typeof (x as Item).id === 'string' && typeof (x as Item).label === 'string';
export const isJuneState = (x: unknown): x is JuneState => {
  const s = x as Partial<JuneState> | null;
  return Boolean(s && ZONES.every((z) => Array.isArray(s[z]) && s[z]!.length <= SLOTS && s[z]!.every(isItem))
    && s.rule && s.rule in RULES && typeof s.reset === 'string' && s.text && typeof s.excludePeanuts === 'boolean' && s.levels && typeof s.levels === 'object');
};

export const juneView = (s: JuneState, members: readonly JuneMember[], displayName?: string) => {
  const kids = children(members);
  const groups = (['help', 'independent'] as Level[]).map((level) => ({ level, names: kids.filter((m) => levelOf(s, m) === level).map((m) => m.firstName) })).filter((g) => g.names.length);
  const zone = (z: Zone) => s[z].filter((i) => allowed(s, i.id));
  return {
    family: displayName?.trim() ? `${displayName.trim().toUpperCase()} · SNACK STATION` : "OUR FAMILY'S SNACK STATION",
    fridge: zone('fridge'),
    pantry: zone('pantry'),
    showFridge: s.rule !== 'pantry',
    showPantry: s.rule !== 'fridge',
    fridgeChoose: s.rule === 'big' ? 'Choose two' : 'Choose one',
    rule: s.text.rule ?? RULES[s.rule].text,
    cleanup: s.text.cleanup ?? s.reset,
    headline: s.text.headline ?? TEXT_DEFAULTS.headline,
    subtitle: s.text.subtitle ?? TEXT_DEFAULTS.subtitle,
    fridgeTitle: s.text.fridgeTitle ?? TEXT_DEFAULTS.fridgeTitle,
    pantryTitle: s.text.pantryTitle ?? TEXT_DEFAULTS.pantryTitle,
    levels: groups.length ? groups : [{ level: 'help' as Level, names: [] as string[] }],
    kids: kids.map((m) => ({ id: m.id, name: m.firstName, level: levelOf(s, m), chosen: m.id in s.levels })),
  };
};
export type JuneView = ReturnType<typeof juneView>;

export const juneFingerprint = (s: JuneState, members: readonly JuneMember[], displayName?: string) => {
  const v = juneView(s, members, displayName);
  return JSON.stringify([v.family, v.showFridge && v.fridge.map((i) => [i.id, i.label]), v.showPantry && v.pantry.map((i) => [i.id, i.label]), v.fridgeChoose, v.rule, v.cleanup, v.headline, v.subtitle, v.fridgeTitle, v.pantryTitle, v.levels]);
};

// Edits. Each changes `s` in place and returns it.

/** Up to four foods per side, at most one of her own on the whole station; peanut foods are refused while excluded. */
export const setFoods = (s: JuneState, zone: Zone, items: readonly Item[]) => {
  const other = s[zone === 'fridge' ? 'pantry' : 'fridge'].some((i) => i.id === 'custom');
  let custom = other;
  s[zone] = [];
  for (const i of items) {
    if (s[zone].length >= SLOTS) break;
    if (i.id === 'custom') { if (custom || !i.label.trim()) continue; custom = true; }
    else if (foodById(i.id)?.zone !== zone || !allowed(s, i.id) || s[zone].some((x) => x.id === i.id)) continue;
    s[zone].push({ id: i.id, label: i.label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT) || foodById(i.id)?.name || 'My snack' });
  }
  return s;
};
export const toggleFood = (s: JuneState, zone: Zone, id: string) => {
  const has = s[zone].some((i) => i.id === id);
  return setFoods(s, zone, has ? s[zone].filter((i) => i.id !== id) : [...s[zone], { id, label: foodById(id)?.name ?? '' }]);
};
export const addCustom = (s: JuneState, zone: Zone, label: string) => setFoods(s, zone, [...s[zone], { id: 'custom', label }]);
export const relabel = (s: JuneState, zone: Zone, index: number, label: string) => {
  const item = s[zone][index];
  if (item) item.label = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT) || foodById(item.id)?.name || 'My snack';
  return s;
};
export const setPeanuts = (s: JuneState, on: boolean) => {
  s.excludePeanuts = on;
  if (on) for (const z of ZONES) s[z] = s[z].filter((i) => !PEANUT.has(i.id));
  return s;
};
/** A different rule or reminder replaces only her own wording of that line. */
export const setRule = (s: JuneState, rule: Rule) => { s.rule = rule; delete s.text.rule; return s; };
export const setReset = (s: JuneState, reset: string) => { if (RESETS.some((r) => r.value === reset)) { s.reset = reset; delete s.text.cleanup; } return s; };
export const prepared = (s: JuneState, key: TextKey) => (key === 'rule' ? RULES[s.rule].text : key === 'cleanup' ? s.reset : TEXT_DEFAULTS[key]);
export const setText = (s: JuneState, key: TextKey, value: string) => {
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (!clean || clean === prepared(s, key)) delete s.text[key];
  else s.text[key] = clean;
  return s;
};
/** null: back to the age suggestion. */
export const setLevel = (s: JuneState, memberId: string, level: Level | null) => {
  if (level) s.levels[memberId] = level;
  else delete s.levels[memberId];
  return s;
};

export const restoreFoods = (s: JuneState) => { const f = freshState(); s.fridge = f.fridge; s.pantry = f.pantry; s.excludePeanuts = false; return s; };
export const restoreWording = (s: JuneState) => { s.text = {}; return s; };
export const foodsChanged = (s: JuneState) => s.excludePeanuts || ZONES.some((z) => JSON.stringify(s[z]) !== JSON.stringify(freshState()[z]));
export const wordingChanged = (s: JuneState) => Object.keys(s.text).length > 0;

/**
 * The plan saved by the earlier June page (sessionStorage, same key): { profile, state } with slots carrying
 * `removed` and levels keyed "<index>:<name>". Read once for the same family.
 */
export const fromLegacy = (raw: string | null, profile: string, members: readonly JuneMember[]): JuneState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { profile?: string; state?: Record<string, unknown> } | null;
    const o = old?.state;
    if (!o || old?.profile !== profile) return null;
    const s = freshState();
    if (typeof o.rule === 'string' && o.rule in RULES) s.rule = o.rule as Rule;
    if (typeof o.reset === 'string') setReset(s, o.reset);
    if (o.excludePeanuts === true) setPeanuts(s, true);
    for (const z of ZONES) {
      const slots = o[z];
      if (Array.isArray(slots)) setFoods(s, z, (slots as (Item & { removed?: boolean })[]).filter((i) => isItem(i) && !i.removed));
    }
    if (o.text && typeof o.text === 'object') for (const [k, v] of Object.entries(o.text)) if (typeof v === 'string' && (k in TEXT_DEFAULTS || k === 'rule' || k === 'cleanup')) setText(s, k as TextKey, v);
    if (o.levels && typeof o.levels === 'object') {
      const kids = children(members);
      for (const [key, level] of Object.entries(o.levels)) {
        const [i, name] = key.split(':');
        const m = kids[Number(i)];
        if (m && m.firstName.trim().toLowerCase() === name && (level === 'help' || level === 'independent')) s.levels[m.id] = level;
      }
    }
    return s;
  } catch {
    return null;
  }
};

export interface JunePlan extends PlanResource<JuneState> {
  members: () => JuneMember[];
  view: () => JuneView;
  setLocked: (on: boolean) => void;
  openEditor: (which: 'snacks' | 'station') => void;
}
