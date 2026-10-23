/**
 * The Family Connection Planner's ideas and rules (src/components/site/ConnectionPlanner.astro and
 * connection-planner.ts beside it): small, ordinary ways for a family to enjoy each other, chosen by the children's
 * ages, the time the family has, its budget and where. Three suggestions: a family moment, a one-on-one moment and a
 * simple rhythm (or two of one kind, if that's what she asks for). Nothing assumes two parents, a particular grown-up
 * or a local venue; every idea says how it's shared, so it isn't one more thing for Mom to run.
 * Fit and order: the site's shared idea rules (src/lib/idea-picker.ts), the same as the traditions picker.
 */
import { ageFocus, ideaFits, kidBand, rankIdeas, type AgeFocus, type IdeaScale } from '../lib/idea-picker';

export type ConnectionSlot = 'family' | 'one-on-one' | 'rhythm';
export type ConnectionKind = 'family' | 'one-on-one' | 'both';
export type ConnectionTime = '15' | '30' | 'hour' | 'more';
export type ConnectionCost = 'free' | 'under-25' | 'flexible';

export interface ConnectionIdea {
  /** Stable once released: saved picks point at it. */
  id: string;
  slot: ConnectionSlot;
  title: string;
  /** One or two sentences. */
  about: string;
  time: ConnectionTime;
  /** How long, in words. */
  takes: string;
  cost: ConnectionCost;
  setting: 'home' | 'out';
  minAge?: number;
  young?: true;
  suits?: AgeFocus[];
  /** Simple preparation, or '' when there's none. */
  prep: string;
  /** How it's shared rather than run by one person. */
  share: string;
  /** One conversation question to go with it. */
  question: string;
}

export const slotLabel: Record<ConnectionSlot, string> = { family: 'Family moment', 'one-on-one': 'One-on-one moment', rhythm: 'Simple connection rhythm' };

export const kindOptions: { id: ConnectionKind; label: string }[] = [
  { id: 'family', label: 'Whole family' },
  { id: 'one-on-one', label: 'One-on-one' },
  { id: 'both', label: 'Both' },
];
export const timeOptions: { id: ConnectionTime; label: string }[] = [
  { id: '15', label: '15 minutes' },
  { id: '30', label: '30 minutes' },
  { id: 'hour', label: 'About an hour' },
  { id: 'more', label: 'More time' },
];
export const costOptions: { id: ConnectionCost; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'under-25', label: 'Under $25' },
  { id: 'flexible', label: 'Flexible' },
];
export const settingOptions: { id: 'home' | 'out' | 'either'; label: string }[] = [
  { id: 'home', label: 'At home' },
  { id: 'out', label: 'Outdoors or out' },
  { id: 'either', label: 'Either' },
];
/** The age chips a visitor without a family profile taps (a profile hands over real ages instead). */
export const ageOptions: { id: string; label: string; age: number }[] = [
  { id: 'under-5', label: 'Under 5', age: 3 },
  { id: '5-8', label: '5–8', age: 6 },
  { id: '9-12', label: '9–12', age: 10 },
  { id: 'teens', label: 'Teens', age: 14 },
];
export const costLabel: Record<ConnectionCost, string> = { free: 'Free', 'under-25': 'Under $25', flexible: 'Flexible budget' };

export const CONNECTION_NOTE = 'One meaningful moment is a win. You don’t have to do all three.';

