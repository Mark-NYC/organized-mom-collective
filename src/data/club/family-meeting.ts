/**
 * The Monthly Family Meeting's content: one small definition per month, read by the engine
 * (src/lib/club/family-meeting.ts). A 10-minute introduction to the month's resource, in four sections:
 * Our Focus (2 min), Let's Talk (3), Everyone's Part (3), Let's Practice (2). It never replaces January's ongoing
 * Weekly Family Meeting; January's monthly meeting only introduces it.
 *
 * Themes follow the current resources (src/pages/app/club/<month>.astro and their engines in src/lib/club/engines/),
 * not the older planning docs. src/data/club/resources.ts still lists January as Habit Cards and February/March by
 * older titles; the app pages are the current truth (January = Weekly Meeting, September = Habit Cards).
 *
 * Writing rules (tests check them): no "Mom", "Dad" or "parents" (one-parent families, grandparents and caregivers
 * are all families); no task that makes one grown-up the family's reminder; children's examples carry a minimum age
 * and nothing involving a stove, knives or machines below the age the month's resource allows.
 *
 * Tokens filled by the engine, only from the family's own profile: {activity} (her activity's name, or its category),
 * {activityMid} (the same, mid-sentence), {eveningBefore} (" on Monday evening", the evening before its days, or ""),
 * {who} (people who take part), {days} (" on Tue and Thu", or ""), {kids} (the children's names, or "the kids"),
 * {kid} (one child), {task} (an existing responsibility), {takes} ("takes" or "take", agreeing with {who}), {growth} (a growth item she picked), {school}
 * ("school" or, for homeschooling families, "lessons").
 */
import type { ActivityCategory, ResponsibilityCategory } from './family-profile';

export interface MeetingExample {
  id: string;
  description: string;
  /** What finished looks like, in words a child can check. */
  finished: string;
  category: ResponsibilityCategory;
  /** Children from this age (in the kit's month). Omit with `adult`. */
  minAge?: number;
  maxAge?: number;
  /** A grown-up's example. 'any' fits the account holder too; 'other' only grown-ups who don't hold the account. */
  adult?: 'any' | 'other';
  /** A cue, never a claim about anyone's availability. Children's examples only. */
  when?: string;
  /** Use the days of the family's own activity in this category as "when", if she entered any. */
  whenFrom?: ActivityCategory;
  /** The growth item (src/data/club/family-profile.ts → GROWTH_ITEMS) this example serves. */
  growth?: string;
  /** Only for families who told us they have a pet. */
  requiresPets?: boolean;
  /**
   * Only for a child she put on one of her activities in these categories. {activity} is that activity, and the cue is
   * the evening before its days (never a time she didn't give).
   */
  forActivity?: readonly ActivityCategory[];
}

export interface MeetingMonth {
  /** 1–12. */
  month: number;
  theme: string;
  resourceTitle: string;
  /** The month's resource page in the Club app. */
  route: string;
  /** Our Focus: the month's family challenge and the principle. */
  challenge: string;
  principle: string;
  /** Why it matters, when nothing in her profile says more. */
  why: string;
  /** Her first priority (PRIORITIES id) or challenges (CHALLENGES id) → why it matters to her family. */
  byPriority: Record<string, string>;
  byChallenge: Record<string, string>;
  /** Profile data that belongs to this month. */
  categories: readonly ResponsibilityCategory[] | 'all';
  activities: readonly ActivityCategory[];
  growth: readonly string[];
  /** How everyone's part connects to the resource. */
  connection: string;
  questions: {
    /** Q1, about the week. */
    schedule: { withActivity: string; generic: string };
    /** Q2, about the tool, by the youngest child's age (young under 7), or for a family without children. */
    tool: { young: string; older: string; adults: string };
    /** Q3, about ownership. */
    ownership: { withGrowth: string; withExisting: string; generic: string };
  };
  examples: readonly MeetingExample[];
  practice: { title: string; steps: readonly string[]; noKids: readonly string[] };
  /**
   * Megan's short audio introduction to the month's principle, once a real recording exists (a file in public/, e.g.
   * '/audio/club/meeting-2027-01.mp3'). The meeting shows a player only when this is set; never autoplays.
   */
  audio?: { src: string; minutes: number };
}

const SCHEDULE_ACTIVITY = 'What could {who} do{eveningBefore} to be ready for {activityMid}{days}?';

