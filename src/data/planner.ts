/**
 * The Weekly Planner Generator: a free planner at /planner, and the upgraded one (the same
 * planner plus one-tap example weeks) for Take Back Control buyers at PLANNER_PLUS_PATH.
 *
 * The upgraded page is unlisted, not locked: noindex, out of the sitemap, linked only from a
 * Take Back Control buyer's download page. Anyone with the link can open it. To change the link
 * (if it gets passed around), change PLANNER_PLUS_PATH; buyers' download pages pick it up.
 *
 * Both use src/components/site/WeeklyPlanner.astro (the original design) and save in this browser only.
 */

export const PLANNER_PLUS_PATH = '/planner/plus-r7k2m9';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** An example week: fills everything except "Week of". Lists are one item per line. */
export interface PlannerPreset {
  id: string;
  label: string;
  /** One line under the button. */
  hint: string;
  data: {
    /** What's happening each day, Monday first. */
    days: string[];
    /** Dinner each day, Monday first. */
    meals: string[];
    selfCare: string;
    word: string;
    family: string;
    grateful: string;
    groceries: string;
    todo: string;
    notes: string;
  };
}

/** A preset as the planner's `data-field` values (WeeklyPlanner.astro): 2 self-care, 2 family, 6 to-do lines. */
export function presetFields({ data: d }: PlannerPreset): Record<string, string> {
  const items = (prefix: string, text: string, n: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, text.split('\n')[i] ?? '']));
  return {
    ...Object.fromEntries(DAYS.map((day, i) => [`day-${day}`, d.days[i] ?? ''])),
    ...Object.fromEntries(DAYS.map((day, i) => [`menu-${day}`, d.meals[i] ?? ''])),
    ...items('selfcare', d.selfCare, 2),
    ...items('family', d.family, 2),
    ...items('todo', d.todo, 6),
    word: d.word,
    prayers: d.grateful,
    groceries: d.groceries,
    notes: d.notes,
  };
}

const lines = (...l: string[]) => l.join('\n');

