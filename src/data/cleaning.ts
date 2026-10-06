/**
 * Cleaning program content.
 *
 * Edit tasks, times and the monthly rotation here — the UI reads everything
 * from this file. Each task has a stable `id` used to remember checkbox state
 * in the browser. If you reword a task, keep its id; if you replace a task
 * with something different, give it a new id.
 *
 * Month colors live in src/theme.ts.
 * Zone icons live in public/icons/zones/ (source artwork in design/zone-icons/).
 */

export interface Task {
  id: string;
  label: string;
}

export interface DailyEssentials {
  title: string;
  icon: string;
  minutes: string;
  description: string;
  tasks: Task[];
}

export interface WeekdayFocus {
  /** 1 = Monday … 4 = Thursday (JS Date#getDay numbering) */
  day: 1 | 2 | 3 | 4;
  dayLabel: string;
  shortLabel: string;
  /** Cleaning tag label — matches the printed calendar exactly */
  zone: string;
  icon: string;
  minutes: string;
  description: string;
  tasks: Task[];
}

export interface MonthlyFocus {
  /** 0 = January … 11 = December (JS Date#getMonth numbering) */
  month: number;
  name: string;
  title: string;
  description: string;
  tasks: Task[];
}

export const dailyEssentials: DailyEssentials = {
  title: 'Daily Reset',
  icon: '/icons/zones/daily.png',
  minutes: '15 minutes',
  description: 'A few small things that keep the house from getting away from you.',
  tasks: [
    { id: 'beds', label: 'Make beds' },
    { id: 'dishwasher', label: 'Load or unload the dishwasher' },
    { id: 'counters', label: 'Clear kitchen counters and table' },
    { id: 'pickup', label: 'Quick pickup of main living areas' },
    { id: 'spills', label: 'Wipe obvious spills and messes' },
  ],
};

export const weeklySchedule: WeekdayFocus[] = [
  {
    day: 1,
    dayLabel: 'Monday',
    shortLabel: 'Mon',
    zone: 'Living Room',
    icon: '/icons/zones/living-room.png',
    minutes: '10 minutes',
    description: 'Start the week with a calm main space.',
    tasks: [
      { id: 'mon-items', label: 'Put items back where they belong' },
      { id: 'mon-surfaces', label: 'Clear surfaces' },
      { id: 'mon-dust', label: 'Dust obvious surfaces' },
      { id: 'mon-pillows', label: 'Straighten blankets and pillows' },
      { id: 'mon-vacuum', label: 'Quick vacuum or sweep if needed' },
    ],
  },
  {
    day: 2,
    dayLabel: 'Tuesday',
    shortLabel: 'Tue',
    zone: 'Bedrooms',
    icon: '/icons/zones/bedroom.png',
    minutes: '10 minutes',
    description: 'A peaceful room to end the day in.',
    tasks: [
      { id: 'tue-clothes', label: 'Clear clothes from floor and chairs' },
      { id: 'tue-loose', label: 'Put away loose items' },
      { id: 'tue-nightstands', label: 'Clear nightstands' },
      { id: 'tue-bedding', label: 'Straighten bedding' },
      { id: 'tue-vacuum', label: 'Quick vacuum or sweep if needed' },
    ],
  },
  {
    day: 3,
    dayLabel: 'Wednesday',
    shortLabel: 'Wed',
    zone: 'Entry/Bathroom',
    icon: '/icons/zones/bathroom.png',
    minutes: '10–15 minutes',
    description: 'A midweek refresh for the busiest spots.',
    tasks: [
      { id: 'wed-entry', label: 'Clear entry clutter' },
      { id: 'wed-shoes', label: 'Put shoes, coats and bags away' },
      { id: 'wed-counters', label: 'Wipe bathroom counters' },
      { id: 'wed-sink', label: 'Wipe sink' },
      { id: 'wed-toilet', label: 'Clean toilet' },
      { id: 'wed-towels', label: 'Replace towels if needed' },
      { id: 'wed-trash', label: 'Empty bathroom trash' },
      { id: 'wed-sweep', label: 'Quick sweep' },
    ],
  },
  {
    day: 4,
    dayLabel: 'Thursday',
    shortLabel: 'Thu',
    zone: 'Kitchen Reset',
    icon: '/icons/zones/kitchen.png',
    minutes: '15 minutes',
    description: 'Reset the heart of the home before the weekend.',
    tasks: [
      { id: 'thu-clear', label: 'Clear counters' },
      { id: 'thu-wipe', label: 'Wipe counters' },
      { id: 'thu-sink', label: 'Clean sink' },
      { id: 'thu-fridge', label: 'Check fridge for old food' },
      { id: 'thu-appliances', label: 'Wipe appliance fronts' },
      { id: 'thu-floor', label: 'Sweep floor' },
      { id: 'thu-reset', label: 'Reset anything that piled up this week' },
    ],
  },
];

