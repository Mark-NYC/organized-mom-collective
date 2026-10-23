/**
 * The Family Packing & Independence Builder's items and rules (src/components/site/PackingBuilder.astro and
 * packing-builder.ts beside it). Not a trip planner: where and when live on the wall calendar. This answers "what do
 * we need, and who can get it ready?" for one outing: a list for each person, a short shared list with owners, and
 * Pack, Check, Unpack.
 *
 * The rules it keeps:
 * - Only what the outing needs: a pool afternoon isn't a vacation. Items carry the outings, lengths and preferences
 *   they belong to, and multi-day clothing is a count ("Outfits for 4 days"), capped when there's laundry.
 * - Children pack what they can for their age ("I can pack myself") and a grown-up helps with the rest. Medicine,
 *   allergy supplies, documents, forms and safety gear are a grown-up's at every age, teens included (they can bring
 *   theirs to a grown-up to check). Age is a starting point; she can move any item.
 * - Shared supplies go to the grown-ups, spread by load with the account holder leaning last; a teen can take a
 *   non-critical shared item (snacks, games). Nothing safety-critical goes to a child.
 */
import { ageOf, rankOf, type Helper } from '../lib/household-helpers';

export type Outing = 'camp' | 'pool' | 'roadtrip' | 'vacation' | 'day' | 'sleepover' | 'custom';
export type Length = 'hours' | 'day' | 'overnight' | 'multi';
export type Pref = 'swim' | 'outdoors' | 'cool' | 'camp-list' | 'laundry';
export type Stage = 'young' | 'school' | 'tween' | 'teen' | 'adult';

export const outingOptions: { id: Outing; label: string; length: Length }[] = [
  { id: 'camp', label: 'Summer camp', length: 'day' },
  { id: 'pool', label: 'Pool or beach', length: 'hours' },
  { id: 'roadtrip', label: 'Road trip', length: 'day' },
  { id: 'vacation', label: 'Family vacation', length: 'multi' },
  { id: 'day', label: 'Day outing', length: 'day' },
  { id: 'sleepover', label: 'Sleepover', length: 'overnight' },
  { id: 'custom', label: 'Something else', length: 'day' },
];
export const OUTINGS = outingOptions.map((o) => o.id);
export const lengthOptions: { id: Length; label: string }[] = [
  { id: 'hours', label: 'A few hours' },
  { id: 'day', label: 'One day' },
  { id: 'overnight', label: 'Overnight' },
  { id: 'multi', label: 'Multiple days' },
];
export const prefOptions: { id: Pref; label: string }[] = [
  { id: 'swim', label: 'Swimming' },
  { id: 'outdoors', label: 'Outdoor activities' },
  { id: 'cool', label: 'Cool or rainy weather' },
  { id: 'camp-list', label: 'Camp sent its own packing list' },
  { id: 'laundry', label: 'Laundry where we’re staying' },
];
/** The extra questions worth asking for an outing and length (everything else is decided by the outing). */
export function prefsFor(outing: Outing, length: Length): Pref[] {
  const out: Pref[] = [];
  if (outing !== 'pool' && outing !== 'sleepover') out.push('swim');
  if (outing !== 'sleepover') out.push('outdoors');
  if (length !== 'hours') out.push('cool');
  if (outing === 'camp') out.push('camp-list');
  if (length === 'multi') out.push('laundry');
  return out;
}
/** The preferences an outing starts with (a pool trip swims; camp and a day out are outdoors). */
export const defaultPrefs = (outing: Outing): Pref[] => (outing === 'pool' ? ['swim'] : outing === 'camp' || outing === 'day' ? ['outdoors'] : []);

export const stageOf = (h: Helper): Stage => {
  if (h.group === 'adult') return 'adult';
  const age = ageOf(h) ?? 8;
  return age <= 5 ? 'young' : age <= 9 ? 'school' : age <= 12 ? 'tween' : 'teen';
};
const STAGES: Stage[] = ['young', 'school', 'tween', 'teen', 'adult'];
const atLeast = (s: Stage, min: Stage) => STAGES.indexOf(s) >= STAGES.indexOf(min);