export const connectionIdeas: ConnectionIdea[] = [
  // Family moments
  { id: 'game-night', slot: 'family', title: 'Board game night', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'home', minAge: 4, suits: ['young', 'older'],
    about: 'Pick a game everyone can play, put out a simple snack, and leave the phones in another room for an hour.',
    prep: 'Choose the game and the snack.', share: 'The kids choose the game; someone else sets it up and makes the snack.', question: 'What’s something that made you laugh this week?' },
  { id: 'pizza-night', slot: 'family', title: 'Make-your-own pizza night', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['little', 'young'],
    about: 'Everyone tops their own pizza with store-bought dough and whatever’s in the fridge, then you eat together.',
    prep: 'Buy dough, sauce and cheese.', share: 'Each person preps one topping, and the kids set the table.', question: 'If you could invent a pizza, what would be on it?' },
  { id: 'family-walk', slot: 'family', title: 'After-dinner walk', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'out',
    about: 'Walk around the block or to a nearby park together, with no destination and no rush.',
    prep: 'Shoes and jackets by the door.', share: 'A different person chooses the route each time.', question: 'What was the best part of your day?' },
  { id: 'movie-night', slot: 'family', title: 'Movie night at home', time: 'more', takes: 'About 2 hours', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Choose a movie together, make popcorn and pile onto the couch.',
    prep: 'Agree on two or three movies before the night.', share: 'One person picks from the shortlist; another makes the popcorn.', question: 'Which character would you most want as a friend?' },
  { id: 'cook-dinner', slot: 'family', title: 'Cook dinner together', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['young', 'older', 'teens'],
    about: 'Choose one simple meal and give everyone a part, from washing vegetables to setting the table.',
    prep: 'Pick the recipe and check you have the ingredients.', share: 'Each person owns one part of the meal, start to finish.', question: 'What’s a meal you’d love us to make again?' },
  { id: 'pancake-breakfast', slot: 'family', title: 'Weekend pancake breakfast', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'home', suits: ['little', 'young'],
    about: 'Make pancakes or another easy breakfast together on a slow weekend morning.',
    prep: 'Check for eggs, milk and flour the night before.', share: 'The kids mix and pour with help; someone else does the dishes.', question: 'What would your perfect Saturday look like?' },
  { id: 'park-play', slot: 'family', title: 'Play at the park', time: 'hour', takes: 'About an hour', cost: 'free', setting: 'out', suits: ['little', 'young'],
    about: 'Head to a park you already know and play together, grown-ups included.',
    prep: 'Water bottles and a ball.', share: 'The kids pack the bag and pick what to play first.', question: 'What’s something new you’d like to try this year?' },
  { id: 'dance-party', slot: 'family', title: 'Kitchen dance party', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'home', young: true, suits: ['little', 'young'],
    about: 'Put on three favorite songs and dance while dinner cooks or after the dishes are done.',
    prep: '', share: 'Everyone adds one song to the list.', question: 'What song always puts you in a good mood?' },
  { id: 'new-recipe', slot: 'family', title: 'Try a new recipe together', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', minAge: 9, suits: ['older', 'teens'],
    about: 'Someone chooses a recipe nobody has made before, and the family makes it together.',
    prep: 'Choose the recipe a few days ahead and shop for it.', share: 'A teen or older child chooses the recipe and leads the cooking.', question: 'What’s a food from somewhere else you’d like to try?' },
  { id: 'long-walk', slot: 'family', title: 'A longer walk or easy hike', time: 'more', takes: 'A morning or afternoon', cost: 'free', setting: 'out', minAge: 5, suits: ['older', 'teens'],
    about: 'Spend a morning or afternoon on a trail or path you already like, and take your time.',
    prep: 'Snacks, water and the right shoes.', share: 'Older kids plan the route and pack the snacks.', question: 'What’s something you’re looking forward to?' },
  { id: 'family-puzzle', slot: 'family', title: 'A puzzle on the table', time: '15', takes: 'A few minutes at a time', cost: 'under-25', setting: 'home', minAge: 5, suits: ['older', 'teens'],
    about: 'Set a jigsaw puzzle on a table you can leave it on, and anyone adds a few pieces whenever they pass by.',
    prep: 'A puzzle and a spare table.', share: 'No one runs it: anyone can add a few pieces.', question: 'What’s something you’ve been proud of lately?' },
  { id: 'old-photos', slot: 'family', title: 'Look through old photos', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'home', suits: ['young', 'older', 'teens'],
    about: 'Pull up photos or videos from a few years ago and remember together.',
    prep: '', share: 'Each person picks a few favorites to show.', question: 'What’s a favorite memory from when you were little?' },

  { id: 'joke-night', slot: 'family', title: 'Bring a joke to dinner', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'home', minAge: 4, suits: ['young', 'older'],
    about: 'Everyone brings one joke or riddle to dinner, and the table guesses the answers.',
    prep: '', share: 'The kids collect the jokes during the day.', question: 'What’s something that made you laugh this week?' },
  { id: 'song-swap', slot: 'family', title: 'Song swap', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Everyone plays one song they love right now and says why.',
    prep: '', share: 'A teen or older child runs the speaker.', question: 'What song always puts you in a good mood?' },

  // One-on-one moments
  { id: 'read-together', slot: 'one-on-one', title: 'Read together', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'home', young: true, suits: ['little', 'young'],
    about: 'Curl up with a book they choose, just the two of you.',
    prep: '', share: 'Any grown-up in the house can take this one. Take turns, so each child gets time with more than one person.', question: 'If you could live inside any book, which one would it be?' },
  { id: 'bake-together', slot: 'one-on-one', title: 'Bake something together', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', suits: ['young', 'older'],
    about: 'Make muffins or cookies, just the two of you, and let them do as much as they can.',
    prep: 'Check you have the ingredients.', share: 'Grown-ups take turns, so it isn’t always the same person baking.', question: 'What do you think you’d be great at when you’re older?' },
  { id: 'short-walk', slot: 'one-on-one', title: 'A short walk, just two of you', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'out',
    about: 'Walk around the block together and let them choose what you talk about.',
    prep: '', share: 'Any grown-up, grandparent or older sibling can take a turn.', question: 'What’s something you’ve been thinking about lately?' },
  { id: 'snack-talk', slot: 'one-on-one', title: 'Talk over a snack', time: '15', takes: 'About 15 minutes', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Sit down with a snack after school or before bed, phones away, and mostly listen.',
    prep: '', share: 'Whoever is home first takes this one.', question: 'What’s one thing that went well this week, and one that didn’t?' },
  { id: 'project', slot: 'one-on-one', title: 'Work on a project together', time: 'more', takes: 'An afternoon', cost: 'under-25', setting: 'home', minAge: 5, suits: ['older', 'teens'],
    about: 'Build, fix, draw or make something together over an afternoon, at their pace.',
    prep: 'Gather the supplies first.', share: 'Let them choose the project and lead it.', question: 'What’s something you’d like to learn how to do?' },
  { id: 'drink-out', slot: 'one-on-one', title: 'Hot chocolate or coffee out', time: '30', takes: 'About 30 minutes', cost: 'under-25', setting: 'out', minAge: 9, suits: ['older', 'teens'],
    about: 'Go out for a drink and a chat, just the two of you.',
    prep: '', share: 'Each grown-up takes a different child, in turns.', question: 'What’s something you wish grown-ups understood about being your age?' },
  { id: 'errand-buddy', slot: 'one-on-one', title: 'Turn an errand into time together', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'out',
    about: 'Bring one child along on an errand you’re already running and talk on the way.',
    prep: '', share: 'Whoever runs the errand brings a different child each time.', question: 'If you could plan our next weekend, what would we do?' },
  { id: 'their-game', slot: 'one-on-one', title: 'Play their game', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'home', suits: ['little', 'young', 'teens'],
    about: 'Let them choose the game, whether it’s blocks, catch, cards or a video game, and play it their way.',
    prep: '', share: 'Any grown-up or older sibling can take a turn.', question: 'What’s your favorite thing to play right now, and why?' },
  { id: 'teach-recipe', slot: 'one-on-one', title: 'Teach them one recipe', time: 'hour', takes: 'About an hour', cost: 'under-25', setting: 'home', minAge: 9, suits: ['older', 'teens'],
    about: 'Cook one dish together that they’d like to be able to make on their own.',
    prep: 'Pick the dish and get the ingredients.', share: 'Any grown-up can pass on a family recipe, grandparents included.', question: 'What’s a dish you’d like to be able to cook for us?' },

  // Simple connection rhythms
  { id: 'good-thing', slot: 'rhythm', title: 'One good thing at dinner', time: '15', takes: 'A few minutes at dinner', cost: 'free', setting: 'home', suits: ['little', 'young'],
    about: 'At dinner, everyone shares one good thing from their day.',
    prep: '', share: 'Take turns choosing who goes first.', question: 'What’s one good thing from your day?' },
  { id: 'bedtime-chat', slot: 'rhythm', title: 'Five-minute bedtime chat', time: '15', takes: 'About 5 minutes', cost: 'free', setting: 'home', young: true, suits: ['little', 'young'],
    about: 'Sit on the edge of the bed for five minutes and ask about their day.',
    prep: '', share: 'Whoever does bedtime that night.', question: 'What made you laugh today?' },
  { id: 'car-questions', slot: 'rhythm', title: 'Car ride questions', time: '15', takes: 'A few minutes in the car', cost: 'free', setting: 'out', suits: ['young', 'older', 'teens'],
    about: 'On the drive to school or practice, one person asks a question and everyone answers.',
    prep: '', share: 'A different person asks the question each day.', question: 'What’s something that made you laugh this week?' },
  { id: 'weekend-breakfast', slot: 'rhythm', title: 'One weekend breakfast at the table', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'home', suits: ['older', 'teens'],
    about: 'Eat one weekend breakfast together at the table, with no rushing off.',
    prep: '', share: 'A different family member chooses the menu each week.', question: 'What should we do together this weekend?' },
  { id: 'appreciation', slot: 'rhythm', title: 'Appreciation at dinner', time: '15', takes: 'A few minutes at dinner', cost: 'free', setting: 'home', minAge: 4, suits: ['older', 'teens'],
    about: 'Once a week at dinner, everyone names one thing they appreciate about someone at the table.',
    prep: '', share: 'The kids can lead it.', question: 'What’s one thing you appreciate about someone in our family?' },
  { id: 'weekly-walk', slot: 'rhythm', title: 'A weekly family walk', time: '30', takes: 'About 30 minutes', cost: 'free', setting: 'out',
    about: 'Pick one regular time, like Sunday afternoon, for a walk together.',
    prep: '', share: 'Someone different picks the route each week.', question: 'What are you looking forward to this week?' },
];

