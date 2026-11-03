/**
 * Optional v2 soft-color illustration library for Routine Chart only.
 * Never changes hand-drawn artwork, saved icon IDs, or Chore Chart rendering.
 * Only use an icon for a task with a clear semantic match.
 * WebP assets are generated from v2 PNG masters by scripts/prepare-v2-routine-icons.mjs.
 */
const base = '/assets/icons/ofc/v2/routines/';
const available = new Set([
  'adult-and-child-together','apple','basket','bike','blocks','boiled-egg','book-stack',
  'book','breakfast-bowl','calendar','car','carrot','check-look','cheese-wedge',
  'clean-floor','clear-dishes','clothes-in-hamper','coat','comb-hair',
  'conversation-bubbles','cooking-pot','create-explore','dust-furniture',
  'eat-a-snack','eat-breakfast','evening-reset','family-group','feed-pets',
  'fill-water-bottle','free-afternoon','free-play','friend-pair','get-dressed',
  'grocery-shopping','helping-hands','home','homework-and-reading','jump-rope',
  'lay-out-clothes','lightbulb','lunch-reset','morning-start','move-play',
  'paintbrush','plan-the-week','practice-music','prayer-or-gratitude',
  'put-away-clothes','put-away-toys','puzzle-piece','quiet-time-rest','quiet-time',
  'read-a-book','ride-bike','scissors','screens-off','set-table',
  'shoes-and-coat-away','sidewalk-chalk','sort-laundry','spray-bottle-cloth',
  'star','supporting','take-out-trash','tidy-desk','tidy-living-room',
  'tree','unpack-backpack','wake-up','wipe-counter',
]);

const aliases: Record<string, string> = {
  'brush-my-teeth': '', // No approved v2 counterpart in the repo yet
  'pack-my-backpack': '', // pack and unpack are different actions
  'wash-my-hands': '',
  'make-my-bed': '',
  'get-ready-for-bed': '',
  'put-toys-away': 'put-away-toys',
  'put-clothes-away': 'put-away-clothes',
  'tidy-my-desk': 'tidy-desk',
  'clean-my-floor': 'clean-floor',
  'set-the-table': 'set-table',
  'clear-the-table': 'clear-dishes',
  'help-with-laundry': 'sort-laundry',
  'wipe-the-counters': 'wipe-counter',
  'take-out-the-trash': 'take-out-trash',
  'comb-my-hair': 'comb-hair',
  'unpack-backpack': 'unpack-backpack',
};

const byText: Array<[RegExp, string]> = [
  [/\bunpack\b.*\bbackpack\b|\bbackpack\b.*\blunch\s*box\b/i, 'unpack-backpack'],
  [/\bshoes?\b.*\bcoat\b|\bcoat\b.*\bshoes?\b/i, 'shoes-and-coat-away'],
  [/\b(wake\s*up|stretch|morning start)\b/i, 'wake-up'],
  [/\b(get dressed|dress myself|put on clothes)\b/i, 'get-dressed'],
  [/\b(eat|have|family)\s+breakfast\b|\bbreakfast\b/i, 'eat-breakfast'],
  [/\b(eat a )?snack\b|\bsnack time\b/i, 'eat-a-snack'],
  [/\b(homework|schoolwork|reading homework)\b/i, 'homework-and-reading'],
  [/\b(free play|play time|play on my own)\b/i, 'free-play'],
  [/\b(pick up|put away|tidy|organize)\b.*\btoys?\b|\btoys?\b.*\baway\b/i, 'put-away-toys'],
  [/\b(lay out|set out)\b.*\bclothes\b|\btomorrow.s clothes\b/i, 'lay-out-clothes'],
  [/\b(read together|read a book|story time|read for a while)\b/i, 'read-a-book'],
  [/\b(plan the week|plan.*week together|weekly planning|check the calendar)\b/i, 'plan-the-week'],
  [/\b(tidy the house|tidy the living room|tidy living room)\b/i, 'tidy-living-room'],
  [/\b(sort laundry|help with laundry|laundry)\b/i, 'sort-laundry'],
  [/\b(grocery shopping|buy groceries|groceries)\b/i, 'grocery-shopping'],
  [/\b(meal prep|cook dinner|help with dinner)\b/i, 'cooking-pot'],
  [/\b(fill.*water bottle|fill.*water cup)\b/i, 'fill-water-bottle'],
  [/\b(feed.*(pet|dog|cat))\b/i, 'feed-pets'],
  [/\b(wipe.*(counter|worktop)|clean.*counter)\b/i, 'wipe-counter'],
  [/\b(clear.*(dishes|table)|dishes.*(away|sink))\b/i, 'clear-dishes'],
  [/\b(set the table|set table)\b/i, 'set-table'],
  [/\b(take out.*trash|empty.*trash|trash.*out)\b/i, 'take-out-trash'],
  [/\b(comb.*hair|brush.*hair)\b/i, 'comb-hair'],
  [/\b(put away clothes|put clothes away)\b/i, 'put-away-clothes'],
  [/\b(tidy.*desk|clean.*desk)\b/i, 'tidy-desk'],
  [/\b(clean.*floor|vacuum.*floor)\b/i, 'clean-floor'],
  [/\b(dust.*furniture|dusting)\b/i, 'dust-furniture'],
  [/\b(screen.*off|turn off.*screen)\b/i, 'screens-off'],
  [/\b(prayer|pray|gratitude|thankful)\b/i, 'prayer-or-gratitude'],
  [/\b(practice.*(music|instrument|piano|guitar))\b/i, 'practice-music'],
  [/\b(ride.*bike|bike ride|bicycle)\b/i, 'ride-bike'],
  [/\b(quiet time|rest time|nap time)\b/i, 'quiet-time-rest'],
  [/\b(play outside|outdoor play)\b/i, 'move-play'],
  [/\b(family game|play games|board game)\b/i, 'puzzle-piece'],
  [/\b(sweep|mop).*floor\b/i, 'clean-floor'],
  [/\b(shoes and coat away|shoes & coat away)\b/i, 'shoes-and-coat-away'],
];

export function softColorIconFor(text: string, id = ''): string | null {
  // Text first because an old saved ID can remain after the user rewrites a step.
  const found = byText.find(([pattern]) => pattern.test(text))?.[1];
  const slug = found ?? (Object.prototype.hasOwnProperty.call(aliases, id) ? aliases[id] : id);
  return slug && available.has(slug) ? `${base}${slug}.webp` : null;
}