interface When {
  outings?: Outing[];
  lengths?: Length[];
  /** Needs every one of these preferences (a pool outing counts as swimming). */
  prefs?: Pref[];
}
interface PersonItem extends When {
  id: string;
  /** Words by stage (missing: the adult/default words); a young child's are short. */
  title: string | ((n: number, s: Stage) => string);
  young?: string;
  /** From this stage the person packs it themselves; below it a grown-up helps. Undefined: everyone packs it. */
  selfFrom?: Stage;
  /** A grown-up's at every age (medicine, documents, forms, safety gear). */
  critical?: true;
  /** Only children (a comfort item), or only grown-ups. */
  for?: 'children' | 'adults';
  /** Only this age group (a teen's own phone). */
  only?: Stage;
  icon?: string;
  /** Higher first when lists are trimmed by age. */
  priority: number;
}
interface SharedItem extends When {
  id: string;
  title: string;
  /** Only grown-ups can own it. */
  critical?: true;
  weight: number;
}

const ALL: Length[] = ['hours', 'day', 'overnight', 'multi'];
const AWAY: Length[] = ['overnight', 'multi'];
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

const personItems: PersonItem[] = [
  { id: 'bag', title: 'My bag or backpack', young: 'My backpack', icon: 'pack-my-backpack', priority: 9, selfFrom: 'young' },
  { id: 'water', title: 'Water bottle, filled', young: 'Water bottle', priority: 9, selfFrom: 'school' },
  { id: 'swimsuit', title: 'Swimsuit', prefs: ['swim'], priority: 10, selfFrom: 'young' },
  { id: 'towel', title: 'Towel', prefs: ['swim'], priority: 9, selfFrom: 'young' },
  { id: 'goggles', title: 'Goggles', prefs: ['swim'], lengths: ['hours', 'day', 'multi'], priority: 3, selfFrom: 'school', for: 'children' },
  { id: 'cover', title: 'Cover-up or dry clothes for after', young: 'Dry clothes', prefs: ['swim'], lengths: ['hours', 'day'], priority: 7, selfFrom: 'school' },
  { id: 'hat', title: 'Hat and sunglasses', young: 'Sun hat', outings: ['camp', 'pool', 'day', 'vacation'], priority: 6, selfFrom: 'young' },
  { id: 'shoes', title: 'Shoes for the day', young: 'Shoes', outings: ['camp', 'day', 'vacation', 'roadtrip'], lengths: ['day', 'overnight', 'multi'], priority: 5, selfFrom: 'young' },
  { id: 'sandals', title: 'Sandals or water shoes', prefs: ['swim'], outings: ['pool', 'vacation', 'camp'], priority: 4, selfFrom: 'school' },
  { id: 'layers', title: 'A sweater or rain jacket', young: 'Jacket', prefs: ['cool'], priority: 7, selfFrom: 'school' },
  { id: 'spare', title: 'A spare set of clothes', young: 'Spare clothes', outings: ['camp', 'day', 'roadtrip'], lengths: ['day'], priority: 5, selfFrom: 'school', for: 'children' },
  { id: 'outfits', title: (n, s) => (s === 'young' ? `Clothes for ${days(n)}` : `Outfits for ${days(n)}`), lengths: AWAY, priority: 10, selfFrom: 'school', icon: 'get-dressed' },
  { id: 'underwear', title: (n) => `Underwear and socks for ${days(n)}`, young: 'Underwear and socks', lengths: AWAY, priority: 10, selfFrom: 'school' },
  { id: 'pajamas', title: 'Pajamas', lengths: AWAY, priority: 9, selfFrom: 'young', icon: 'get-ready-for-bed' },
  { id: 'toothbrush', title: 'Toothbrush and toothpaste', young: 'Toothbrush', lengths: AWAY, priority: 9, selfFrom: 'school', icon: 'brush-my-teeth' },
  { id: 'toiletries', title: 'Hairbrush and toiletries', lengths: AWAY, priority: 5, selfFrom: 'tween' },
  { id: 'sleeping', title: 'Sleeping bag and pillow', young: 'Pillow', outings: ['sleepover', 'camp'], lengths: AWAY, priority: 8, selfFrom: 'school' },
  { id: 'comfort', title: 'A favorite stuffed animal or blanket', young: 'My cuddly toy', lengths: AWAY, priority: 6, selfFrom: 'young', for: 'children' },
  { id: 'book', title: 'A book or quiet game', young: 'A book', outings: ['roadtrip', 'vacation', 'sleepover', 'custom'], priority: 5, selfFrom: 'young', for: 'children' },
  { id: 'car-fun', title: 'Something to do in the car', young: 'A car toy', outings: ['roadtrip', 'vacation'], priority: 5, selfFrom: 'young', for: 'children' },
  { id: 'headphones', title: 'Headphones and a device, charged', outings: ['roadtrip', 'vacation'], priority: 4, selfFrom: 'tween' },
  { id: 'phone', title: 'Phone and charger', priority: 8, selfFrom: 'teen', for: 'adults' },
  { id: 'teen-phone', title: 'My phone and charger', priority: 7, selfFrom: 'teen', for: 'children', only: 'teen', lengths: ['day', 'overnight', 'multi'] },
  { id: 'lunch', title: 'Lunch and a snack, if camp doesn’t provide them', young: 'Lunch box', outings: ['camp'], lengths: ['day'], priority: 7, selfFrom: 'tween', for: 'children' },
  { id: 'camp-list', title: 'Everything on the camp’s own list', outings: ['camp'], prefs: ['camp-list'], priority: 10, selfFrom: 'teen', for: 'children' },
  { id: 'bug', title: 'Bug spray', prefs: ['outdoors'], lengths: ['day', 'overnight', 'multi'], priority: 3, selfFrom: 'tween' },
  { id: 'laundry-bag', title: 'A bag for dirty clothes', lengths: ['multi'], priority: 4, selfFrom: 'school' },
  // A grown-up's, at every age.
  { id: 'meds', title: 'Medicine or allergy supplies, if needed', young: 'My medicine, if I need it', critical: true, priority: 10 },
  { id: 'camp-forms', title: 'Camp forms, signed', outings: ['camp'], critical: true, priority: 9, for: 'children' },
  { id: 'sunscreen-on', title: 'Sunscreen on before we go', outings: ['camp', 'pool', 'day', 'vacation'], critical: true, priority: 8, for: 'children' },
  { id: 'id', title: 'ID and travel documents', outings: ['vacation', 'roadtrip'], lengths: ['overnight', 'multi'], critical: true, priority: 9, for: 'adults' },
];

