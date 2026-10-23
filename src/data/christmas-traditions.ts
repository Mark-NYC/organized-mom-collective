/**
 * The Family Christmas Traditions Picker's ideas and rules (src/components/site/TraditionsPicker.astro and
 * traditions-picker.ts beside it). Small, ordinary activities a family can do at home or nearby, with nothing that
 * assumes a local event exists. The picker suggests three, never a calendar of them: fewer, chosen on purpose.
 *
 * Every idea has one job a child can do, for three age bands; the picker shows the one that fits the youngest child
 * old enough to help, so everyone can join in.
 */

export type TraditionTime = 'short' | 'hour' | 'half-day';
export type TraditionCost = 'free' | 'under-25' | 'flexible';
export type TraditionSetting = 'home' | 'out';
export type TraditionKind = 'giving' | 'cozy' | 'making' | 'food' | 'outing' | 'together';
/** Under 5, 5–8, 9 and up. */
export type KidBand = 'little' | 'young' | 'older';

export interface Tradition {
  /** Stable once released: saved picks point at it. */
  id: string;
  name: string;
  /** One or two sentences. */
  about: string;
  time: TraditionTime;
  /** How long, in words ("About 30 minutes"). */
  takes: string;
  cost: TraditionCost;
  setting: TraditionSetting;
  /** For variety: three picks never share a kind. */
  kind: TraditionKind;
  /** Suggested only when the youngest child is at least this old. */
  minAge?: number;
  /** Not suggested when every child is a teenager. */
  young?: true;
  /** Ages it's especially good for (the youngest child's band, or 'teens' when every child is 13 or older): ranked higher. */
  suits?: (KidBand | 'teens')[];
  kids: Record<KidBand, string>;
}

export const timeOptions: { id: TraditionTime; label: string }[] = [
  { id: 'short', label: '15–30 minutes' },
  { id: 'hour', label: 'About an hour' },
  { id: 'half-day', label: 'Half a day' },
];
export const costOptions: { id: TraditionCost; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'under-25', label: 'Under $25' },
  { id: 'flexible', label: 'Flexible' },
];
export const settingOptions: { id: TraditionSetting | 'either'; label: string }[] = [
  { id: 'home', label: 'At home' },
  { id: 'out', label: 'Out and about' },
  { id: 'either', label: 'Either' },
];
/** The age chips a visitor without a family profile taps (a profile hands over real ages instead). */
export const ageOptions: { id: string; label: string; age: number }[] = [
  { id: 'under-5', label: 'Under 5', age: 3 },
  { id: '5-8', label: '5–8', age: 6 },
  { id: '9-12', label: '9–12', age: 10 },
  { id: 'teens', label: 'Teens', age: 14 },
];
export const costLabel: Record<TraditionCost, string> = { free: 'Free', 'under-25': 'Under $25', flexible: 'Flexible budget' };

export const TRADITIONS_REMINDER = 'Three meaningful traditions are better than twenty things you feel obligated to do.';

