/**
 * The screen time tool's words (src/components/site/ScreenTimeContract.astro): the earn-it contract's starter jobs,
 * activities and chips, and the family agreement's starter wording by age. Starters, not rules: every line is
 * editable, how much screen time is always the family's own number (never filled in for them), and the grown-ups'
 * side is part of every agreement. No punishments, no device-free lectures.
 */

export type ScreenAge = 'young' | 'school' | 'teen';
export const screenAges: { id: ScreenAge; label: string }[] = [
  { id: 'young', label: 'Ages 3–5' },
  { id: 'school', label: 'Ages 6–12' },
  { id: 'teen', label: 'Teens' },
];
export const screenAgeFor = (age: number | undefined | null): ScreenAge => (age == null ? 'school' : age <= 5 ? 'young' : age >= 13 ? 'teen' : 'school');

export interface AgreementStarter {
  weekday: string;
  weekend: string;
  /** A hint in the "How much" blank (never prefilled: the family decides). */
  amountHint: string;
  before: string[];
  where: string[];
  end: string[];
  adults: string[];
}

export const screenStarters: Record<ScreenAge, AgreementStarter> = {
  young: {
    weekday: 'After quiet time, with a grown-up nearby',
    weekend: 'A show together on weekend mornings',
    amountHint: 'e.g. one or two shows',
    before: ['Get dressed', 'Eat breakfast', 'Put toys away', 'Play outside'],
    where: ['In the living room', 'Where a grown-up can see', ''],
    end: ['Finish the show', 'Turn it off with a grown-up', 'Pick what to play next'],
    adults: ['Tell you the plan before screens start', 'Give you a five-minute warning', 'Put our phones away at meals and story time'],
  },
  school: {
    weekday: 'In the afternoon, after quiet time',
    weekend: 'Mornings, after breakfast and getting dressed',
    amountHint: 'our number, e.g. about an hour a day',
    before: ['Get dressed and eat breakfast', 'Do my summer job', 'Play outside or move', 'Read for a while'],
    where: ['In shared rooms, like the living room', 'Devices charge in the kitchen at night', ''],
    end: ['Save the game or find a stopping point', 'Put the device back where it lives', 'Choose what’s next'],
    adults: ['Explain the plan clearly', 'Give a five-minute warning', 'Put our own phones down at family times'],
  },
  teen: {
    weekday: 'Once my responsibilities are done',
    weekend: 'Flexible, with family plans first',
    amountHint: 'what we agree, e.g. a daily total or a cut-off time',
    before: ['My summer job', 'Time outside or moving', 'Plans with family come first', ''],
    where: ['Anywhere at home, in reason', 'Phones charge outside bedrooms overnight', ''],
    end: ['Wrap up on my own when time’s up', 'Plug in at the charging spot', 'Ask, don’t argue, if I need more time'],
    adults: ['Trust you to manage your own time', 'Talk with you before changing the rules', 'Show the habits we ask for'],
  },
};

/** The earn-it contract's starters and chips (as /screen-time-contract has always had them). */
export const earnIdeas = {
  taskStart: ['Finish my homework', 'Clean my room', 'Make my bed', 'Brush my teeth'],
  activityStart: ['Read a book', 'Play outside', 'Do art or crafts', 'Help cook dinner'],
  tasks: ['Help with dishes', 'Take out trash', 'Feed pets', 'Pack school bag', 'Put laundry away', 'Practice spelling words'],
  activities: ['Practice music', 'Exercise or sports', 'Build with blocks or LEGO', 'Play a board game', 'Write a story', 'Ride my bike'],
  before: ['Make my bed', 'Help with one job', 'Read for 20 minutes', 'Get outside', 'Practice music', 'Tidy my room'],
};