const sharedItems: SharedItem[] = [
  { id: 'snacks', title: 'Snacks', outings: ['camp', 'pool', 'roadtrip', 'vacation', 'day', 'custom'], weight: 1 },
  { id: 'water-jug', title: 'Extra water', outings: ['pool', 'day', 'roadtrip', 'vacation', 'camp', 'custom'], weight: 1 },
  { id: 'sunscreen', title: 'Sunscreen for everyone', outings: ['pool', 'day', 'vacation', 'camp', 'roadtrip'], critical: true, weight: 1 },
  { id: 'first-aid', title: 'First-aid kit', critical: true, weight: 2, outings: ['camp', 'pool', 'roadtrip', 'vacation', 'day', 'custom'], lengths: ['day', 'overnight', 'multi'] },
  { id: 'wipes', title: 'Wipes, tissues and a bag for trash', outings: ['roadtrip', 'vacation', 'day', 'pool'], weight: 1 },
  { id: 'pool-bag', title: 'Pool bag with a wet bag', prefs: ['swim'], weight: 1 },
  { id: 'chargers', title: 'Chargers and cables', lengths: ['overnight', 'multi'], outings: ['roadtrip', 'vacation', 'custom'], weight: 1 },
  { id: 'documents', title: 'Tickets, reservations and documents', outings: ['vacation', 'roadtrip'], lengths: ['overnight', 'multi'], critical: true, weight: 3 },
  { id: 'car', title: 'Car ready: gas, directions, car seats', outings: ['roadtrip', 'vacation', 'day'], lengths: ['day', 'overnight', 'multi'], critical: true, weight: 3 },
  { id: 'pickup', title: 'Drop-off and pickup plan', outings: ['camp', 'sleepover'], critical: true, weight: 2 },
  { id: 'cooler', title: 'Cooler with lunch', outings: ['pool', 'day', 'roadtrip'], lengths: ['day'], weight: 2 },
  { id: 'games', title: 'A game or ball to share', outings: ['pool', 'day', 'vacation', 'roadtrip'], weight: 1 },
  { id: 'toiletries-kit', title: 'Shared toiletries and laundry soap', lengths: ['multi'], weight: 1 },
  { id: 'umbrella', title: 'Umbrella or rain gear', prefs: ['cool'], weight: 1 },
];