export const traditions: Tradition[] = [
  {
    id: 'cookies-neighbor', name: 'Cookies for a neighbor', kind: 'giving', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['little', 'young'],
    about: 'Bake one simple batch together, keep a few, and carry a plate next door.',
    kids: { little: 'Stir the dough and add the sprinkles.', young: 'Choose which neighbor gets the plate and carry it to the door.', older: 'Read the recipe and run the baking, with a grown-up nearby for the oven.' },
  },
  {
    id: 'cocoa-carols', name: 'Cocoa and carols', kind: 'cozy', time: 'short', takes: 'About 20 minutes', cost: 'free', setting: 'home', suits: ['little'],
    about: 'Make hot cocoa and sing or play a few favorite Christmas songs in the living room.',
    kids: { little: 'Choose the first song.', young: 'Add the marshmallows and pass out the mugs.', older: 'Make a short playlist with one favorite from everyone.' },
  },
  {
    id: 'cards-grandparents', name: 'Handmade cards for grandparents', kind: 'making', time: 'short', takes: 'About 30 minutes', cost: 'free', setting: 'home', suits: ['young'],
    about: 'Fold paper, draw a picture and write a few words for grandparents or someone who lives far away.',
    kids: { little: 'Draw the picture on the front.', young: 'Write the message inside, or say it while a grown-up writes.', older: 'Address the envelopes and get them in the mail.' },
  },
  {
    id: 'christmas-story', name: 'Read a Christmas story together', kind: 'cozy', time: 'short', takes: 'About 15 minutes', cost: 'free', setting: 'home', suits: ['little'],
    about: 'Before bed, read the Christmas story or a favorite Christmas book together, everyone in one spot.',
    kids: { little: 'Hold the book and turn the pages.', young: 'Read a part aloud, or retell it in their own words.', older: 'Read it aloud to the family.' },
  },
  {
    id: 'lights-walk', name: 'Walk to see the Christmas lights', kind: 'outing', time: 'hour', takes: 'About 45 minutes', cost: 'free', setting: 'out', suits: ['little', 'young'],
    about: 'After dinner, bundle up and walk or drive around your neighborhood to see the lights. Bring cocoa in a thermos.',
    kids: { little: 'Spot the most colorful house.', young: 'Choose the route and lead the way, with a grown-up beside them.', older: 'Make the cocoa and pack the thermos.' },
  },
  {
    id: 'movie-night', name: 'Christmas movie night', kind: 'cozy', time: 'half-day', takes: 'About 2 hours', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Pick a Christmas movie, make popcorn at home, and pile onto the couch with blankets.',
    kids: { little: 'Bring the blankets and pillows to the couch.', young: 'Choose the movie from two or three you’ve agreed on.', older: 'Make the popcorn and set up the room.' },
  },
  {
    id: 'decorate-tree', name: 'Decorate the tree together', kind: 'together', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'home', suits: ['little', 'young'],
    about: 'Put on music, hand out the ornaments, and let everyone hang their own. If your tree is already up, swap this idea.',
    kids: { little: 'Hang the unbreakable ornaments on the low branches.', young: 'Hand out ornaments and tell the story of a favorite one.', older: 'Untangle and test the lights before they go on.' },
  },
  {
    id: 'christmas-breakfast', name: 'A simple Christmas breakfast', kind: 'food', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['older'],
    about: 'Choose one easy breakfast, like pancakes or cinnamon rolls and fruit, and make it together on Christmas morning or a December weekend.',
    kids: { little: 'Set the table and put out the napkins.', young: 'Mix the batter or arrange the fruit.', older: 'Plan the menu and write the shopping list.' },
  },
  {
    id: 'service', name: 'Choose a family service project', kind: 'giving', time: 'half-day', takes: 'A morning or afternoon', cost: 'free', setting: 'out', suits: ['older', 'teens'],
    about: 'Pick one way to help together: a toy or coat drive, a food pantry collection, or a meal for a family who could use one.',
    kids: { little: 'Carry a bag to the donation spot.', young: 'Choose a toy or food to give.', older: 'Ask what’s needed (a school, church or neighbor may know) and make the list.' },
  },
  {
    id: 'giving-bag', name: 'Fill a giving bag', kind: 'giving', time: 'short', takes: 'About 30 minutes', cost: 'free', setting: 'home',
    about: 'Everyone adds something to give away: a coat that’s too small, a toy in good shape, a few cans of food. Drop it off together this week.',
    kids: { little: 'Choose one toy to add.', young: 'Sort what goes in the bag.', older: 'Find out where it can go and when it’s open.' },
  },
  {
    id: 'thank-helpers', name: 'Thank-you treats for helpers', kind: 'giving', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['older', 'teens'],
    about: 'Make a small treat or note for someone who helps your family all year: a teacher, bus driver, coach or mail carrier.',
    kids: { little: 'Decorate the bag or card.', young: 'Choose who it’s for and write their name.', older: 'Write the thank-you note themselves.' },
  },
  {
    id: 'snack-basket', name: 'A snack basket for delivery drivers', kind: 'giving', time: 'short', takes: 'About 20 minutes', cost: 'under-25', setting: 'home',
    about: 'Set out a basket of snacks and water by the door with a thank-you sign for the people bringing packages this month.',
    kids: { little: 'Decorate the thank-you sign.', young: 'Fill the basket.', older: 'Make the sign and keep the basket stocked.' },
  },
  {
    id: 'paper-snowflakes', name: 'Paper snowflakes for the windows', kind: 'making', time: 'short', takes: 'About 30 minutes', cost: 'free', setting: 'home', minAge: 3, young: true, suits: ['little'],
    about: 'Fold and cut paper snowflakes, then tape them to the windows where everyone can see them.',
    kids: { little: 'Fold the paper and choose where each one goes, while a grown-up cuts.', young: 'Cut their own with safety scissors.', older: 'Teach everyone a new snowflake pattern.' },
  },
  {
    id: 'ornament-year', name: 'An ornament for this year', kind: 'making', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['young'],
    about: 'Make one simple ornament with the year on it: salt dough, a painted wooden one, or a photo in a paper frame.',
    kids: { little: 'Press a handprint or add the glitter.', young: 'Paint or decorate it.', older: 'Write the year and one word about this year on the back.' },
  },
  {
    id: 'graham-houses', name: 'Graham cracker houses', kind: 'making', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', minAge: 3, suits: ['little', 'young'],
    about: 'Build little houses with graham crackers, frosting and a few candies. Nobody’s house needs to be perfect.',
    kids: { little: 'Put on the candy.', young: 'Build the walls with frosting “glue.”', older: 'Set out the supplies and design their own house.' },
  },
  {
    id: 'memory-dinner', name: 'Favorite-memory dinner', kind: 'together', time: 'short', takes: 'About 20 minutes, at dinner', cost: 'free', setting: 'home', suits: ['teens'],
    about: 'At dinner one night, everyone shares a favorite memory from this year. Grown-ups too.',
    kids: { little: 'Pick a photo from this year to show.', young: 'Ask everyone the question.', older: 'Write down everyone’s answers to keep with the decorations.' },
  },
  {
    id: 'game-night', name: 'Christmas game night', kind: 'together', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'home', minAge: 3, suits: ['young', 'older', 'teens'],
    about: 'Pick a board game or card game everyone can play, with a holiday snack.',
    kids: { little: 'Choose the snack.', young: 'Pick the game and explain the rules.', older: 'Set up the game and keep score.' },
  },
  {
    id: 'next-year-notes', name: 'Notes to open next Christmas', kind: 'together', time: 'short', takes: 'About 20 minutes', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Everyone writes or draws a note to open next year: what they loved this Christmas and what they hope for.',
    kids: { little: 'Draw a picture of their favorite thing.', young: 'Write their own note.', older: 'Seal the notes and store them with the decorations.' },
  },
  {
    id: 'cook-one-dish', name: 'Make one Christmas dish together', kind: 'food', time: 'half-day', takes: 'An afternoon', cost: 'under-25', setting: 'home', suits: ['older', 'teens'],
    about: 'Choose one dish for your Christmas meal, like a pie, rolls or a side, and make it together ahead of time.',
    kids: { little: 'Wash the vegetables or stir.', young: 'Measure the ingredients.', older: 'Read the recipe and lead it.' },
  },
  {
    id: 'service-concert', name: 'A Christmas service or concert', kind: 'outing', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'out',
    about: 'If there’s a Christmas service, school concert or carol sing you already know about, go together.',
    kids: { little: 'Choose a festive outfit.', young: 'Help get everyone’s coats and shoes by the door.', older: 'Find the time and add it to the family calendar.' },
  },
  {
    id: 'giving-tree', name: 'Shop for a giving-tree gift', kind: 'giving', time: 'hour', takes: 'About an hour', cost: 'flexible', setting: 'out', suits: ['older', 'teens'],
    about: 'Choose a gift for a child or family through a giving tree, toy drive or school collection, and shop for it together.',
    kids: { little: 'Help pick the gift and carry it.', young: 'Choose the gift within the budget.', older: 'Compare a few options and keep to the budget.' },
  },
  {
    id: 'winter-walk', name: 'A long winter walk', kind: 'outing', time: 'half-day', takes: 'A morning or afternoon', cost: 'free', setting: 'out',
    about: 'Take a long walk at a park or trail you already like. Bring a thermos and snacks, and take your time.',
    kids: { little: 'Collect pinecones for the table.', young: 'Pack the snack bag.', older: 'Pick the trail and plan the route.' },
  },
  {
    id: 'day-out', name: 'One festive day out', kind: 'outing', time: 'half-day', takes: 'Half a day', cost: 'flexible', setting: 'out',
    about: 'Choose one festive outing you already know about, like a Christmas market or a light display, and make a day of it.',
    kids: { little: 'Pack a small bag with mittens and a snack.', young: 'Help choose where to stop for lunch.', older: 'Check the times and cost, then add it to the family calendar.' },
  },
];

