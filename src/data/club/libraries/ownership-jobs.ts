/**
 * The Family Ownership Builder's job library (November kit, and later kits that reuse it).
 *
 * Three sources, one list:
 * 1. Every illustrated job in src/data/responsibilities.ts (the Kids' Responsibility Cards). Each card becomes an
 *    item automatically: `cardRules` refines the ones we've thought through, and any card added to that library
 *    later gets sensible defaults from its category and starting age, so it shows up without touching this file.
 *    Only the card's id, title, category and starting age are used, never its how-to steps.
 * 2. Family jobs without a card, worded from src/data/chores-by-age.ts (no illustration).
 * 3. Whole jobs for teens and adults: owned start to finish, including noticing they need doing. Never "help Mom".
 *
 * Ages are starting points, not rules; the parent can assign anything to anyone.
 */
import { responsibilities, type Responsibility, type ResponsibilityCategory } from '../../responsibilities';
import type { ChartSection, KitItem } from '../types';

type CardRule = Partial<Omit<KitItem, 'id' | 'illustration'>>;

const SECTION: Record<ResponsibilityCategory, ChartSection> = { myself: 'self', room: 'space', home: 'family' };

/** Ownership grows with practice: learning at the card's starting age, checked two years on, theirs two years after. */
const ladder = (from: number): KitItem['levels'] => [[from, 'learning'], [from + 2, 'with-check'], [from + 4, 'owns']];