export const connectionById = (id: string) => connectionIdeas.find((t) => t.id === id);

export interface ConnectionPrefs {
  ages: number[];
  kind: ConnectionKind;
  time: ConnectionTime;
  cost: ConnectionCost;
  setting: 'home' | 'out' | 'either';
}

/** Opens with suggestions straight away: no question has to be answered first. */
export const defaultConnectionPrefs: ConnectionPrefs = { ages: [], kind: 'both', time: '30', cost: 'free', setting: 'either' };

const SCALE: IdeaScale = { time: ['15', '30', 'hour', 'more'], cost: ['free', 'under-25', 'flexible'] };

export { kidBand, ageFocus };
export const connectionFits = (t: ConnectionIdea, p: ConnectionPrefs) => ideaFits(t, p, SCALE);
/** Connection is for everyone at the table: ideas that suit more of the family's ages rank higher. */
export const rankConnections = (p: ConnectionPrefs) => rankIdeas(connectionIdeas, p, SCALE, { wholeFamily: true });

/**
 * Rhythms are small by nature (a question at dinner, a walk each week), so the time she has doesn't pick them: the
 * shortest that fit her budget, setting and children's ages come first.
 */
const rankRhythms = (p: ConnectionPrefs) => rankIdeas(connectionIdeas.filter((t) => t.slot === 'rhythm' && connectionFits(t, p)), { ...p, time: '15' }, SCALE, { wholeFamily: true });