export const traditionById = (id: string) => traditions.find((t) => t.id === id);

export interface TraditionPrefs {
  /** Children's ages (a profile's, or the chips'); empty when unknown. */
  ages: number[];
  time: TraditionTime;
  cost: TraditionCost;
  setting: TraditionSetting | 'either';
}

/** Opens with suggestions straight away: no question has to be answered first. */
export const defaultPrefs: TraditionPrefs = { ages: [], time: 'hour', cost: 'under-25', setting: 'either' };

const TIME_ORDER: TraditionTime[] = ['short', 'hour', 'half-day'];
const COST_ORDER: TraditionCost[] = ['free', 'under-25', 'flexible'];

/** Who the kids' line is for: the youngest child old enough to help (2 and up), so everyone can join in. */
export function kidBand(ages: readonly number[]): KidBand {
  const helpers = ages.filter((a) => a >= 2);
  if (!ages.length) return 'young';
  const youngest = helpers.length ? Math.min(...helpers) : 2;
  return youngest < 5 ? 'little' : youngest < 9 ? 'young' : 'older';
}

/** True when the idea fits: within her time and budget, where she wants it, and right for her children's ages. */
export function fits(t: Tradition, p: TraditionPrefs): boolean {
  if (TIME_ORDER.indexOf(t.time) > TIME_ORDER.indexOf(p.time)) return false;
  if (COST_ORDER.indexOf(t.cost) > COST_ORDER.indexOf(p.cost)) return false;
  if (p.setting !== 'either' && t.setting !== p.setting) return false;
  const kids = p.ages.filter((a) => a >= 2);
  if (t.minAge !== undefined && kids.length && Math.min(...kids) < t.minAge) return false;
  if (t.young && kids.length && kids.every((a) => a >= 13)) return false;
  return true;
}