export interface WeekendDay {
  /** 5 = Friday, 6 = Saturday, 0 = Sunday (JS Date#getDay numbering) */
  day: 5 | 6 | 0;
  dayLabel: string;
  shortLabel: string;
  /** Cleaning tag label — matches the printed calendar exactly */
  zone: string;
}

/** Friday–Sunday: flexible days built around the month's deep-clean project. */
export const weekend = {
  icon: '/icons/zones/deep-clean.png',
  days: [
    { day: 5, dayLabel: 'Friday', shortLabel: 'Fri', zone: 'Deep Cleaning' },
    { day: 6, dayLabel: 'Saturday', shortLabel: 'Sat', zone: 'Home Project' },
    { day: 0, dayLabel: 'Sunday', shortLabel: 'Sun', zone: 'Catch-Up / Reset' },
  ] as WeekendDay[],
  description:
    'Use the weekend for one deep-cleaning task, a seasonal project, or catching up on the week. All optional.',
  catchUp: { id: 'catch-up', label: 'Catch up on this week’s cleaning instead' } as Task,
};

export const monthlyDeepClean: MonthlyFocus[] = [
  {
    month: 0,
    name: 'January',
    title: 'Kitchen Reset',
    description: 'A fresh start for the room you use most.',
    tasks: [
      { id: 'jan-pantry', label: 'Clear out expired pantry items' },
      { id: 'jan-fridge', label: 'Empty and wipe down the fridge' },
      { id: 'jan-drawer', label: 'Declutter one kitchen drawer' },
      { id: 'jan-small-appliances', label: 'Clean the microwave and toaster' },
      { id: 'jan-cabinets', label: 'Wipe cabinet fronts and handles' },
    ],
  },
  {
    month: 1,
    name: 'February',
    title: 'Bedrooms + Closets',
    description: 'Quieter rooms for the middle of winter.',
    tasks: [
      { id: 'feb-mattress', label: 'Rotate or vacuum mattresses' },
      { id: 'feb-pillows', label: 'Wash pillows and duvets' },
      { id: 'feb-under-bed', label: 'Clear out under the beds' },
      { id: 'feb-closet', label: 'Pull clothes no one wears' },
      { id: 'feb-dressers', label: 'Tidy one dresser at a time' },
    ],
  },
  {
    month: 2,
    name: 'March',
    title: 'Spring Prep',
    description: 'Let a little more light in.',
    tasks: [
      { id: 'mar-baseboards', label: 'Wipe baseboards in main rooms' },
      { id: 'mar-vents', label: 'Dust vents and ceiling fans' },
      { id: 'mar-winter-gear', label: 'Pack away winter gear you’re done with' },
      { id: 'mar-curtains', label: 'Wash or shake out curtains' },
      { id: 'mar-donate', label: 'Fill one donation bag' },
    ],
  },
  {
    month: 3,
    name: 'April',
    title: 'Windows + Entry',
    description: 'A welcoming way in and clearer views out.',
    tasks: [
      { id: 'apr-windows', label: 'Wash inside windows' },
      { id: 'apr-sills', label: 'Wipe window sills and tracks' },
      { id: 'apr-door', label: 'Clean the front door and handle' },
      { id: 'apr-mat', label: 'Shake out or replace the doormat' },
      { id: 'apr-shoes', label: 'Sort the shoe pile' },
    ],
  },
  {
    month: 4,
    name: 'May',
    title: 'Living Areas',
    description: 'Comfortable spaces for longer evenings.',
    tasks: [
      { id: 'may-cushions', label: 'Vacuum under sofa cushions' },
      { id: 'may-shelves', label: 'Declutter one bookshelf or shelf' },
      { id: 'may-electronics', label: 'Dust electronics and cords' },
      { id: 'may-throws', label: 'Wash throw blankets and pillow covers' },
      { id: 'may-toys', label: 'Sort toys and games' },
    ],
  },
  {
    month: 5,
    name: 'June',
    title: 'Outdoor / Summer Prep',
    description: 'Get ready to spend more time outside.',
    tasks: [
      { id: 'jun-furniture', label: 'Wipe down outdoor furniture' },
      { id: 'jun-porch', label: 'Sweep porch or patio' },
      { id: 'jun-garage', label: 'Clear one corner of the garage' },
      { id: 'jun-summer-bin', label: 'Gather sunscreen, towels and summer gear' },
      { id: 'jun-car', label: 'Clean out the car' },
    ],
  },
  {
    month: 6,
    name: 'July',
    title: 'Kitchen Deep Clean',
    description: 'The midyear kitchen refresh.',
    tasks: [
      { id: 'jul-oven', label: 'Clean the oven' },
      { id: 'jul-range-hood', label: 'Degrease the range hood and filter' },
      { id: 'jul-dishwasher', label: 'Clean the dishwasher filter' },
      { id: 'jul-spices', label: 'Sort the spice cabinet' },
      { id: 'jul-containers', label: 'Match food container lids' },
    ],
  },
  {
    month: 7,
    name: 'August',
    title: 'Bedrooms + Back-to-School',
    description: 'Set the kids up for a calmer fall.',
    tasks: [
      { id: 'aug-outgrown', label: 'Pull outgrown clothes' },
      { id: 'aug-desk', label: 'Set up a homework spot' },
      { id: 'aug-supplies', label: 'Sort school supplies' },
      { id: 'aug-backpacks', label: 'Create a backpack drop zone' },
      { id: 'aug-bedding', label: 'Wash kids’ bedding' },
    ],
  },
  {
    month: 8,
    name: 'September',
    title: 'Entry + Storage',
    description: 'Make the everyday comings and goings easier.',
    tasks: [
      { id: 'sep-hooks', label: 'Clear and reorganize entry hooks' },
      { id: 'sep-bins', label: 'Label or reset storage bins' },
      { id: 'sep-coat-closet', label: 'Sort the coat closet' },
      { id: 'sep-linen', label: 'Fold and edit the linen closet' },
      { id: 'sep-papers', label: 'Purge old papers and mail' },
    ],
  },
  {
    month: 9,
    name: 'October',
    title: 'Closet Cleanout',
    description: 'Make room before the cold-weather swap.',
    tasks: [
      { id: 'oct-unworn', label: 'Remove clothes you no longer wear' },
      { id: 'oct-shelf', label: 'Organize one closet shelf' },
      { id: 'oct-shoes', label: 'Sort shoes' },
      { id: 'oct-donate', label: 'Donate unused items' },
      { id: 'oct-seasonal', label: 'Swap summer clothes for fall' },
    ],
  },
  {
    month: 10,
    name: 'November',
    title: 'Kitchen + Hosting Prep',
    description: 'Get ready to gather.',
    tasks: [
      { id: 'nov-fridge', label: 'Clear space in the fridge and freezer' },
      { id: 'nov-serving', label: 'Find and wash serving dishes' },
      { id: 'nov-guest', label: 'Refresh guest towels and bedding' },
      { id: 'nov-table', label: 'Polish the dining table and chairs' },
      { id: 'nov-pantry', label: 'Restock pantry basics' },
    ],
  },
  {
    month: 11,
    name: 'December',
    title: 'Holiday Reset + Declutter',
    description: 'Make room for what matters.',
    tasks: [
      { id: 'dec-toys', label: 'Clear old toys before new ones arrive' },
      { id: 'dec-decor', label: 'Sort holiday decor — keep what you love' },
      { id: 'dec-wrap', label: 'Set up a simple wrapping station' },
      { id: 'dec-entry', label: 'Reset the entry for guests' },
      { id: 'dec-donate', label: 'Drop off a donation bag' },
    ],
  },
];