/** Card refinements. Anything not listed falls back to defaultsFor(). */
const cardRules: Record<string, CardRule> = {
  'brush-my-teeth': { title: 'Brush my teeth', doneMeans: 'Morning and night, without a reminder.', maxAge: 8, levels: [[3, 'learning'], [5, 'with-check'], [7, 'owns']] },
  'get-dressed': { title: 'Get dressed', doneMeans: 'Dressed and ready before breakfast.', maxAge: 8, levels: [[3, 'learning'], [5, 'with-check'], [6, 'owns']] },
  'wash-my-hands': { title: 'Wash my hands', doneMeans: 'Before meals and after coming home, with soap.', maxAge: 6, levels: [[2, 'learning'], [4, 'owns']] },
  'pack-my-backpack': { title: 'Pack my backpack', doneMeans: 'Packed the night before and waiting by the door.', frequency: 'weekdays', maxAge: 17, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']] },
  'get-ready-for-bed': { title: 'Get ready for bed', doneMeans: 'Pajamas on, teeth brushed, clothes in the hamper.', maxAge: 8 },
  'comb-my-hair': { title: 'Comb my hair', doneMeans: 'Brushed before school.', maxAge: 8 },
  'make-my-bed': { title: 'Make my bed', doneMeans: 'Covers up and pillow back before breakfast.', levels: [[4, 'learning'], [6, 'owns']] },
  'put-toys-away': { title: 'Put my toys away', doneMeans: 'Toys back in their bins before dinner or bed.', maxAge: 10, levels: [[2, 'learning'], [4, 'with-check'], [6, 'owns']] },
  'put-clothes-away': { title: 'Put my clean clothes away', doneMeans: 'Clean clothes in drawers the day they come out of the laundry.', frequency: 'weekly', levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']] },
  'tidy-my-desk': { title: 'Tidy my desk', doneMeans: 'School things back in their place after homework.', frequency: 'weekdays' },
  'clean-my-floor': { title: 'Clear and sweep my floor', doneMeans: 'Nothing on the floor and swept, once a week.', frequency: 'weekly' },
  'help-with-laundry': {
    title: 'My own laundry: fold and put away',
    doneMeans: 'Their clean basket is folded and in drawers the same day.',
    section: 'space', scope: 'each', for: 'child', minAge: 6, frequency: 'weekly', effort: 2,
    levels: [[6, 'learning'], [8, 'with-check'], [10, 'owns']],
  },
  'set-the-table': { title: 'Set the table for dinner', doneMeans: 'Plates, cups and forks out before dinner is served, without being asked.', core: true, frequency: 'daily', effort: 2, levels: [[4, 'learning'], [5, 'with-check'], [7, 'owns']] },
  'clear-the-table': { title: 'Clear the table after dinner', doneMeans: 'Table empty and wiped after dinner.', core: true, frequency: 'daily', effort: 2, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']] },
  'wipe-the-counters': { title: 'Wipe the kitchen counters', doneMeans: 'Counters clear and wiped after dinner.', core: true, frequency: 'daily', effort: 2, levels: [[6, 'learning'], [8, 'with-check'], [10, 'owns']] },
  'take-out-the-trash': {
    title: 'Trash and recycling, including pickup day',
    doneMeans: 'Small bins emptied, bags out and cans at the curb on pickup day, without a reminder.',
    core: true, frequency: 'weekly', effort: 2, levels: [[7, 'learning'], [9, 'with-check'], [11, 'owns']],
  },
};

/** What a card means when nobody has written a rule for it yet. */
function defaultsFor(card: Responsibility): Omit<KitItem, 'id' | 'title' | 'illustration'> {
  const section = SECTION[card.category];
  return {
    doneMeans: 'Done without a reminder.',
    for: section === 'family' ? 'anyone' : 'child',
    minAge: card.minAge,
    ...(section === 'self' ? { maxAge: 8 } : {}),
    levels: ladder(card.minAge),
    frequency: section === 'self' ? 'daily' : 'weekly',
    effort: section === 'family' ? 2 : 1,
    section,
    scope: section === 'family' ? 'household' : 'each',
  };
}

/** Every card in the library as an item. Exported for tests (they pass a library with an extra card). */
export function cardItems(library: readonly Responsibility[] = responsibilities): KitItem[] {
  return library.map((card) => {
    const rule = cardRules[card.id] ?? {};
    const base = defaultsFor(card);
    return { ...base, title: card.title, ...rule, id: card.id, illustration: card.id } as KitItem;
  });
}

/** Family jobs without a card (wording from src/data/chores-by-age.ts). */
export const familyJobs: KitItem[] = [
  { id: 'feed-the-pet', title: 'Feed the pet', doneMeans: 'Food and fresh water, morning and evening.', for: 'anyone', minAge: 5, levels: [[5, 'learning'], [7, 'with-check'], [9, 'owns']], frequency: 'daily', effort: 1, section: 'family', scope: 'household', core: true, requires: { pets: true } },
  { id: 'shoes-and-coats', title: 'Entry: shoes and coats put away', doneMeans: 'Every shoe on the rack and coat on its hook by dinner.', for: 'anyone', minAge: 4, levels: [[4, 'learning'], [6, 'owns']], frequency: 'daily', effort: 1, section: 'family', scope: 'household' },
  { id: 'empty-the-dishwasher', title: 'Empty the dishwasher', doneMeans: 'Clean dishes put away before breakfast, so dirty ones go straight in.', for: 'anyone', minAge: 7, levels: [[7, 'with-check'], [9, 'owns']], frequency: 'daily', effort: 2, section: 'family', scope: 'household', core: true },
  { id: 'load-the-dishwasher', title: 'Load the dishwasher and start it', doneMeans: 'Sink empty and dishwasher running before bed.', for: 'anyone', minAge: 8, levels: [[8, 'with-check'], [10, 'owns']], frequency: 'daily', effort: 2, section: 'family', scope: 'household', core: true },
  { id: 'put-groceries-away', title: 'Put the groceries away', doneMeans: 'Bags unpacked and folded the day they come home.', for: 'anyone', minAge: 5, levels: [[5, 'learning'], [7, 'with-check'], [9, 'owns']], frequency: 'weekly', effort: 2, section: 'family', scope: 'household' },
  { id: 'water-the-plants', title: 'Water the plants', doneMeans: 'Every plant watered on its day.', for: 'anyone', minAge: 4, levels: [[4, 'learning'], [6, 'owns']], frequency: 'weekly', effort: 1, section: 'family', scope: 'household' },
  { id: 'wipe-the-bathroom-sink', title: 'Wipe the bathroom sink and mirror', doneMeans: 'Sink, counter and mirror clean once a week.', for: 'anyone', minAge: 8, levels: [[8, 'with-check'], [10, 'owns']], frequency: 'weekly', effort: 2, section: 'family', scope: 'household', excludes: ['clean-the-bathroom'] },
  { id: 'vacuum-the-living-room', title: 'Vacuum the living room', doneMeans: 'Floor cleared and vacuumed once a week.', for: 'anyone', minAge: 9, levels: [[9, 'with-check'], [11, 'owns']], frequency: 'weekly', effort: 3, section: 'family', scope: 'household', excludes: ['floors'] },
];

/** Teens and adults: whole jobs, owned from noticing to finished. */
export const wholeJobs: KitItem[] = [
  { id: 'close-the-kitchen', title: 'Close the kitchen each night', doneMeans: 'Dishes done, counters clear, dishwasher running. Nobody else has to check.', for: 'anyone', minAge: 12, levels: [[12, 'with-check'], [14, 'owns']], frequency: 'daily', effort: 3, section: 'family', scope: 'household', excludes: ['load-the-dishwasher', 'wipe-the-counters'] },
  { id: 'cook-one-dinner', title: 'Dinner one night a week, start to finish', doneMeans: 'Picks the meal, checks the ingredients, cooks it and cleans up.', for: 'anyone', minAge: 13, levels: [[13, 'with-check'], [15, 'owns']], frequency: 'weekly', effort: 4, section: 'family', scope: 'household' },
  { id: 'clean-the-bathroom', title: 'Clean a bathroom, weekly', doneMeans: 'Toilet, tub, sink, mirror and floor, once a week.', for: 'anyone', minAge: 11, levels: [[11, 'with-check'], [13, 'owns']], frequency: 'weekly', effort: 3, section: 'family', scope: 'household', core: true },
  { id: 'floors', title: 'Floors: vacuum and mop the main rooms', doneMeans: 'Main rooms vacuumed and the kitchen mopped once a week.', for: 'anyone', minAge: 12, levels: [[12, 'with-check'], [14, 'owns']], frequency: 'weekly', effort: 3, section: 'family', scope: 'household' },
  { id: 'dinner-two-nights', title: 'Dinner two weeknights, start to finish', doneMeans: 'Plans the meals, makes sure the food is in, cooks, and the kitchen is closed after.', for: 'adult', frequency: 'twice-weekly', effort: 5, section: 'family', scope: 'household', core: true },
  { id: 'groceries', title: 'Groceries: keep the list, shop, restock', doneMeans: 'The list lives in one place, the shopping gets done, nobody runs out of the basics.', for: 'adult', frequency: 'weekly', effort: 4, section: 'family', scope: 'household', core: true },
  { id: 'family-laundry', title: 'Family laundry, start to finish', doneMeans: 'Washed, dried and back in each person’s basket, every week.', for: 'adult', frequency: 'weekly', effort: 4, section: 'family', scope: 'household', core: true, illustration: 'help-with-laundry' },
  { id: 'family-calendar', title: 'The family calendar: add it, check it Sunday', doneMeans: 'Every event goes on the calendar, and the week gets a look every Sunday.', for: 'adult', frequency: 'weekly', effort: 3, section: 'family', scope: 'household', core: true },
  { id: 'school-paperwork', title: 'School papers: read, sign, return', doneMeans: 'Forms signed and back in the backpack the night they come home.', for: 'adult', frequency: 'weekly', effort: 3, section: 'family', scope: 'household', core: true },
  { id: 'appointments', title: 'Doctor and dentist visits: book, go, follow up', doneMeans: 'Checkups booked on time, kept, and anything after them handled.', for: 'adult', frequency: 'as-needed', effort: 2, section: 'family', scope: 'household', core: true },
  { id: 'birthday-parties', title: 'Kids’ birthday parties: RSVP, gift, getting there', doneMeans: 'Answered, a gift picked, and a ride planned.', for: 'adult', frequency: 'as-needed', effort: 2, section: 'family', scope: 'household' },
  { id: 'bills', title: 'Household bills: pay on time', doneMeans: 'Due dates tracked and paid without a late notice.', for: 'adult', frequency: 'as-needed', effort: 2, section: 'family', scope: 'household', core: true },
];

/** The whole library, cards first (their order is the order personal jobs fill a row). */
export const ownershipJobs = (library: readonly Responsibility[] = responsibilities): KitItem[] => [...cardItems(library), ...familyJobs, ...wholeJobs];