/** The three slots for what kind of connection she asked for. */
export const slotsFor = (kind: ConnectionKind): ConnectionSlot[] =>
  kind === 'family' ? ['family', 'family', 'rhythm'] : kind === 'one-on-one' ? ['one-on-one', 'one-on-one', 'rhythm'] : ['family', 'one-on-one', 'rhythm'];

/**
 * Three suggestions, one per slot: the best that fits for each, never the same idea twice. `keep` holds ideas she's
 * keeping in place (by slot index); `skip`, ideas she swapped away (offered again only once everything else has been).
 * A slot with nothing that fits takes the best idea of any kind rather than staying empty.
 */
export function pickConnections(p: ConnectionPrefs, keep: (string | null)[] = [], skip: readonly string[] = []): ConnectionIdea[] {
  const ranked = rankConnections(p);
  const rhythms = rankRhythms(p);
  const slots = slotsFor(p.kind);
  const out: (ConnectionIdea | undefined)[] = slots.map((_, i) => (keep[i] ? connectionById(keep[i]!) : undefined));
  const used = () => out.filter(Boolean).map((t) => t!.id);
  slots.forEach((slot, i) => {
    if (out[i]) return;
    const open = (t: ConnectionIdea) => !used().includes(t.id);
    if (slot === 'rhythm') {
      out[i] = rhythms.find((t) => open(t) && !skip.includes(t.id)) ?? rhythms.find(open);
      if (out[i]) return;
    }
    out[i] =
      ranked.find((t) => t.slot === slot && open(t) && !skip.includes(t.id)) ??
      ranked.find((t) => t.slot === slot && open(t)) ??
      ranked.find((t) => open(t) && !skip.includes(t.id)) ??
      ranked.find(open);
  });
  return out.filter((t): t is ConnectionIdea => Boolean(t));
}