/** Which ages an idea should suit for this family: the youngest helper's band, or 'teens' when every child is one. */
export function ageFocus(ages: readonly number[]): KidBand | 'teens' | null {
  const kids = ages.filter((a) => a >= 2);
  if (!kids.length) return null;
  return kids.every((a) => a >= 13) ? 'teens' : kidBand(kids);
}

/** Best first: the time she has (not much less), then ideas that suit her children's ages, then her budget. Ties keep the list's order. */
function score(t: Tradition, p: TraditionPrefs) {
  const timeGap = TIME_ORDER.indexOf(p.time) - TIME_ORDER.indexOf(t.time);
  const costGap = COST_ORDER.indexOf(p.cost) - COST_ORDER.indexOf(t.cost);
  const focus = ageFocus(p.ages);
  return (timeGap === 0 ? 4 : timeGap === 1 ? 2 : 0) + (focus && t.suits?.includes(focus) ? 1.5 : 0) + (costGap === 0 ? 1 : 0.5);
}

/** Every idea that fits, best first. */
export function rankTraditions(p: TraditionPrefs): Tradition[] {
  return traditions
    .map((t, i) => ({ t, i, s: score(t, p) }))
    .filter(({ t }) => fits(t, p))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ t }) => t);
}

/**
 * Three suggestions: the ones she's keeping stay; the rest are the best that fit, never two of one kind, with one
 * way to give to someone outside the family when any fits. `skip`: ideas she swapped away (used again only once
 * everything else has been offered).
 */
export function pickTraditions(p: TraditionPrefs, keep: readonly string[] = [], skip: readonly string[] = [], count = 3): Tradition[] {
  const ranked = rankTraditions(p);
  const kept = keep.map(traditionById).filter((t): t is Tradition => Boolean(t)).slice(0, count);
  const out = [...kept];
  const fresh = ranked.filter((t) => !skip.includes(t.id));
  const take = (pool: Tradition[], ok: (t: Tradition) => boolean) => {
    const t = pool.find((c) => !out.includes(c) && ok(c));
    if (t && out.length < count) out.push(t);
  };
  if (!out.some((t) => t.kind === 'giving')) take(fresh, (t) => t.kind === 'giving');
  for (const pool of [fresh, ranked]) {
    while (out.length < count) {
      const before = out.length;
      take(pool, (t) => !out.some((o) => o.kind === t.kind));
      if (out.length === before) break;
    }
  }
  // Too few kinds fit (a short, free, at-home evening): allow a repeat kind rather than fewer than three ideas.
  while (out.length < count) {
    const before = out.length;
    take([...fresh, ...ranked], () => true);
    if (out.length === before) break;
  }
  // Same order every time: kept ones where they were, then the new.
  return out;
}

/** The next idea for slot `index` when she swaps it: the best that fits and isn't showing or already swapped away. */
export function swapTradition(p: TraditionPrefs, shown: readonly string[], index: number, skipped: readonly string[]): Tradition | undefined {
  const ranked = rankTraditions(p);
  const others = shown.filter((_, i) => i !== index);
  const otherKinds = others.map((id) => traditionById(id)?.kind);
  const open = (t: Tradition) => !shown.includes(t.id) && !skipped.includes(t.id);
  return (
    ranked.find((t) => open(t) && !otherKinds.includes(t.kind)) ??
    ranked.find(open) ??
    // Everything has been offered: start over from the ones she swapped away, oldest first.
    skipped.map(traditionById).find((t): t is Tradition => Boolean(t) && fits(t!, p) && !shown.includes(t!.id))
  );
}

/** The plain-text copy of her picks, for a note, a message or the family calendar. */
export function traditionsText(picks: readonly Tradition[], band: KidBand, title = 'Our Christmas Traditions'): string {
  const rows = picks.map((t, i) => [`${i + 1}. ${t.name}`, `   ${t.about}`, `   ${t.takes} · ${costLabel[t.cost]}`, `   Kids can: ${t.kids[band]}`].join('\n'));
  return [title, '', ...rows.flatMap((r) => [r, '']), TRADITIONS_REMINDER].join('\n');
}
