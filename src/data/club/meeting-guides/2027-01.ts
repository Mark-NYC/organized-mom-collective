/**
 * January 2027: Our First Family Meeting. The month's resource is the personalized guide itself: it introduces the
 * Club's four-part meeting, gets the family through its first one and sets the monthly rhythm. Content only; the
 * generator (src/lib/club/meeting-guide/generate.ts) matches it to a family. Rules: src/lib/club/meeting-guide/types.ts.
 *
 * Ids: priorities and challenges from src/data/club/family-profile.ts (PRIORITIES, CHALLENGES); practices keyed by
 * GROWTH_ITEMS id, so what she said she'd like each child to take on becomes that child's part.
 */
import type { GuideMonthContent } from '../../../lib/club/meeting-guide/types';

export const january2027: GuideMonthContent = {
  month: '2027-01',
  title: 'Our First Family Meeting',
  subtitle: 'About 10 minutes, together. The same four parts every month.',
  prepare: [
    'Pick 10 minutes when everyone’s home. A meal you already share works well.',
    'Put this guide, a pen and your family calendar where everyone can see them.',
    'Hand this guide to {leader}, who opens the meeting.',
  ],
  selfLead: 'You open this first meeting. As the kids grow, they can take a part.',
  prepareLittle: 'Little ones can sit on a lap. A snack helps everyone sit for ten minutes.',

  parts: {
    focus: {
      goal: 'Say why we’re meeting and what matters most right now.',
      say: 'This is our first Family Meeting. Once a month we’ll sit down for ten minutes so everyone knows the plan and everyone has a part. Nobody has to keep it all in their head.',
    },
    talk: {
      goal: 'Everyone answers, youngest first. No wrong answers, no fixing anyone.',
      say: 'Let’s each answer, starting with the youngest. We’re just listening today.',
    },
    parts: {
      goal: 'Each person agrees on one small part for this month.',
      say: 'Here’s an idea for each of us. Keep it, swap it or make it smaller. It’s yours, so nobody needs to remind you.',
    },
    practice: {
      goal: 'Try it right now, so the first time isn’t a reminder later.',
      say: 'Let’s each try our part once, right now.',
    },
  },

  focusByPriority: {
    mornings: { title: 'Calmer mornings', discuss: 'What would make mornings easier for each of us?' },
    evenings: { title: 'Easier evenings', discuss: 'What would make our evenings calmer?' },
    activities: { title: 'Sharing activities and rides', discuss: 'Which activity or ride catches us by surprise most?' },
    'school-stuff': { title: 'School things ready on time', discuss: 'What do we usually forget for {school}?' },
    tidying: { title: 'A home that stays picked up', discuss: 'Where do things pile up, and where should they go?' },
    laundry: { title: 'Laundry that doesn’t land on one person', discuss: 'Where do clothes get stuck on their way back to drawers?' },
    reminding: { title: 'Fewer reminders', discuss: 'What could each of us remember on our own if we knew when to do it?' },
  },
  focusByChallenge: {
    'knowing-plans': { title: 'Everyone knowing what’s happening', discuss: 'When did someone last not know what was happening?' },
    preparing: { title: 'Getting ready ahead of time', discuss: 'What do we always end up rushing for?' },
    remembering: { title: 'Knowing who does what', discuss: 'Who does what at our house right now?' },
    routines: { title: 'Smoother daily routines', discuss: 'Which part of our day feels most rushed?' },
    communicating: { title: 'Sharing plans with each other', discuss: 'How does each of us like to hear about plans?' },
    'sharing-fairly': { title: 'Sharing the work', discuss: 'Which jobs at home could someone else try?' },
  },
  focusDefault: { title: 'Starting our monthly Family Meeting', discuss: 'What would make this meeting something we all want to come to?' },
  focusGroups: [['reminding', 'remembering'], ['activities', 'knowing-plans', 'communicating'], ['mornings', 'routines', 'preparing'], ['school-stuff', 'preparing'], ['tidying', 'sharing-fairly'], ['laundry', 'sharing-fairly']],
  maxFocus: 2,

  questions: {
    withActivity: 'What’s happening for each of us this week, like {activity}?',
    generic: 'What’s one thing happening this week that everyone should know about?',
  },
  talkLittle: 'Little ones answer first, by pointing or with one word.',

  obstacles: {
    'knowing-plans': { obstacle: 'Plans might be living in one person’s head or phone.', principle: 'environment', adjustment: 'Hang the calendar where everyone passes, and add plans the day they’re made.' },
    preparing: { obstacle: 'Getting ready might be happening in the morning rush.', principle: 'environment', adjustment: 'Choose one spot by the door for tomorrow’s things, and fill it after dinner.' },
    remembering: { obstacle: 'Jobs might not have a clear “when”.', principle: 'trigger', adjustment: 'Give each person’s part a “when” that follows something they already do.' },
    routines: { obstacle: 'The routine might have too many steps to own at once.', principle: 'simplicity', adjustment: 'Each person owns one step this month, not the whole routine.' },
    communicating: { obstacle: 'Plans might be getting shared in passing.', principle: 'consistency', adjustment: 'New plans get said out loud at the meeting and written on the calendar that day.' },
    'sharing-fairly': { obstacle: 'Jobs might be falling to whoever notices first.', principle: 'ownership', adjustment: 'Each child chooses their part from two that fit their age.' },
  },
  obstacleOpen: 'What usually gets in our way? Pick one thing to try changing this month.',

  practices: [
    { id: 'morning-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Gets dressed in the clothes laid out the night before.', cue: 'After breakfast', setup: 'Lay tomorrow’s clothes on a chair they can reach.', finished: 'Dressed before shoes go on.' },
      early: { behavior: 'Does three morning steps: dressed, teeth, shoes.', cue: 'After breakfast', setup: 'Put a picture list of the three steps by the bathroom mirror.', finished: 'All three done without a reminder.' },
      middle: { behavior: 'Gets ready on their own and is at the door on time.', cue: 'Right after breakfast', setup: 'Give them a clock or timer where they get ready.', finished: 'At the door on time.' },
      teen: { behavior: 'Runs their own morning, with their own alarm.', cue: 'Their own alarm', finished: 'Out the door on time, no wake-up call.' },
    } },
    { id: 'bedtime-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Picks pajamas and puts toys in the bin before story time.', cue: 'After bath', setup: 'Keep a toy bin where they can reach it.', finished: 'Toys in the bin before the story.' },
      early: { behavior: 'Does the bedtime steps: pajamas, teeth, book ready.', cue: 'After the table is cleared', setup: 'Put a picture list of the steps by their bed.', finished: 'Ready for lights-out without a reminder.' },
      middle: { behavior: 'Gets ready for bed on their own at the agreed time.', cue: 'Screens off', finished: 'In bed at the agreed time.' },
      teen: { behavior: 'Sets their own wind-down time on school nights and keeps it.', cue: 'Their own phone alarm', finished: 'Keeps their bedtime most school nights.' },
    } },
    { id: 'pack-school-bag', category: 'school-prep', byStage: {
      preschool: { behavior: 'Puts their folder and water bottle in their bag.', cue: 'After dinner', setup: 'Put a low hook for their bag by the door.', finished: 'Bag on the hook, folder inside.' },
      early: { behavior: 'Packs their own bag for {school} the night before.', cue: 'After dinner', setup: 'Put a hook by the door at their height.', finished: 'Bag packed and on the hook before bed.' },
      middle: { behavior: 'Packs their bag and checks the calendar for anything extra.', cue: 'After homework', finished: 'Bag packed, extras included.' },
      teen: { behavior: 'Packs their own bag and gear without a check.', cue: 'Before screens at night', finished: 'Nothing forgotten this week.' },
    } },
    { id: 'homework-start', category: 'homework', byStage: {
      early: { behavior: 'Starts homework at the same spot after a snack.', cue: 'After their after-school snack', setup: 'Set up one homework spot with pencils ready.', finished: 'Homework started without a reminder.' },
      middle: { behavior: 'Starts homework on their own and asks for help when stuck.', cue: 'After their snack', setup: 'Keep supplies at the homework spot.', finished: 'Started on their own; asked if stuck.' },
      teen: { behavior: 'Plans their own homework time for the week.', cue: 'Sunday evening, looking at the week', finished: 'Assignments done without a reminder.' },
    } },
    { id: 'tidy-room', category: 'cleaning', byStage: {
      preschool: { behavior: 'Puts toys back in their bins.', cue: 'Before bath', setup: 'Put a picture label on each bin.', finished: 'Floor clear before bath.' },
      early: { behavior: 'Does a five-minute pick-up of their room.', cue: 'Before screen time', setup: 'Put a basket in their room for things that live elsewhere.', finished: 'Floor clear.' },
      middle: { behavior: 'Keeps their room picked up, with a reset once a week.', cue: 'Before weekend screen time', finished: 'Room reset by Sunday.' },
      teen: { behavior: 'Resets their room once a week, their way.', cue: 'A day they choose', finished: 'Floor and bed clear once a week.' },
    } },
    { id: 'put-away-laundry', category: 'laundry', byStage: {
      preschool: { behavior: 'Puts folded clothes in the right drawer.', cue: 'The basket lands on their bed', setup: 'Put picture labels on their drawers.', finished: 'Basket empty.' },
      early: { behavior: 'Puts their clean clothes away.', cue: 'The basket lands in their room', setup: 'Make sure they can open their drawers alone.', finished: 'Basket empty the same day.' },
      middle: { behavior: 'Folds and puts away their own clothes.', cue: 'The day the basket arrives', finished: 'Basket empty the same day.' },
      teen: { behavior: 'Does their own laundry load once a week.', cue: 'Their chosen laundry day', finished: 'Their load washed, dried and put away.' },
    } },
    { id: 'help-with-meals', category: 'meals', byStage: {
      preschool: { behavior: 'Sets out the napkins and spoons.', cue: 'Five minutes before dinner', setup: 'Keep napkins and spoons in a low drawer.', finished: 'Napkins and spoons on the table.' },
      early: { behavior: 'Sets the table.', cue: 'Five minutes before dinner', setup: 'Keep plates and cups on a shelf they can reach.', finished: 'Table set before we sit down.' },
      middle: { behavior: 'Clears and rinses the dishes after dinner.', cue: 'After dinner', finished: 'Dishes rinsed and stacked.' },
      teen: { behavior: 'Helps cook one dinner a week.', cue: 'The dinner night we pick', finished: 'One dinner a week with their help.' },
    } },
    { id: 'own-belongings', category: 'belongings', byStage: {
      preschool: { behavior: 'Puts their shoes and coat in their spot.', cue: 'Coming in the door', setup: 'Put a low hook and a shoe spot by the door.', finished: 'Shoes and coat in their spot.' },
      early: { behavior: 'Hangs up their bag and coat and puts their shoes away.', cue: 'After taking off their shoes', setup: 'Give them their own hook at their height.', finished: 'Nothing on the floor by the door.' },
      middle: { behavior: 'Keeps track of their own gear and water bottle.', cue: 'Coming home', setup: 'Give their gear one home spot.', finished: 'Gear in its spot before dinner.' },
      teen: { behavior: 'Keeps track of their own things, keys and chargers included.', cue: 'Coming home', finished: 'No searching for their things this week.' },
    } },
    { id: 'pet-care', category: 'pet-care', byStage: {
      preschool: { behavior: 'Scoops the pet’s food with a grown-up.', cue: 'At breakfast', finished: 'Pet fed together.' },
      early: { behavior: 'Fills the pet’s water bowl.', cue: 'After breakfast', setup: 'Put the bowl where they can reach it.', finished: 'Water filled each morning.' },
      middle: { behavior: 'Feeds the pet.', cue: 'After breakfast', finished: 'Fed every morning.' },
      teen: { behavior: 'Takes care of the pet’s daily care.', cue: 'Their own morning routine', finished: 'Fed, watered and walked.' },
    } },
  ],

  // No growth item for them: a part tied to this month's shared plan, the family calendar.
  defaults: {
    preschool: [
      { id: 'jan-sticker', category: 'routines', byStage: { preschool: { behavior: 'Puts a sticker on today’s date on the calendar.', cue: 'After breakfast', setup: 'Hang the calendar at their eye level.', finished: 'Today has a sticker.' } } },
      { id: 'jan-shoes', category: 'belongings', byStage: { preschool: { behavior: 'Puts their shoes by the door the night before an outing.', cue: 'After bath', finished: 'Shoes by the door before bed.' } } },
    ],
    early: [
      { id: 'jan-tomorrow', category: 'school-prep', byStage: { early: { behavior: 'Checks tomorrow on the calendar and lays out what they need.', cue: 'After dinner', finished: 'Tomorrow’s things out before bed.' } } },
      { id: 'jan-own-day', category: 'routines', byStage: { early: { behavior: 'Finds their day on the calendar and says what’s on.', cue: 'At breakfast', finished: 'Told someone what’s on today.' } } },
    ],
    middle: [
      { id: 'jan-own-entries', category: 'other', byStage: { middle: { behavior: 'Adds their own activities to the family calendar.', cue: 'As new plans come up', setup: 'Keep a pen by the calendar.', finished: 'Their month is on the calendar.' } } },
      { id: 'jan-check-first', category: 'other', byStage: { middle: { behavior: 'Checks the calendar before asking what’s happening.', cue: 'Before asking “what are we doing?”', finished: 'Knew the plan without asking.' } } },
    ],
    teen: [
      { id: 'jan-own-plans', category: 'transportation', byStage: { teen: { behavior: 'Keeps their own plans on the family calendar, rides included.', cue: 'As they make plans', finished: 'Their month is on the calendar, rides included.' } } },
      { id: 'jan-ask-early', category: 'transportation', byStage: { teen: { behavior: 'Asks for rides or money at least a day ahead.', cue: 'As they make plans', finished: 'No same-day asks this month.' } } },
    ],
    child: [
      { id: 'jan-tomorrow-any', category: 'school-prep', byStage: { child: { behavior: 'Lays out what they need for tomorrow.', cue: 'After dinner', finished: 'Tomorrow’s things out before bed.' } } },
      { id: 'jan-own-day-any', category: 'routines', byStage: { child: { behavior: 'Finds their day on the calendar and says what’s on.', cue: 'At breakfast', finished: 'Told someone what’s on today.' } } },
    ],
  },
  adultHolder: { behavior: 'Adds only their own plans to the calendar; the kids add theirs.', cue: 'As plans are made', finished: 'Their own plans are on it, nobody else’s.' },
  adultOther: [
    { behavior: 'Adds their own work and plans to the calendar.', cue: 'Sunday evening', finished: 'Their week is on the calendar.' },
    { behavior: 'Owns rides and gear for one regular activity.', cue: 'Each week it’s on the calendar', finished: 'That activity is covered all month.' },
  ],
  support: {
    toddler: 'Joins in and watches. No job yet.',
    preschool: 'Do it together the first week, then let them lead.',
    early: 'Show it once; one reminder the first week, then step back.',
    middle: 'On their own. Check in at the next meeting.',
    teen: 'Their way. Check in at the next meeting.',
    adult: '',
    child: 'Start together, then step back.',
  },
  keepsDoing: 'Already takes care of {area}. Keep it up: no new job needed.',
  tryNow: 'Everyone does the first step of their part once, right now. Hang it, lay it out, or write it on the calendar.',
  todosDefault: ['Hang the family calendar where everyone walks past every day.', 'Write next month’s meeting on the calendar.'],
  maxTodos: 2,
  checkIn: 'Next meeting, each person says how their part went: on my own, with reminders, or hard.',

  rhythm: {
    title: 'Our meeting rhythm',
    options: [
      { id: 'sun-lunch', label: 'Sunday after lunch' },
      { id: 'sun-evening', label: 'Sunday evening' },
      { id: 'sat-morning', label: 'Saturday morning' },
      { id: 'fri-dinner', label: 'Friday after dinner' },
      { id: 'weeknight', label: 'A weeknight after dinner' },
    ],
    defaultOption: 'sun-lunch',
    habits: [
      'Once a month, same day and time, so nobody has to call the meeting.',
      'Start with one thing that went well last month.',
      'End on time, even if you didn’t get to everything.',
    ],
  },
};