/** Most items on a person's list, by age: short for the youngest, fuller for teens and grown-ups. */
const MAX: Record<Stage, number> = { young: 6, school: 9, tween: 11, teen: 12, adult: 10 };
/** Laundry on a long trip: pack for at most this many days. */
const LAUNDRY_DAYS = 4;

export interface PackingInput {
  outing: Outing;
  length: Length;
  /** Multiple days: how many nights (1–21). */
  nights: number;
  prefs: Pref[];
}

export interface PackItem {
  /** `${itemId}` (unique within a person's list or the shared list), or a custom id. */
  key: string;
  itemId: string | null;
  title: string;
  /** A child's list: they pack it, or a grown-up helps. Grown-ups' lists: always 'self'. */
  section: 'self' | 'help';
  icon?: string;
  /** A grown-up's at every age (never moved to a child's own section by suggestions). */
  critical?: true;
  done?: boolean;
  /** She edited it (wording or section): re-planning keeps it. */
  edited?: true;
}
export interface SharedPackItem {
  key: string;
  itemId: string | null;
  title: string;
  owner: string | null;
  critical?: true;
  done?: boolean;
  pinned?: true;
}

const has = (o: PackingInput, w: When) =>
  (!w.outings || w.outings.includes(o.outing)) && (!w.lengths || w.lengths.includes(o.length)) && (!w.prefs || w.prefs.every((p) => o.prefs.includes(p) || (p === 'swim' && o.outing === 'pool')));

/** Days of clothing for a trip: nights + 1, capped with laundry. */
export const clothingDays = (o: PackingInput) => (o.length === 'overnight' ? 2 : o.length === 'multi' ? Math.min(Math.max(1, o.nights) + 1, o.prefs.includes('laundry') ? LAUNDRY_DAYS : 99) : 1);

/** One person's list for an outing, in words for their age. */
export function personList(h: Helper, o: PackingInput): PackItem[] {
  const s = stageOf(h);
  const child = s !== 'adult';
  const n = clothingDays(o);
  const fits = personItems.filter((it) => has(o, it) && (!it.for || (it.for === 'children') === child) && (!it.only || it.only === s));
  // The essentials always stay; the rest are trimmed to what suits the age.
  const keep = [...fits].sort((a, b) => b.priority - a.priority).filter((it, i) => it.critical || i < MAX[s] || it.priority >= 10);
  return fits.filter((it) => keep.includes(it)).map((it) => {
    const words = typeof it.title === 'function' ? it.title(n, s) : s === 'young' && it.young ? it.young : it.title;
    // A grown-up packs everything on their own list; a child packs what suits their age, never the critical items.
    const self = !child || (!it.critical && (!it.selfFrom || atLeast(s, it.selfFrom)));
    return { key: it.id, itemId: it.id, title: words, section: (self ? 'self' : 'help') as PackItem['section'], ...(it.icon ? { icon: it.icon } : {}), ...(it.critical ? { critical: true as const } : {}) };
  }).sort((a, b) => Number(a.section === 'help') - Number(b.section === 'help'));
}

