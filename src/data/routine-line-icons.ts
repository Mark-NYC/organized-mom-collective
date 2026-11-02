/**
 * Routine-specific hand-drawn artwork uploaded in assets/icons/ofc/routines.
 * Keep these separate from the Chore Chart's shared icon library.
 *
 * Some original file names use .jpg, while plan-the-week is a PNG.
 * The breakfast upload intentionally retains its original spelling.
 */
const webps = import.meta.glob<string>('../../assets/icons/ofc/tool-transparent/routine/*.webp', { eager: true, query: '?url', import: 'default' });

export const routineIconChoices = [
  { id: 'shoes-and-coat-away', title: 'Shoes & Coat Away', routines: ['afterschool'] },
  { id: 'eat-breakfast', title: 'Eat Breakfast', routines: ['morning', 'weekend', 'summer'] },
  { id: 'eat-a-snack', title: 'Eat a Snack', routines: ['afterschool', 'summer'] },
  { id: 'homework-and-reading', title: 'Homework & Reading', routines: ['afterschool'] },
  { id: 'free-play', title: 'Free Play', routines: ['afterschool', 'summer'] },
  { id: 'bath-or-shower', title: 'Bath or Shower', routines: ['bedtime'] },
  { id: 'lay-out-clothes', title: 'Lay Out Clothes', routines: ['bedtime'] },
  { id: 'read-a-book', title: 'Read a Book', routines: ['bedtime', 'summer'] },
  { id: 'wake-up', title: 'Wake Up', routines: ['morning'] },
  { id: 'grocery-shopping', title: 'Grocery Shopping', routines: ['weekend'] },
  { id: 'screens-off', title: 'Screens Off', routines: ['bedtime', 'summer'] },
  { id: 'prayer-or-gratitude', title: 'Prayer or Gratitude', routines: ['bedtime'] },
  { id: 'practice-music', title: 'Practice Music', routines: ['afterschool', 'summer'] },
  { id: 'fill-water-bottle', title: 'Fill Water Bottle', routines: ['morning', 'bedtime'] },
  { id: 'ride-bike', title: 'Ride Bike', routines: ['summer', 'weekend'] },
  { id: 'quiet-time-rest', title: 'Quiet Time / Rest', routines: ['summer', 'bedtime'] },
  { id: 'plan-the-week', title: 'Plan the Week', routines: ['weekend'] },
] as const;

export type RoutineIconId = (typeof routineIconChoices)[number]['id'];
const filenames: Record<RoutineIconId, string> = {
  'shoes-and-coat-away': 'shoes-and-coat-away.jpg',
  'eat-breakfast': 'eat-breaktfast.jpg',
  'eat-a-snack': 'eat-a-snack.jpg',
  'homework-and-reading': 'homework-and-reading.jpg',
  'free-play': 'free-play.jpg',
  'bath-or-shower': 'bath-or-shower.jpg',
  'lay-out-clothes': 'lay-out-clothes.jpg',
  'read-a-book': 'read-a-book.jpg',
  'wake-up': 'wake-up.jpg',
  'grocery-shopping': 'grocery-shopping.jpg',
  'screens-off': 'screens-off.jpg',
  'prayer-or-gratitude': 'prayer-or-gratitude.jpg',
  'practice-music': 'practice-music.jpg',
  'fill-water-bottle': 'fill-water-bottle.jpg',
  'ride-bike': 'ride-bike.jpg',
  'quiet-time-rest': 'quiet-time-rest.jpg',
  'plan-the-week': 'plan-the-week.png',
};

export const routineIconById = (id: string): string | null => {
  const name = filenames[id as RoutineIconId];
  if (!name) return null;
  return webps[`../../assets/icons/ofc/tool-transparent/routine/${name.replace(/\.(?:jpe?g|png)$/i, '.webp')}`] ?? null;
};

export const routineActivityById = (id: string) => routineIconChoices.find((item) => item.id === id);

/** Order matters: more specific phrases before generic meal, reading, or activity terms. */
const matching: Array<[RegExp, RoutineIconId]> = [
  [/shoes?.*(coat|jacket)|coat.*shoes?|put.*(coat|shoes?)/, 'shoes-and-coat-away'],
  [/homework|schoolwork|study.*read/, 'homework-and-reading'],
  [/lay out.*clothes|tomorrow.s clothes|outfit.*tomorrow/, 'lay-out-clothes'],
  [/plan.*week|weekly plan|family calendar|check the calendar/, 'plan-the-week'],
  [/wake up|stretch|get out of bed/, 'wake-up'],
  [/bath|shower/, 'bath-or-shower'],
  [/prayer|pray|gratitude|thankful/, 'prayer-or-gratitude'],
  [/practice.*(music|instrument|piano|guitar)|musical instrument/, 'practice-music'],
  [/fill.*(water|bottle|cup)|water bottle/, 'fill-water-bottle'],
  [/screen.*off|devices?.*charge|turn off.*(phone|tablet)|screen.time boundaries/, 'screens-off'],
  [/grocery|shopping list|buy groceries/, 'grocery-shopping'],
  [/ride.*bike|bicycl/, 'ride-bike'],
  [/quiet time|rest time|nap|downtime|recharge/, 'quiet-time-rest'],
  [/read|story|books|devotional/, 'read-a-book'],
  [/free play|play on my own|play time|pretend|build something/, 'free-play'],
  [/snack/, 'eat-a-snack'],
  [/breakfast/, 'eat-breakfast'],
];

export function routineIconForText(text: string): string | null {
  const value = text.toLowerCase();
  for (const [pattern, id] of matching) {
    if (pattern.test(value)) {
      const icon = routineIconById(id);
      if (icon) return icon;
    }
  }
  return null;
}
