/**
 * Age-based starter chores for the free chore chart (/chore-chart). Starting points only:
 * everything here is editable on the chart before it's downloaded.
 */
export type AgeGroup = '2-3' | '4-5' | '6-7' | '8-10' | '11-13' | '14-16' | '17+';

export interface ChoreSet {
  label: string;
  daily: string[];
  /** One chore per day, Monday first. */
  weekly: string[];
  /** Rewards at 50%, 75% and 100% of the week done. */
  rewards: [string, string, string];
}

/** Rows on the chart; age groups with fewer daily chores leave the rest blank to write in. */
export const DAILY_ROWS = 8;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const choreSets: Record<AgeGroup, ChoreSet> = {
  '2-3': {
    label: 'Ages 2–3 (Toddler)',
    daily: ['Put toys away', 'Put dirty clothes in hamper', 'Wipe up spills', 'Help feed pets', 'Put books back on shelf'],
    weekly: ['Help sort laundry', 'Water plants with help', 'Dust low surfaces', 'Help unload groceries', 'Organize toy bin', 'Help make bed', 'Pick up outdoor toys'],
    rewards: ['Sticker on chart', 'Extra story time', 'Choose tomorrow’s snack'],
  },
  '4-5': {
    label: 'Ages 4–5 (Preschool)',
    daily: ['Make bed (with help)', 'Put away toys', 'Feed pets', 'Clear table after meals', 'Put dirty clothes away', 'Brush teeth', 'Pack backpack'],
    weekly: ['Sort laundry by color', 'Dust furniture', 'Water indoor plants', 'Organize bookshelf', 'Help wash car', 'Vacuum bedroom', 'Lay out school clothes'],
    rewards: ['Small toy or treat', 'Stay up 15 minutes later', 'Pick family movie'],
  },
  '6-7': {
    label: 'Ages 6–7 (Early Elementary)',
    daily: ['Make bed', 'Brush teeth', 'Put clothes away', 'Pack backpack', 'Feed pets', 'Clear dinner table', 'Put away school supplies'],
    weekly: ['Take out trash', 'Clean bathroom sink', 'Vacuum bedroom', 'Dust bedroom furniture', 'Organize closet', 'Help with laundry', 'Get ready for the school week'],
    rewards: ['Extra screen time', 'Choose weekend activity', 'Special treat or outing'],
  },
  '8-10': {
    label: 'Ages 8–10 (Elementary)',
    daily: ['Make bed', 'Brush teeth', 'Get dressed independently', 'Pack backpack & lunch', 'Feed pets', 'Load dishwasher', 'Tidy bedroom', 'Finish homework'],
    weekly: ['Take trash to curb', 'Clean bathroom', 'Vacuum living areas', 'Dust all furniture', 'Change bed sheets', 'Do own laundry', 'Help with meal prep'],
    rewards: ['Friend playdate', '$2 allowance', 'Choose family dinner'],
  },
  '11-13': {
    label: 'Ages 11–13 (Middle School)',
    daily: ['Make bed', 'Personal hygiene routine', 'Pack school materials', 'Feed & walk pets', 'Load/unload dishwasher', 'Keep room organized', 'Finish homework', 'Lay out next day’s clothes'],
    weekly: ['Handle all trash duties', 'Deep clean bathroom', 'Vacuum entire house', 'Dust & tidy common areas', 'Change all bed linens', 'Do a full laundry load', 'Help with meal planning'],
    rewards: ['Movie with friends', '$5 allowance', 'Later bedtime on the weekend'],
  },
  '14-16': {
    label: 'Ages 14–16 (High School)',
    daily: ['Morning routine', 'Manage school materials', 'Pet care', 'Kitchen cleanup after meals', 'Keep room tidy', 'Homework & study time', 'Prep for tomorrow', 'Help with family dinner'],
    weekly: ['Manage household trash', 'Deep clean assigned bathroom', 'Vacuum & mop floors', 'Dust entire house', 'Family laundry', 'Help with grocery shopping', 'Meal prep for the week'],
    rewards: ['Extra phone time', '$10 allowance', 'Car privileges'],
  },
  '17+': {
    label: 'Ages 17+ (Young Adult)',
    daily: ['Personal care routine', 'School/work responsibilities', 'Pet care & exercise', 'Kitchen cleanup', 'Keep living space tidy', 'Plan & prep a meal', 'Manage own schedule', 'One task for the family'],
    weekly: ['Coordinate household tasks', 'Deep clean & organize a space', 'Floors: vacuum & mop', 'Bathrooms & kitchen clean', 'Laundry start to finish', 'Shop & budget for groceries', 'Plan & prep family meals'],
    rewards: ['Gas money', '$20 allowance', 'Extended curfew'],
  },
};

/**
 * "Start with one job": a single job someone this age can own start to finish, instead of a full week of chores
 * (the Organized Family Club opens the chart this way). Children's jobs use the picture library's titles, so they
 * print with their illustration. Rewards are left for the family to decide.
 */
export const oneJobs: Record<AgeGroup, string> = {
  '2-3': 'Put Toys Away',
  '4-5': 'Set the Table',
  '6-7': 'Clear the Table',
  '8-10': 'Wipe the Counters',
  '11-13': 'Take Out the Trash',
  '14-16': 'Kitchen cleanup after dinner',
  '17+': 'Plan and cook one family dinner',
};
/** A grown-up's one job: a whole job, not a hand with one. */
export const adultOneJob = 'Grocery list and shopping';

/** The starter set for a child's age: the youngest group starts at 2 and covers anyone younger. */
export function ageGroupFor(age: number): AgeGroup {
  if (age <= 3) return '2-3';
  if (age <= 5) return '4-5';
  if (age <= 7) return '6-7';
  if (age <= 10) return '8-10';
  if (age <= 13) return '11-13';
  if (age <= 16) return '14-16';
  return '17+';
}