/** Words for a child's "Pack, Check, Unpack" by age. */
export function packCheckUnpack(h: Helper): { pack: string; check: string; unpack: string } {
  const s = stageOf(h);
  if (s === 'adult') return { pack: 'Pack your own list and your shared items.', check: 'Check the children’s grown-up items and the shared list.', unpack: 'Put your things away and restock what’s shared.' };
  if (s === 'young') return { pack: 'Find each thing in the pictures.', check: 'Show a grown-up your bag.', unpack: 'Put my things away when we get home.' };
  if (s === 'school') return { pack: 'Gather everything on my list.', check: 'Check each box, then a grown-up checks.', unpack: 'Dirty clothes in the hamper, my things back where they live.' };
  if (s === 'tween') return { pack: 'Pack my whole list myself.', check: 'Check my list; a grown-up checks the important things.', unpack: 'Unpack, hang up wet things, put my bag away.' };
  return { pack: 'Pack my own bag.', check: 'Check my list; bring medicine or documents to a grown-up.', unpack: 'Unpack the same day and restock anything I used up.' };
}

/** The shared list for an outing, without owners. */
export function sharedList(o: PackingInput): SharedPackItem[] {
  return sharedItems.filter((it) => has(o, it)).map((it) => ({ key: it.id, itemId: it.id, title: it.title, owner: null, ...(it.critical ? { critical: true as const } : {}) }));
}

/** Why someone can't own a shared item (or null): critical items are grown-ups'; other items from age 13. */
export function cannotOwnShared(x: SharedPackItem, h: Helper): string | null {
  if (h.group === 'adult') return null;
  if (x.critical) return 'a grown-up’s';
  if (h.group !== 'teen') return 'from age 13';
  return null;
}

const weightOf = (x: SharedPackItem) => sharedItems.find((s) => s.id === x.itemId)?.weight ?? 1;
const HOLDER_LEAN = 0.6;
/**
 * Owners for the shared list: pinned owners stay; critical items go to grown-ups by load (the account holder leaning
 * last), then the rest, a teen taking a turn with a non-critical item. Returns new objects.
 */
export function assignShared(items: readonly SharedPackItem[], people: readonly Helper[]): SharedPackItem[] {
  const out = items.map((x) => ({ ...x }));
  const load = new Map(people.map((h) => [h.id, 0]));
  for (const x of out) {
    if (x.pinned && x.owner && load.has(x.owner)) load.set(x.owner, load.get(x.owner)! + weightOf(x));
    else { delete x.pinned; x.owner = null; }
  }
  const share = (h: Helper) => load.get(h.id)! / (h.group === 'adult' ? 1 : 0.5) + (h.holder ? HOLDER_LEAN : 0);
  const open = out.filter((x) => !x.owner).sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)) || weightOf(b) - weightOf(a));
  for (const x of open) {
    const who = people.filter((h) => !cannotOwnShared(x, h)).sort((a, b) => share(a) - share(b) || rankOf(b) - rankOf(a))[0];
    x.owner = who?.id ?? null;
    if (who) load.set(who.id, load.get(who.id)! + weightOf(x));
  }
  return out;
}

/** "Leo’s Pool Bag", "Family Road Trip Essentials": a saved list's suggested name. */
export function templateName(o: PackingInput, people: readonly Helper[]): string {
  const what = { camp: 'Camp Checklist', pool: 'Pool Bag', roadtrip: 'Road Trip Essentials', vacation: 'Vacation Packing', day: 'Day Out Bag', sleepover: 'Sleepover Bag', custom: 'Packing List' }[o.outing];
  return people.length === 1 ? `${people[0].name}’s ${what}` : `Family ${what}`;
}