export const MEETING_MONTHS: readonly MeetingMonth[] = [
  {
    month: 1,
    theme: 'Weekly Family Meeting and shared planning',
    resourceTitle: 'Our Family Weekly Meeting',
    route: '/app/club/january',
    challenge: 'Everyone knowing what’s coming this week, instead of one person carrying the whole calendar.',
    principle: 'When we look ahead together, everyone can get ready for their own part.',
    why: 'A short weekly look ahead means fewer surprises and fewer last-minute questions.',
    byPriority: {
      activities: 'Keeping track of activities and rides is the thing you most want to share, and a weekly look ahead is where that starts.',
      reminding: 'You want to stop being everyone’s reminder. When everyone sees the week, they can remember their own part.',
      'school-stuff': 'School papers and bags come up every week; a weekly look ahead catches them early.',
    },
    byChallenge: {
      'knowing-plans': 'Knowing what’s happening is hard right now, so this month starts there.',
      communicating: 'Sharing plans is hard right now; one short meeting a week gives everyone the same picture.',
      preparing: 'Getting ready for what’s coming up is hard right now; looking ahead together gives everyone time to prepare.',
    },
    categories: ['transportation', 'school-prep', 'belongings'],
    activities: ['school', 'sports', 'lessons', 'community', 'clubs', 'appointments', 'work', 'other'],
    growth: ['own-belongings', 'pack-school-bag'],
    connection: 'Your Weekly Meeting sheet: each week, everyone checks the week ahead and gets their own part ready.',
    questions: {
      schedule: { withActivity: SCHEDULE_ACTIVITY, generic: 'What’s one thing happening this week that we all need to know about?' },
      tool: { young: 'What do you need to get ready for this week? Show us or tell us.', older: 'What’s one thing you could get ready on your own before it’s needed?', adults: 'Which part of next week could each of us get ready on our own?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What’s one small step {kids} could take this week?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'Who could be in charge of checking what they need for their own week?' },
    },
    examples: [
      { id: 'jan-gear', minAge: 6, category: 'belongings', forActivity: ['sports', 'lessons', 'clubs'], description: 'Check and pack my things for {activity} before bed.', finished: 'Everything for {activity} is packed and by the door.' },
      { id: 'jan-clothes', minAge: 3, maxAge: 5, category: 'belongings', description: 'Look at the week with a grown-up and lay out clothes for the first day.', finished: 'Clothes for the first day are out and ready.', when: 'At our weekly meeting' },
      { id: 'jan-spot', minAge: 6, maxAge: 10, category: 'school-prep', growth: 'pack-school-bag', description: 'Check my days on the calendar and say one thing I need.', finished: 'I told the family one thing I need before the meeting ends.', when: 'At our weekly meeting' },
      { id: 'jan-own-week', minAge: 11, category: 'belongings', growth: 'own-belongings', description: 'Review my own week and ask for any help or rides early.', finished: 'My week is on the calendar and I asked for help before the meeting ended.', when: 'At our weekly meeting' },
      { id: 'jan-own-commitments', adult: 'any', category: 'other', description: 'Get my own commitments for the week ready.', finished: 'My own plans for the week are on the calendar.' },
      { id: 'jan-logistics', adult: 'other', category: 'transportation', description: 'Own rides and supplies for one activity this week.', finished: 'Rides and gear for that activity are sorted before it starts.' },
    ],
    practice: {
      title: 'Fill in this week together',
      steps: ['Put your Weekly Meeting sheet where everyone can see it.', 'Each person names one thing happening for them this week.', '{kid} writes or draws each one on the sheet.', 'Pick your weekly meeting time and write it at the top.'],
      noKids: ['Put your Weekly Meeting sheet where everyone can see it.', 'Each person names one thing happening for them this week and writes it on the sheet.', 'Pick your weekly meeting time and write it at the top.'],
    },
  },
  {
    month: 2,
    theme: 'Laundry and caring for personal belongings',
    resourceTitle: 'Family Laundry Guides',
    route: '/app/club/february',
    challenge: 'Clothes that get where they need to go, without one person carrying every basket.',
    principle: 'Our things are our responsibility. Even small kids can do part of their own laundry.',
    why: 'Laundry never stops, so every step someone else owns is one less thing on the pile.',
    byPriority: { laundry: 'Laundry is the thing you most want to stop managing alone, so this month is right on target.' },
    byChallenge: { 'sharing-fairly': 'Sharing the housework fairly is hard right now; laundry is a good place to start because everyone makes it.' },
    categories: ['laundry', 'belongings'],
    activities: [],
    growth: ['put-away-laundry', 'own-belongings'],
    connection: 'Each child’s laundry guide shows their steps; grown-ups run the machines.',
    questions: {
      schedule: { withActivity: SCHEDULE_ACTIVITY, generic: 'Which day would be a good laundry day for our family?' },
      tool: { young: 'Where do dirty clothes go in our house?', older: 'Which part of laundry could you do all by yourself?', adults: 'Which laundry step could someone else own completely?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What would make it easier for {kids}?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'What does “laundry is done” look like in our house?' },
    },
    examples: [
      { id: 'feb-hamper', minAge: 3, maxAge: 5, category: 'laundry', description: 'Put my dirty clothes in the hamper every night.', finished: 'No clothes on my floor at bedtime.', when: 'At bedtime' },
      { id: 'feb-put-away', minAge: 6, maxAge: 8, category: 'laundry', growth: 'put-away-laundry', description: 'Bring my clean clothes to my room and put them away (My Clothes, My Job).', finished: 'My basket is empty and my clothes are in their drawers.', when: 'On laundry day' },
      { id: 'feb-own-load', minAge: 9, category: 'laundry', growth: 'put-away-laundry', description: 'Wash, dry, fold and put away my own load with my guide (I Can Do My Own Laundry).', finished: 'My load is washed, dried, folded and put away the same day.', when: 'On laundry day' },
      { id: 'feb-machines', adult: 'any', category: 'laundry', description: 'Run the machines on laundry days so the kids can do their part.', finished: 'Clean clothes are ready for the kids to put away.' },
    ],
    practice: {
      title: 'Try one laundry step',
      steps: ['Open each child’s laundry guide.', '{kid} shows where dirty clothes go, or carries one basket to the laundry spot.', 'Everyone agrees on your laundry day and writes it on the guide.'],
      noKids: ['Open the laundry guide together.', 'Each person picks one laundry step to own and says what finished looks like.', 'Agree on your laundry day.'],
    },
  },
  {
    month: 3,
    theme: 'Chore charts and understanding what finished looks like',
    resourceTitle: 'Family Chore Charts',
    route: '/app/club/march',
    challenge: 'Chores that get finished, because everyone knows what finished looks like.',
    principle: 'A job isn’t done until it looks done. If we can see the finish line, nobody has to check.',
    why: 'Most “Did you do it?” conversations happen because finished means different things to different people.',
    byPriority: { tidying: 'Keeping the house picked up is the thing you most want to share; clear finish lines make that possible.', reminding: 'You want to stop being everyone’s reminder. A chart with a clear finish line does that job.' },
    byChallenge: { remembering: 'Remembering who does what is hard right now; a chart on the wall remembers for you.', 'sharing-fairly': 'Sharing the housework fairly is hard right now; a chart makes everyone’s part visible.' },
    categories: ['cleaning'],
    activities: [],
    growth: ['tidy-room'],
    connection: 'Each child’s chore chart lists their daily jobs and the day’s zone, with what finished looks like.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. Which day would be easiest for a bigger chore?', generic: 'Which day of the week has the most time for a bigger chore?' },
      tool: { young: 'Can you show us what a clean floor looks like?', older: 'Pick one chore. How would someone know it’s really finished?', adults: 'Which chore do we each define differently? Let’s agree what finished looks like.' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What does finished look like for {kids}?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'Which job do you think you could finish without anyone checking?' },
    },
    examples: [
      { id: 'mar-toys', minAge: 3, maxAge: 5, category: 'cleaning', description: 'Put my toys back in their bins.', finished: 'Every toy is in a bin and the floor is clear.', when: 'Before dinner' },
      { id: 'mar-room', minAge: 6, maxAge: 9, category: 'cleaning', growth: 'tidy-room', description: 'Make my bed and clear my floor.', finished: 'Blanket pulled up, pillow on top, nothing on the floor.', when: 'After breakfast' },
      { id: 'mar-sink', minAge: 10, category: 'cleaning', description: 'Wipe the bathroom sink and counter.', finished: 'No toothpaste or spots, and the towel is hung up.', when: 'On our zone day' },
      { id: 'mar-zone', adult: 'any', category: 'cleaning', description: 'Own one weekly cleaning zone, start to finish.', finished: 'That zone is done on its day without anyone asking.' },
    ],
    practice: {
      title: 'Show what finished looks like',
      steps: ['Pick one job from {kid}’s chart.', '{kid} does it right now, in two minutes or less.', 'Everyone looks together: is it finished? Say what finished looks like out loud.'],
      noKids: ['Pick one job from the chart.', 'One person does it now; everyone checks it against the finish line.', 'Adjust the wording until everyone agrees.'],
    },
  },
  {
    month: 4,
    theme: 'Sharing meal preparation and cleanup',
    resourceTitle: 'Our Dinner Team',
    route: '/app/club/april',
    challenge: 'Dinner that’s a team job, from getting ready to cleaning up.',
    principle: 'Everyone eats, so everyone helps. Ask the Dinner Captain what’s next.',
    why: 'Dinner happens every day; a team with clear roles means one person isn’t doing all of it.',
    byPriority: { evenings: 'Dinner and evenings are what you most want to share, so this month is right on target.' },
    byChallenge: { 'sharing-fairly': 'Sharing the housework fairly is hard right now; dinner roles make everyone’s part clear.', routines: 'Evening routines are hard right now; a dinner team gives the evening a clear start.' },
    categories: ['meals'],
    activities: [],
    growth: ['help-with-meals'],
    connection: 'Your Dinner Team sheet gives each person a role, from gathering ingredients through cleanup.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. Which night would be best for our team dinner?', generic: 'Which night this week is calm enough for our first team dinner?' },
      tool: { young: 'What could you put on the table for dinner?', older: 'Which dinner job would you like: checking ingredients or setting the table?', adults: 'Which of us could be Dinner Captain one night?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. Which dinner job fits {kids}?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'After dinner, what does a cleared table look like?' },
    },
    examples: [
      { id: 'apr-table', minAge: 3, maxAge: 6, category: 'meals', growth: 'help-with-meals', description: 'Table captain: set out plates and napkins, then clear my own dishes.', finished: 'Every place has a plate and napkin, and my dishes are by the sink after.', when: 'At dinner' },
      { id: 'apr-checker', minAge: 7, maxAge: 11, category: 'meals', growth: 'help-with-meals', description: 'Ingredients checker: check the pantry and gather what the recipe needs.', finished: 'Everything for the recipe is out on the counter.', when: 'Before dinner' },
      { id: 'apr-helper', minAge: 12, category: 'meals', growth: 'help-with-meals', description: 'Do one prep step with a grown-up nearby, then lead the cleanup.', finished: 'My step is done and the counter is wiped.', when: 'At dinner' },
      { id: 'apr-captain', adult: 'other', category: 'meals', description: 'Be Dinner Captain one night: own the plan, the cooking and leading the cleanup.', finished: 'Dinner is served and the kitchen is clean, and nobody else had to plan it.' },
      { id: 'apr-sit', adult: 'any', category: 'meals', description: 'On team night, handle the stove and knives, and let the team run the rest.', finished: 'The team did their roles and you did only the cooking lead’s part.' },
    ],
    practice: {
      title: 'Hand out the dinner roles',
      steps: ['Read the four roles on your Dinner Team sheet out loud.', '{kid} picks a role they can do and says what they’ll do first.', 'Write the names on the sheet and pick the night.'],
      noKids: ['Read the roles on your Dinner Team sheet.', 'Each person picks a role and the night they’ll do it.', 'Write the names on the sheet.'],
    },
  },
  {
    month: 5,
    theme: 'Summer routines and taking initiative',
    resourceTitle: 'Our Summer Day Rhythm',
    route: '/app/club/may',
    challenge: 'Summer days kids can follow on their own, without asking what’s next every hour.',
    principle: 'A rhythm tells us what comes next, so we can start it ourselves.',
    why: 'When summer starts, the day loses its shape. A simple rhythm gives it back.',
    byPriority: { reminding: 'You want to stop being everyone’s reminder. A rhythm on the wall answers “What now?”', mornings: 'Mornings are what you most want to share; the rhythm starts every day the same way.' },
    byChallenge: { routines: 'Routines are hard right now; a rhythm keeps them going all summer.', 'knowing-plans': 'Knowing what’s happening is hard right now; the rhythm shows the shape of every day.' },
    categories: ['cleaning', 'belongings'],
    activities: ['sports', 'lessons', 'community', 'clubs', 'other'],
    growth: ['morning-routine'],
    connection: 'Your Summer Day Rhythm shows the blocks of the day in order, so everyone can see what comes next.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. Where does it fit in our summer days?', generic: 'What’s one thing we want to do every summer day?' },
      tool: { young: 'What should we do first in the morning?', older: 'When you’re not sure what’s next, where could you look?', adults: 'Which part of the day could run without anyone directing it?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. How could {kids} start it on their own?', withExisting: '{who} already {takes} care of {task}. Where does that go in our day?', generic: 'Which part of the day could you start on your own?' },
    },
    examples: [
      { id: 'may-point', minAge: 3, maxAge: 5, category: 'routines', description: 'Point to what comes next on our rhythm.', finished: 'I found the next block on the sheet.', when: 'Between activities' },
      { id: 'may-start', minAge: 6, maxAge: 9, category: 'routines', growth: 'morning-routine', description: 'Check the rhythm and start the next block on my own.', finished: 'I started the next block without asking.', when: 'Between activities' },
      { id: 'may-plan', minAge: 10, category: 'routines', growth: 'morning-routine', description: 'Plan what I’ll do in one free block and start it myself.', finished: 'My plan is written on the rhythm and I started it.', when: 'Each morning' },
      { id: 'may-block', adult: 'any', category: 'meals', description: 'Own one block of the day, like lunch, on a day you choose.', finished: 'That block happens on its day without anyone organizing it.' },
    ],
    practice: {
      title: 'Walk through one summer day',
      steps: ['Read your Summer Day Rhythm from top to bottom.', '{kid} points to each block and says what happens there.', 'Change one block so it fits your family.'],
      noKids: ['Read your Summer Day Rhythm together.', 'Each person names the block they’ll own.', 'Change one block so it fits.'],
    },
  },
  {
    month: 6,
    theme: 'Independent snack preparation',
    resourceTitle: 'My Family’s Snack Station',
    route: '/app/club/june',
    challenge: 'Snacks kids can choose themselves, without a request every hour.',
    principle: 'When we know the choices and the rule, we can take care of ourselves.',
    why: 'Snack requests add up all day. A station and one rule handle most of them.',
    byPriority: { reminding: 'You want fewer requests and reminders; a snack rule answers the question before it’s asked.', evenings: 'Calmer evenings start with fewer snack negotiations before dinner.' },
    byChallenge: { routines: 'Routines are hard right now; the snack station turns snacks into one.' },
    categories: ['meals'],
    activities: [],
    growth: ['help-with-meals'],
    connection: 'Your Snack Station shows four fridge and four pantry choices, the snack rule and the after-snack reminder.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. What snack helps before or after it?', generic: 'When are snacks most helpful in our day?' },
      tool: { young: 'Which snack would you pick from our station?', older: 'What should our snack rule be?', adults: 'Which snacks can the kids get without asking, and which need a grown-up?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What could {kids} do on their own at snack time?', withExisting: '{who} already {takes} care of {task}. How can the station help?', generic: 'What do we do with wrappers and bowls after a snack?' },
    },
    examples: [
      { id: 'jun-help', minAge: 3, maxAge: 5, category: 'meals', description: 'Pick a snack from my station with a grown-up nearby.', finished: 'I chose one snack and put the wrapper in the trash.', when: 'At snack time' },
      { id: 'jun-rule', minAge: 6, category: 'meals', growth: 'help-with-meals', description: 'Choose my snack from the station using our snack rule.', finished: 'I followed the rule and my bowl is in the sink.', when: 'At snack time' },
      { id: 'jun-restock', minAge: 8, category: 'meals', description: 'Help restock the snack station once a week.', finished: 'Every slot on the station has food again.', when: 'On grocery day' },
      { id: 'jun-stock', adult: 'any', category: 'meals', description: 'Keep the station’s foods on the grocery list.', finished: 'Station foods are bought with the groceries.' },
    ],
    practice: {
      title: 'Try the snack station',
      steps: ['Read the snack rule on your station out loud.', '{kid} shows how they’d pick a snack using the rule.', 'Everyone says the after-snack reminder together.'],
      noKids: ['Read the snack rule together.', 'Agree on which foods go on the station.', 'Decide who adds them to the grocery list.'],
    },
  },
  {
    month: 7,
    theme: 'Independent activities and responding to boredom',
    resourceTitle: 'What Can I Do Right Now? Activity Board',
    route: '/app/club/july',
    challenge: 'Kids who can answer “I’m bored” themselves.',
    principle: 'Bored is a starting point. Check your board, pick one, and start.',
    why: '“I’m bored” lands on whoever is closest. A board gives kids ideas they can start alone.',
    byPriority: { reminding: 'You want to stop being the answer to every question; the board answers “What can I do?”' },
    byChallenge: { routines: 'Routines are hard right now; the board gives free time a simple routine: look, pick, start, put away.' },
    categories: ['belongings', 'cleaning'],
    activities: ['sports', 'lessons', 'clubs', 'community'],
    growth: ['own-belongings', 'tidy-room'],
    connection: 'Your Activity Board has three groups: Start Playing, Make & Imagine and Keep Going.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. What could you do on the days without it?', generic: 'When in the day do you usually feel bored?' },
      tool: { young: 'What’s something you can play all by yourself?', older: 'What’s a project you could keep working on for a few days?', adults: 'What could each of us do on our own when there’s free time?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What should happen after playtime?', withExisting: '{who} already {takes} care of {task}. How does that fit with free time?', generic: 'After you play, what does “put away” look like?' },
    },
    examples: [
      { id: 'jul-start', minAge: 3, maxAge: 5, category: 'other', description: 'Pick one “Start Playing” idea from my board.', finished: 'I picked one and started without asking.', when: 'When I feel bored' },
      { id: 'jul-board', minAge: 6, maxAge: 9, category: 'belongings', growth: 'own-belongings', description: 'When I’m bored, check my board before asking, then put it away after.', finished: 'I picked, played and put everything back.', when: 'When I feel bored' },
      { id: 'jul-project', minAge: 10, category: 'other', description: 'Keep one “Keep Going” project going this week.', finished: 'I worked on it on my own at least twice.', when: 'During free time' },
      { id: 'jul-join', adult: 'any', category: 'other', description: 'Say yes to joining one activity when a child invites you this week.', finished: 'You played along without planning it.' },
    ],
    practice: {
      title: 'Try the board',
      steps: ['Put the Activity Board where the kids can reach it.', '{kid} reads or points to one idea from each group.', 'Pretend someone says “I’m bored!” and let {kid} show what to do.'],
      noKids: ['Look at the board together.', 'Each person adds one idea they enjoy.', 'Agree where it hangs.'],
    },
  },
  {
    month: 8,
    theme: 'School-day preparation',
    resourceTitle: 'My School Day Routines',
    route: '/app/club/august',
    challenge: 'Mornings and afternoons kids can run with their own routine.',
    principle: 'A routine we can see is a routine we can follow without reminders.',
    why: 'Weekdays repeat, so a routine that works once can work every day.',
    byPriority: { mornings: 'The morning rush is what you most want to share; a picture routine gives each child their own steps.', 'school-stuff': 'School papers, bags and homework are what you most want to share; the afternoon routine covers them.', reminding: 'You want to stop being everyone’s reminder; the routine is the reminder.' },
    byChallenge: { routines: 'Morning and evening routines are hard right now, so this month goes straight at them.', preparing: 'Getting ready is hard right now; the night-before steps help.' },
    categories: ['school-prep', 'homework', 'belongings'],
    activities: ['school'],
    growth: ['morning-routine', 'pack-school-bag', 'homework-start'],
    connection: 'Each child’s My School Day sheet shows a morning and an afternoon routine in pictures.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. What has to happen before we leave?', generic: 'What has to happen before we start {school}?' },
      tool: { young: 'What’s the first thing you do in the morning?', older: 'Which step of your morning could you do without anyone asking?', adults: 'Which morning step could someone else own?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. Which step could {kids} own first?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'What should be ready by the door before bedtime?' },
    },
    examples: [
      { id: 'aug-door', minAge: 3, maxAge: 5, category: 'school-prep', description: 'Put my shoes and bag by the door before bed.', finished: 'Shoes and bag are by the door.', when: 'Before bed', whenFrom: 'school' },
      { id: 'aug-morning', minAge: 6, maxAge: 9, category: 'school-prep', growth: 'morning-routine', description: 'Follow the morning routine on my sheet.', finished: 'Every step on my morning routine is done.', when: 'Before {school}', whenFrom: 'school' },
      { id: 'aug-bag', minAge: 10, category: 'school-prep', growth: 'pack-school-bag', description: 'Pack my bag and check tomorrow’s plans the night before.', finished: 'My bag is packed and by the door.', when: 'The night before', whenFrom: 'school' },
      { id: 'aug-homework', minAge: 7, category: 'homework', growth: 'homework-start', description: 'Start my homework at our usual time, without a reminder.', finished: 'Homework done and back in my bag.', when: 'After {school}', whenFrom: 'school' },
      { id: 'aug-breakfast', adult: 'any', category: 'meals', description: 'Own one morning job, like breakfast or lunches.', finished: 'That job is done before anyone has to ask.' },
    ],
    practice: {
      title: 'Walk through tomorrow morning',
      steps: ['Hold up {kid}’s My School Day sheet.', '{kid} reads or points to each morning step, in order.', 'Act out the first two steps right now.'],
      noKids: ['Look at the morning routine together.', 'Each person names the step they own.', 'Agree on the time you leave.'],
    },
  },
  {
    month: 9,
    theme: 'Family Habit Cards and building routines',
    resourceTitle: 'Our Family Habit Cards',
    route: '/app/club/september',
    challenge: 'Small habits that happen on their own, because they’re tied to something we already do.',
    principle: 'After I do something I always do, I do one small thing. The card is the reminder.',
    why: 'Habits stick when they’re small and come right after something that already happens.',
    byPriority: { reminding: 'You want to stop being everyone’s reminder; a habit card sits where the job happens and reminds for you.', mornings: 'Mornings are what you most want to share; a morning habit card is a good first one.' },
    byChallenge: { remembering: 'Remembering who does what is hard right now; habit cards keep the reminder where it’s needed.', routines: 'Routines are hard right now; one small habit at a time builds them.' },
    categories: ['belongings', 'cleaning', 'school-prep'],
    activities: [],
    growth: ['morning-routine', 'bedtime-routine', 'own-belongings'],
    connection: 'Your Habit Cards pair one cue (“After I…”) with one small action, placed where it happens.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. What small habit could help on those days?', generic: 'What’s something we do every single day?' },
      tool: { young: 'After breakfast, what could you do with your bowl?', older: 'What’s one small thing you could do right after something you always do?', adults: 'Which small habit would make the biggest difference for us?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What small habit could {kids} start with?', withExisting: '{who} already {takes} care of {task}. Is there a habit that would make it easier?', generic: 'Where should your habit card go so you’ll see it?' },
    },
    examples: [
      { id: 'sep-bowl', minAge: 3, maxAge: 5, category: 'cleaning', description: 'After I finish breakfast, I put my bowl by the sink.', finished: 'My bowl is by the sink after breakfast.', when: 'After breakfast' },
      { id: 'sep-backpack', minAge: 6, maxAge: 9, category: 'school-prep', growth: 'morning-routine', description: 'After I put on my shoes, I put my backpack on.', finished: 'Backpack on before we head out.', when: 'After I put on my shoes' },
      { id: 'sep-pajamas', minAge: 4, maxAge: 9, category: 'belongings', growth: 'bedtime-routine', description: 'After I get dressed, I put my pajamas away.', finished: 'Pajamas are in their drawer.', when: 'After I get dressed' },
      { id: 'sep-own-card', minAge: 10, category: 'belongings', growth: 'own-belongings', description: 'Write my own habit card: one cue and one small action.', finished: 'My card is written and placed where the habit happens.', when: 'After something I already do' },
      { id: 'sep-adult-card', adult: 'any', category: 'other', description: 'Choose one habit card of your own, so the kids see everyone practicing.', finished: 'Your card is up where it happens.' },
    ],
    practice: {
      title: 'Place the first card',
      steps: ['Read one Habit Card out loud: the cue, then the action.', '{kid} carries it to where the habit happens and puts it up.', 'Act it out once: do the cue, then the action.'],
      noKids: ['Read one Habit Card together.', 'Put it where the habit happens.', 'Each person names one habit they’ll try.'],
    },
  },
  {
    month: 10,
    theme: 'Daily home reset and shared spaces',
    resourceTitle: 'Our 5-Minute Reset',
    route: '/app/club/october',
    challenge: 'Shared spaces that get reset every day, by everyone, in five minutes.',
    principle: 'Same cue, same jobs, same finish line. Everyone resets, every day.',
    why: 'Shared spaces fill up because everyone uses them. Five minutes together keeps them under control.',
    byPriority: { tidying: 'Keeping the house picked up is what you most want to share, so this month is right on target.', evenings: 'Calmer evenings start with a reset before dinner or bedtime.' },
    byChallenge: { 'sharing-fairly': 'Sharing the housework fairly is hard right now; a reset has everyone working at the same time.', routines: 'Routines are hard right now; one daily cue builds one.' },
    categories: ['cleaning', 'belongings'],
    activities: [],
    growth: ['tidy-room', 'own-belongings'],
    connection: 'Your 5-Minute Reset sheet has one cue, two or three picture jobs and a finish line.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. What time of day works for a reset on those days?', generic: 'When should our reset happen: before dinner, after dinner or before bed?' },
      tool: { young: 'Where do your toys live when we’re done playing?', older: 'Which shared space needs a reset the most?', adults: 'Which shared space would make the biggest difference if it were reset every day?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. What could {kids} reset every day?', withExisting: '{who} already {takes} care of {task}. What does finished look like?', generic: 'How will we know the reset is finished?' },
    },
    examples: [
      { id: 'oct-toys', minAge: 3, maxAge: 5, category: 'cleaning', description: 'Toys put away.', finished: 'Each toy is back where it belongs.', when: 'At our reset cue' },
      { id: 'oct-mine', minAge: 6, maxAge: 9, category: 'belongings', growth: 'own-belongings', description: 'Personal belongings put away.', finished: 'My things are off the floor and in their spots.', when: 'At our reset cue' },
      { id: 'oct-area', minAge: 10, category: 'cleaning', growth: 'tidy-room', description: 'Clear the play area or living room surfaces.', finished: 'Floor and tables are clear enough to vacuum.', when: 'At our reset cue' },
      { id: 'oct-alongside', adult: 'any', category: 'cleaning', description: 'Reset one shared space alongside the kids.', finished: 'Your space is reset in the same five minutes.' },
    ],
    practice: {
      title: 'Do a two-minute reset',
      steps: ['Say your reset cue out loud.', 'Set a timer for two minutes. {kid} does their first picture job; everyone else does theirs.', 'Look together: does it match the finish line?'],
      noKids: ['Say your reset cue out loud.', 'Set a timer for two minutes and everyone resets one spot.', 'Check it against the finish line.'],
    },
  },
  {
    month: 11,
    theme: 'Owning a complete responsibility',
    resourceTitle: 'Our Family Ownership Plan',
    route: '/club/resources/2026-11-family-ownership',
    challenge: 'Each person owning one whole job, start to finish, including noticing when it’s needed.',
    principle: 'Owning a job means you notice it, do it and finish it. Nobody has to remind you.',
    why: 'Helping when asked still needs someone to ask. Owning a job takes it off everyone else’s mind.',
    byPriority: { reminding: 'You want to stop being everyone’s reminder; owned jobs don’t need one.', tidying: 'Keeping the house picked up gets easier when each part has an owner.', laundry: 'Laundry is a good first job to hand over completely.' },
    byChallenge: { remembering: 'Remembering who does what is hard right now; an owner for each job settles it.', 'sharing-fairly': 'Sharing the housework fairly is hard right now; an ownership plan shows everyone’s part.' },
    categories: 'all',
    activities: [],
    growth: ['morning-routine', 'bedtime-routine', 'pack-school-bag', 'homework-start', 'tidy-room', 'put-away-laundry', 'help-with-meals', 'own-belongings', 'pet-care'],
    connection: 'Your Ownership Plan names one owner for each job, with when it happens and what finished looks like.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. Which jobs need to happen before or after it?', generic: 'Which job in our house needs doing every day?' },
      tool: { young: 'What’s one job you could do all by yourself?', older: 'Which job could you own start to finish, even noticing when it needs doing?', adults: 'Which job could each of us own completely, so nobody has to ask?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. Could that be {kids}’s job to own?', withExisting: '{who} already {takes} care of {task}. What does owning it all the way look like?', generic: 'What’s the difference between helping with a job and owning it?' },
    },
    examples: [
      { id: 'nov-shoes', minAge: 3, maxAge: 5, category: 'belongings', growth: 'own-belongings', description: 'Own putting my shoes and coat away when I come in.', finished: 'Shoes on the mat, coat on the hook.', when: 'When I come in' },
      { id: 'nov-pet', minAge: 4, category: 'pet-care', growth: 'pet-care', requiresPets: true, description: 'Own feeding the pet, with a grown-up checking at first.', finished: 'The bowl is filled and the food is put away.', when: 'At feeding time' },
      { id: 'nov-table', minAge: 6, maxAge: 9, category: 'meals', growth: 'help-with-meals', description: 'Own setting the table, start to finish.', finished: 'Every place is set before we sit down.', when: 'Before dinner' },
      { id: 'nov-trash', minAge: 10, category: 'cleaning', description: 'Own taking out the trash and recycling, including new bags.', finished: 'Bins emptied and new bags in.', when: 'On trash night' },
      { id: 'nov-adult', adult: 'any', category: 'other', description: 'Own one household job completely, including noticing when it’s needed.', finished: 'That job is done on time without anyone asking.' },
    ],
    practice: {
      title: 'Say your job out loud',
      steps: ['Open your Ownership Plan.', '{kid} reads their job and says when it happens and what finished looks like.', 'Each person does the same, then everyone agrees or adjusts.'],
      noKids: ['Open your Ownership Plan.', 'Each person reads their job, when it happens and what finished looks like.', 'Agree or adjust.'],
    },
  },
  {
    month: 12,
    theme: 'Encouraging and blessing others',
    resourceTitle: 'Our Christmas Mission',
    route: '/app/club/december',
    challenge: 'A kindness mission the kids lead, making something to encourage someone else.',
    principle: 'We can bless someone else with what we make. Kids can lead it.',
    why: 'Busy seasons fill up with our own lists. A small mission turns the family toward someone else.',
    byPriority: {},
    byChallenge: { communicating: 'Sharing plans is hard right now; a simple mission with two cards keeps it small and clear.' },
    categories: ['other'],
    activities: ['community'],
    growth: [],
    connection: 'Your Christmas Mission has two kindness cards for drawings, poems or letters, and a helper to deliver them.',
    questions: {
      schedule: { withActivity: '{activity} is part of our week{days}. Is there someone there we could encourage?', generic: 'Who is someone we’d love to encourage this month?' },
      tool: { young: 'What picture could you draw to make someone smile?', older: 'What could you write that would encourage someone?', adults: 'Who would be glad to hear from our family this month?' },
      ownership: { withGrowth: '{growth} is something we want to grow in. How could {kids} lead part of the mission?', withExisting: '{who} already {takes} care of {task}. Could that help with our mission?', generic: 'How will our cards get to the people we chose?' },
    },
    examples: [
      { id: 'dec-draw', minAge: 3, maxAge: 6, category: 'other', description: 'Draw a picture on a kindness card.', finished: 'My card has a picture and my name.', when: 'This week' },
      { id: 'dec-write', minAge: 7, category: 'other', description: 'Write a note, poem or letter on a kindness card.', finished: 'My card is written, signed and ready to deliver.', when: 'This week' },
      { id: 'dec-deliver', adult: 'any', category: 'other', description: 'Be the delivery helper: get the finished cards mailed or delivered.', finished: 'The cards reached the people on our list.' },
    ],
    practice: {
      title: 'Choose who to bless',
      steps: ['Look at the two kindness cards together.', '{kid} names one person to make a card for.', 'Write the names on the mission and decide who helps deliver them.'],
      noKids: ['Look at the kindness cards together.', 'Each person names someone to encourage.', 'Decide how the cards will be delivered.'],
    },
  },
];

/** What finished looks like for an existing responsibility, by area (the family's own job, so kept general). */
export const CATEGORY_FINISHED: Record<ResponsibilityCategory, string> = {
  meals: 'The meal is served and the kitchen is cleaned up.',
  laundry: 'Clean clothes are folded and put away.',
  cleaning: 'The space is picked up and clean.',
  transportation: 'Everyone gets where they need to go on time.',
  belongings: 'Things are back in their spots.',
  'school-prep': 'Everything for the next school day is ready the night before.',
  homework: 'Homework is done and back in the bag.',
  'pet-care': 'The pet is fed and cared for.',
  routines: 'The routine is done without reminders.',
  other: 'It’s done without anyone needing to ask.',
};

export const meetingMonth = (month: number) => MEETING_MONTHS.find((m) => m.month === month);