/** Another idea for slot `index`: the next best of the same kind that isn't showing or already swapped away. */
export function swapConnection(p: ConnectionPrefs, shown: readonly string[], index: number, skipped: readonly string[]): ConnectionIdea | undefined {
  const slot = slotsFor(p.kind)[index] ?? connectionById(shown[index])?.slot;
  const ranked = slot === 'rhythm' ? rankRhythms(p) : rankConnections(p);
  const open = (t: ConnectionIdea) => !shown.includes(t.id) && !skipped.includes(t.id);
  return (
    ranked.find((t) => t.slot === slot && open(t)) ??
    // Everything of that kind has been offered: start over from the ones she swapped away, oldest first.
    skipped.map(connectionById).find((t): t is ConnectionIdea => Boolean(t) && t!.slot === slot && connectionFits(t!, p) && !shown.includes(t!.id))
  );
}

export interface ConnectionPlan {
  title: string;
  about: string;
  who: string;
  when: string;
  prep: string;
  question: string;
  share: string;
}

/** Her plan as plain text, for a note, a message or the family calendar. */
export function connectionText(plan: ConnectionPlan, family = ''): string {
  return [
    family.trim() ? `${family.trim()}: Our Family Connection Plan` : 'Our Family Connection Plan',
    '',
    plan.title,
    plan.about,
    '',
    ...(plan.who.trim() ? [`Who: ${plan.who.trim()}`] : []),
    ...(plan.when.trim() ? [`When: ${plan.when.trim()}`] : []),
    ...(plan.prep.trim() ? [`Simple prep: ${plan.prep.trim()}`] : []),
    ...(plan.share.trim() ? [`Shared: ${plan.share.trim()}`] : []),
    ...(plan.question.trim() ? [`Ask: ${plan.question.trim()}`] : []),
    '',
    'Write it in the family and friends section of the wall calendar, or on the day you chose.',
  ].join('\n');
}
