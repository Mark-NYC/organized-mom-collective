/**
 * The shared responsibility library: the 16 illustrated jobs from the physical Kids' Responsibility Cards,
 * used by the free routine chart (/routine-chart) and chore chart (/chore-chart) as an illustration plus a title.
 *
 * Only the title and the illustration live here, on purpose. The cards' three how-to steps are the physical
 * product and never go on the website (no step text, no card layouts, no card-sized printables).
 *
 * Illustrations: public/images/responsibilities/{id}-{128,256}.webp, made from the originals in
 * design/responsibilities/ by scripts/responsibility-image.py. `image: false` until the original is in the repo;
 * those show as a title without art. Category colors are fixed (not the tool palette) so a job keeps its color
 * on every chart.
 */
export type ResponsibilityCategory = 'myself' | 'room' | 'home';
/** Routine types in src/data/routines.ts a job usually belongs to (suggestion order only). */
export type RoutinePlacement = 'morning' | 'afterschool' | 'bedtime' | 'weekend';

export const responsibilityCategories: Record<ResponsibilityCategory, { label: string; colorName: string; color: string }> = {
  myself: { label: 'Myself & Daily Habits', colorName: 'Soft Leaf Green', color: '#D4DFC4' },
  room: { label: 'My Room', colorName: 'Soft Frost Blue', color: '#CDDDE1' },
  home: { label: 'Helping at Home', colorName: 'Pale Apricot', color: '#F1D8A8' },
};

export interface Responsibility {
  id: string;
  title: string;
  category: ResponsibilityCategory;
  /** True once its web sizes are in public/images/responsibilities/. */
  image: boolean;
  routines: RoutinePlacement[];
  /** Youngest age it's suggested from: a starting point, not a rule. Not shown on the charts. */
  minAge: number;
  /** Other wordings on the starter charts that mean this job (lowercase), so they get the illustration too. */
  aliases?: string[];
}

export const responsibilities: Responsibility[] = [
  { id: 'brush-my-teeth', title: 'Brush My Teeth', category: 'myself', image: true, routines: ['morning', 'bedtime'], minAge: 3 },
  { id: 'get-dressed', title: 'Get Dressed', category: 'myself', image: true, routines: ['morning'], minAge: 3, aliases: ['get dressed independently'] },
  { id: 'wash-my-hands', title: 'Wash My Hands', category: 'myself', image: true, routines: ['afterschool'], minAge: 2 },
  { id: 'pack-my-backpack', title: 'Pack My Backpack', category: 'myself', image: true, routines: ['bedtime', 'morning'], minAge: 4, aliases: ['grab backpack & shoes', 'pack backpack & lunch'] },
  { id: 'get-ready-for-bed', title: 'Get Ready for Bed', category: 'myself', image: true, routines: ['bedtime'], minAge: 3, aliases: ['pajamas on'] },
  { id: 'comb-my-hair', title: 'Comb My Hair', category: 'myself', image: true, routines: ['morning'], minAge: 4, aliases: ['brush hair'] },
  { id: 'make-my-bed', title: 'Make My Bed', category: 'room', image: true, routines: ['morning'], minAge: 4, aliases: ['make bed (with help)', 'help make bed'] },
  { id: 'put-toys-away', title: 'Put Toys Away', category: 'room', image: true, routines: ['bedtime', 'afterschool'], minAge: 2, aliases: ['put away toys', 'pick up toys', 'organize toy bin'] },
  { id: 'put-clothes-away', title: 'Put Clothes Away', category: 'room', image: true, routines: ['bedtime', 'weekend'], minAge: 4 },
  { id: 'tidy-my-desk', title: 'Tidy My Desk', category: 'room', image: true, routines: ['afterschool'], minAge: 5, aliases: ['put away school supplies'] },
  { id: 'clean-my-floor', title: 'Clean My Floor', category: 'room', image: true, routines: ['weekend'], minAge: 5, aliases: ['vacuum bedroom'] },
  { id: 'set-the-table', title: 'Set the Table', category: 'home', image: true, routines: ['afterschool'], minAge: 4 },
  { id: 'clear-the-table', title: 'Clear the Table', category: 'home', image: true, routines: ['bedtime'], minAge: 4, aliases: ['clear dinner table', 'clear table after meals'] },
  { id: 'help-with-laundry', title: 'Help With Laundry', category: 'home', image: true, routines: ['weekend'], minAge: 5, aliases: ['help sort laundry', 'sort laundry by color'] },
  { id: 'wipe-the-counters', title: 'Wipe the Counters', category: 'home', image: true, routines: ['bedtime'], minAge: 6 },
  { id: 'take-out-the-trash', title: 'Take Out the Trash', category: 'home', image: true, routines: ['weekend'], minAge: 7, aliases: ['take trash to curb'] },
];

const byId = new Map(responsibilities.map((r) => [r.id, r]));
export const responsibilityById = (id: string) => byId.get(id);

export const responsibilityColor = (r: Responsibility) => responsibilityCategories[r.category].color;

/** Web path of an illustration, or null while its original isn't in the repo yet. */
export const responsibilityImage = (r: Responsibility, size: 128 | 256) => (r.image ? `/images/responsibilities/${r.id}-${size}.webp` : null);

/** "Brush My Teeth", "brush teeth", "Brush the teeth" → "brush teeth". */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(my|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const byText = new Map<string, string>();
for (const r of responsibilities) for (const t of [r.title, ...(r.aliases ?? [])]) byText.set(normalize(t), r.id);

/** The library job a chart line means, if any: lets starter and typed lines pick up the illustration. */
export const matchResponsibility = (text: string) => byText.get(normalize(text));