export const plannerPresets: PlannerPreset[] = [
  {
    id: 'back-to-school',
    label: 'Back to School',
    hint: 'New routines, early mornings, paperwork',
    data: {
      days: [
        lines('First full week: alarms 30 min earlier', 'Backpacks by the door tonight'),
        lines('Sign & return school forms', 'Pack lunches after dinner'),
        lines('Library day: books in bags', 'Early bedtime'),
        lines('Check the school email/app', 'Lay out Friday clothes'),
        lines('Pizza night', 'Look over the week’s papers together'),
        lines('Supply top-up run', 'Family bike ride'),
        lines('Weekly reset: menu, groceries, calendar', 'Pick out next week’s outfits'),
      ],
      meals: ['Sheet-pan chicken & veggies', 'Tacos', 'Pasta with meat sauce', 'Slow-cooker chili', 'Homemade pizza', 'Grilled burgers', 'Breakfast for dinner'],
      selfCare: lines('Coffee before the kids wake up', '10-minute walk after drop-off'),
      word: 'Rhythm',
      family: lines('Text the carpool group', 'Thank-you note for the teacher'),
      grateful: lines('A smooth first morning', 'Kids excited to see friends'),
      groceries: lines('Lunchbox snacks', 'Bread & sandwich fillings', 'Fruit for lunches', 'Tortillas', 'Ground beef', 'Pasta & sauce', 'Eggs', 'Milk'),
      todo: lines('Label water bottles & lunchboxes', 'Add school dates to the calendar', 'Set up a homework spot', 'Order missing supplies'),
      notes: 'Keep mornings simple: same breakfast all week, clothes picked the night before.',
    },
  },
  {
    id: 'summer-break',
    label: 'Summer Break',
    hint: 'Kids home all day, loose structure',
    data: {
      days: [
        lines('Pool in the morning', 'Quiet reading hour after lunch'),
        lines('Library summer reading', 'Playdate at the park'),
        lines('Chore chart + popsicles', 'Water balloons in the yard'),
        lines('Day trip / splash pad', 'Easy dinner'),
        lines('Movie night', 'Pick next week’s outing'),
        lines('Farmers market', 'Family game afternoon'),
        lines('Weekly reset: menu, groceries, calendar', 'Laundry & towels'),
      ],
      meals: ['Grilled chicken salads', 'Hot dogs & corn', 'Pasta salad', 'Burrito bowls', 'Pizza & movie', 'Burgers on the grill', 'Breakfast for dinner'],
      selfCare: lines('Read on the porch at nap/quiet time', 'One evening walk alone'),
      word: 'Slow',
      family: lines('Plan a cousin day', 'Call Grandma'),
      grateful: lines('Long evenings outside', 'No school-morning rush'),
      groceries: lines('Sunscreen', 'Popsicles', 'Watermelon', 'Hot dog buns', 'Corn on the cob', 'Lemonade', 'Picnic snacks', 'Burger buns'),
      todo: lines('Pack the pool bag', 'Sign up for summer reading', 'Make a rainy-day activity list', 'Book a sitter for date night'),
      notes: 'One planned outing a day is plenty. Quiet hour after lunch, every day.',
    },
  },
  {
    id: 'holiday-season',
    label: 'Holiday Season',
    hint: 'Events, gifts, travel, extra cooking',
    data: {
      days: [
        lines('Gift list check', 'Order online gifts today'),
        lines('School concert 6 pm', 'Wrap 3 gifts'),
        lines('Bake cookies for the teachers', 'Mail cards'),
        lines('Office party (sitter booked)', 'Easy dinner'),
        lines('Look at holiday lights', 'Hot cocoa'),
        lines('Family photo', 'Grocery run for the big meal'),
        lines('Prep make-ahead dishes', 'Weekly reset: menu, groceries, calendar'),
      ],
      meals: ['Soup & grilled cheese', 'Slow-cooker pot roast', 'Leftovers', 'Kids: frozen pizza', 'Chili', 'Takeout', 'Holiday dinner'],
      selfCare: lines('Say no to one extra thing', 'Early night after the party'),
      word: 'Enough',
      family: lines('Confirm who’s hosting', 'Video call with far-away family'),
      grateful: lines('Kids’ excitement', 'Time together'),
      groceries: lines('Baking supplies', 'Wrapping paper & tape', 'Stamps', 'Cocoa & marshmallows', 'Roast', 'Potatoes', 'Rolls', 'Cranberry sauce'),
      todo: lines('Finish the gift list', 'Teacher gifts', 'Holiday cards', 'Plan the big meal'),
      notes: 'Keep one evening this week with nothing planned.',
    },
  },
  {
    id: 'sick-week',
    label: 'Sick Week',
    hint: 'Survival mode: only the essentials',
    data: {
      days: [
        lines('Call the pediatrician', 'Email the school'),
        lines('Rest day', 'Fluids & movies'),
        lines('Reschedule non-urgent plans', 'Wipe down handles & remotes'),
        lines('Check in on how everyone feels', 'Sheets in the wash'),
        lines('Back to school? Decide by tonight', 'Easy dinner'),
        lines('Quiet day at home', 'Short walk if everyone’s up for it'),
        lines('Light reset: groceries & calendar only'),
      ],
      meals: ['Chicken noodle soup', 'Toast & scrambled eggs', 'Rice & broth', 'Grilled cheese & tomato soup', 'Freezer meal', 'Leftovers', 'Whatever’s easiest'],
      selfCare: lines('Lower the bar: dishes can wait', 'Sleep when they sleep'),
      word: 'Gentle',
      family: lines('Ask a friend for a grocery drop-off', 'Update the carpool'),
      grateful: lines('Cozy movie days', 'Help from friends'),
      groceries: lines('Electrolyte drinks', 'Crackers', 'Soup', 'Bananas', 'Applesauce', 'Tissues', 'Fever reducer', 'Bread'),
      todo: lines('Cancel/move appointments', 'Keep track of meds & times', 'Disinfect high-touch spots', 'Restock the medicine cabinet'),
      notes: 'This week the goal is rest. Everything else can move to next week.',
    },
  },
  {
    id: 'sports-season',
    label: 'Sports Season',
    hint: 'Practices, games, dinners on the go',
    data: {
      days: [
        lines('Practice 5:30–7', 'Crock-pot dinner'),
        lines('Homework before practice', 'Wash uniforms'),
        lines('Practice 5:30–7', 'Pack the sports bag tonight'),
        lines('Free night: family dinner at home'),
        lines('Game 6 pm', 'Snacks for the team'),
        lines('Tournament 9 am', 'Cooler & chairs in the car'),
        lines('Rest', 'Weekly reset: menu, groceries, calendar'),
      ],
      meals: ['Slow-cooker pulled pork', 'Wraps to go', 'Pasta bake (make ahead)', 'Family dinner: tacos', 'Post-game pizza', 'Sandwiches at the field', 'Sheet-pan sausage & veggies'],
      selfCare: lines('Podcast during practice pickup', 'Bring a book to the game'),
      word: 'Teamwork',
      family: lines('Set up the carpool rotation', 'Sit with the other parents'),
      grateful: lines('Kids learning to win and lose', 'Fresh air at the field'),
      groceries: lines('Team snacks', 'Water bottles', 'Granola bars', 'Tortillas & deli meat', 'Pork shoulder', 'Pasta & cheese', 'Fruit', 'Sports drink'),
      todo: lines('Add the full season schedule to the calendar', 'Pay team fees', 'Check uniform sizes', 'Keep a car kit: chairs, sunscreen, snacks'),
      notes: 'Make-ahead dinners on practice nights. Sports bag gets packed the night before.',
    },
  },
  {
    id: 'spring-reset',
    label: 'Spring Reset',
    hint: 'Declutter, closets, a fresh start',
    data: {
      days: [
        lines('15 min: kitchen counters & pantry'),
        lines('15 min: kids swap winter clothes out'),
        lines('15 min: entryway & shoes'),
        lines('15 min: bathroom cabinet'),
        lines('Donation bags in the car', 'Pizza night'),
        lines('Garden / yard together', 'Donation drop-off'),
        lines('Weekly reset: menu, groceries, calendar', 'Open the windows'),
      ],
      meals: ['Lemon chicken & rice', 'Veggie stir-fry', 'Tacos', 'Big salad night', 'Homemade pizza', 'Grill night', 'Breakfast for dinner'],
      selfCare: lines('Fresh flowers on the table', 'Morning walk while it’s cool'),
      word: 'Fresh',
      family: lines('Pass outgrown clothes to cousins', 'Invite friends for a backyard dinner'),
      grateful: lines('Longer days', 'Lighter closets'),
      groceries: lines('Trash & donation bags', 'Cleaning spray', 'Lemons', 'Chicken', 'Salad greens', 'Strawberries', 'Seeds or flowers', 'Rice'),
      todo: lines('Store winter coats', 'Check kids’ shoe sizes', 'Schedule donation pickup', 'Wash windows'),
      notes: '15 minutes a day. Done is better than perfect.',
    },
  },
];
