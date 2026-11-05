/**
 * January 2027: Our Family Meeting Companion. January is about starting Family Meetings; the reusable four-part
 * framework is the Welcome Kit's Family Meeting guide (src/data/club/meeting-guide.ts), and this is the month's
 * personalized menu of ideas for whichever meetings the family holds in January. Content only; the
 * generator (src/lib/club/meeting-guide/generate.ts) matches it to a family. Rules: src/lib/club/meeting-guide/types.ts.
 *
 * Ids: priorities and challenges from src/data/club/family-profile.ts (PRIORITIES, CHALLENGES); practices keyed by
 * GROWTH_ITEMS id, so what she said she'd like each child to take on becomes that child's part.
 */
import type { GuideMonthContent } from '../../../lib/club/meeting-guide/types';

export const january2027: GuideMonthContent = {
  month: '2027-01',
  title: 'Our Family Meeting Companion',
  subtitle: 'Ideas for this month’s meetings, made for our family. Use what fits, come back to what matters, skip the rest.',
  howTo: 'Your Family Meeting guide explains the four parts. Bring this page to any meeting in January and pick an idea or two from each part.',
  goals: {
    focus: 'What we’re working on together, and why it helps all of us.',
    talk: 'Everyone answers, the youngest first. No wrong answers, no fixing anyone.',
    parts: 'Each person picks or agrees to one small part they own this month.',
    practice: 'Try one part together right now, so the first time isn’t a reminder later.',
  },

  focusByPriority: {
    mornings: { title: 'Calmer mornings', opportunity: 'Everyone gets themselves a little more ready, so mornings aren’t one person’s job.', discuss: 'What would make mornings easier for each of us?' },
    evenings: { title: 'Easier evenings', opportunity: 'Each person owns one small piece of the evening.', discuss: 'What would make our evenings calmer?' },
    activities: { title: 'Sharing activities and rides', opportunity: 'Everyone sees what’s coming, and the kids help get ready for their own activities.', discuss: 'Which activity or ride catches us by surprise most?' },
    'school-stuff': { title: 'School things ready on time', opportunity: 'Kids get their own school things ready the night before.', discuss: 'What do we usually forget for {school}?' },
    tidying: { title: 'A home that stays picked up', opportunity: 'Things have a home, and everyone puts their own things back.', discuss: 'Where do things pile up, and where should they go?' },
    laundry: { title: 'Laundry that doesn’t land on one person', opportunity: 'Each person handles a step of their own laundry.', discuss: 'Where do clothes get stuck on their way back to drawers?' },
    reminding: { title: 'Fewer reminders', opportunity: 'The kids remember their own parts, so one person isn’t everyone’s reminder.', discuss: 'What could each of us remember on our own if we knew when to do it?' },
  },
  focusByChallenge: {
    'knowing-plans': { title: 'Everyone knowing what’s happening', opportunity: 'Nobody is surprised by what’s happening this week.', discuss: 'When did someone last not know what was happening?' },
    preparing: { title: 'Getting ready ahead of time', opportunity: 'Fewer last-minute scrambles on the way out the door.', discuss: 'What do we always end up rushing for?' },
    remembering: { title: 'Knowing who does what', opportunity: 'Everyone knows their own part without being told.', discuss: 'Who does what at our house right now?' },
    routines: { title: 'Smoother daily routines', opportunity: 'Routines the kids know well enough to start on their own.', discuss: 'Which part of our day feels most rushed?' },
    communicating: { title: 'Sharing plans with each other', opportunity: 'Everyone hears about plans before they happen.', discuss: 'How does each of us like to hear about plans?' },
    'sharing-fairly': { title: 'Sharing the work', opportunity: 'The work at home is spread so no one carries most of it.', discuss: 'Which jobs at home could someone else try?' },
  },
  focusDefault: { title: 'Starting our Family Meetings', opportunity: 'A short, regular time when everyone hears the plan and has a say.', discuss: 'What would make this meeting something we all want to come to?' },
  focusGroups: [['reminding', 'remembering'], ['activities', 'knowing-plans', 'communicating'], ['mornings', 'routines', 'preparing'], ['school-stuff', 'preparing'], ['tidying', 'sharing-fairly'], ['laundry', 'sharing-fairly']],
  maxFocus: 2,

  questions: {
    withActivity: 'What’s happening for each of us this week, like {activity}?',
    generic: 'What’s one thing happening this week that everyone should know about?',
  },

  obstacles: {
    'knowing-plans': { obstacle: 'Plans might be living in one person’s head or phone.', principle: 'environment', adjustment: 'Hang the calendar where everyone passes, and add plans the day they’re made.' },
    preparing: { obstacle: 'Getting ready might be happening in the morning rush.', principle: 'environment', adjustment: 'Choose one spot by the door for tomorrow’s things, and fill it after dinner.' },
    remembering: { obstacle: 'Jobs might not have a clear “when”.', principle: 'trigger', adjustment: 'Give each person’s part a “when” that follows something they already do.' },
    routines: { obstacle: 'The routine might have too many steps to own at once.', principle: 'simplicity', adjustment: 'Each person owns one step this month, not the whole routine.' },
    communicating: { obstacle: 'Plans might be getting shared in passing.', principle: 'consistency', adjustment: 'New plans get said out loud at the meeting and written on the calendar that day.' },
    'sharing-fairly': { obstacle: 'Jobs might be falling to whoever notices first.', principle: 'ownership', adjustment: 'Each child chooses their part from two that fit their age.' },
  },
  obstacleOpen: 'What usually gets in our way? Pick one thing to try changing.',
  talkLittle: 'Little ones answer first, by pointing or with one word.',
  maxTalk: 4,

  practices: [
    { id: 'morning-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Gets dressed in the clothes laid out the night before.', cue: 'After breakfast', setup: 'Lay tomorrow’s clothes on a chair they can reach.' },
      early: { behavior: 'Does three morning steps: dressed, teeth, shoes.', cue: 'After breakfast', setup: 'Put a picture list of the three steps by the bathroom mirror.' },
      middle: { behavior: 'Gets ready on their own and is at the door on time.', cue: 'Right after breakfast', setup: 'Give them a clock or timer where they get ready.' },
      teen: { behavior: 'Runs their own morning, with their own alarm.', cue: 'Their own alarm' },
    } },
    { id: 'bedtime-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Picks pajamas and puts toys in the bin before story time.', cue: 'After bath', setup: 'Keep a toy bin where they can reach it.' },
      early: { behavior: 'Does the bedtime steps: pajamas, teeth, book ready.', cue: 'After the table is cleared', setup: 'Put a picture list of the steps by their bed.' },
      middle: { behavior: 'Gets ready for bed on their own at the agreed time.', cue: 'Screens off' },
      teen: { behavior: 'Sets their own wind-down time on school nights and keeps it.', cue: 'Their own phone alarm' },
    } },
    { id: 'pack-school-bag', category: 'school-prep', byStage: {
      preschool: { behavior: 'Puts their folder and water bottle in their bag.', cue: 'After dinner', setup: 'Put a low hook for their bag by the door.' },
      early: { behavior: 'Packs their own bag for {school} the night before.', cue: 'After dinner', setup: 'Put a hook by the door at their height.' },
      middle: { behavior: 'Packs their bag and checks the calendar for anything extra.', cue: 'After homework' },
      teen: { behavior: 'Packs their own bag and gear without a check.', cue: 'Before screens at night' },
    } },
    { id: 'homework-start', category: 'homework', byStage: {
      early: { behavior: 'Starts homework at the same spot after a snack.', cue: 'After their after-school snack', setup: 'Set up one homework spot with pencils ready.' },
      middle: { behavior: 'Starts homework on their own and asks for help when stuck.', cue: 'After their snack', setup: 'Keep supplies at the homework spot.' },
      teen: { behavior: 'Plans their own homework time for the week.', cue: 'Sunday evening, looking at the week' },
    } },
    { id: 'tidy-room', category: 'cleaning', byStage: {
      preschool: { behavior: 'Puts toys back in their bins.', cue: 'Before bath', setup: 'Put a picture label on each bin.' },
      early: { behavior: 'Does a five-minute pick-up of their room.', cue: 'Before screen time', setup: 'Put a basket in their room for things that live elsewhere.' },
      middle: { behavior: 'Keeps their room picked up, with a reset once a week.', cue: 'Before weekend screen time' },
      teen: { behavior: 'Resets their room once a week, their way.', cue: 'A day they choose' },
    } },
    { id: 'put-away-laundry', category: 'laundry', byStage: {
      preschool: { behavior: 'Puts folded clothes in the right drawer.', cue: 'The basket lands on their bed', setup: 'Put picture labels on their drawers.' },
      early: { behavior: 'Puts their clean clothes away.', cue: 'The basket lands in their room', setup: 'Make sure they can open their drawers alone.' },
      middle: { behavior: 'Folds and puts away their own clothes.', cue: 'The day the basket arrives' },
      teen: { behavior: 'Does their own laundry load once a week.', cue: 'Their chosen laundry day' },
    } },
    { id: 'help-with-meals', category: 'meals', byStage: {
      preschool: { behavior: 'Sets out the napkins and spoons.', cue: 'Five minutes before dinner', setup: 'Keep napkins and spoons in a low drawer.' },
      early: { behavior: 'Sets the table.', cue: 'Five minutes before dinner', setup: 'Keep plates and cups on a shelf they can reach.' },
      middle: { behavior: 'Clears and rinses the dishes after dinner.', cue: 'After dinner' },
      teen: { behavior: 'Helps cook one dinner a week.', cue: 'The dinner night we pick' },
    } },
    { id: 'own-belongings', category: 'belongings', byStage: {
      preschool: { behavior: 'Puts their shoes and coat in their spot.', cue: 'Coming in the door', setup: 'Put a low hook and a shoe spot by the door.' },
      early: { behavior: 'Hangs up their bag and coat and puts their shoes away.', cue: 'After taking off their shoes', setup: 'Give them their own hook at their height.' },
      middle: { behavior: 'Keeps track of their own gear and water bottle.', cue: 'Coming home', setup: 'Give their gear one home spot.' },
      teen: { behavior: 'Keeps track of their own things, keys and chargers included.', cue: 'Coming home' },
    } },
    { id: 'pet-care', category: 'pet-care', byStage: {
      preschool: { behavior: 'Scoops the pet’s food with a grown-up.', cue: 'At breakfast' },
      early: { behavior: 'Fills the pet’s water bowl.', cue: 'After breakfast', setup: 'Put the bowl where they can reach it.' },
      middle: { behavior: 'Feeds the pet.', cue: 'After breakfast' },
      teen: { behavior: 'Takes care of the pet’s daily care.', cue: 'Their own morning routine' },
    } },
  ],

  // No growth item for them: a part tied to this month's shared plan, the family calendar.
  defaults: {
    preschool: [
      { id: 'jan-sticker', category: 'routines', byStage: { preschool: { behavior: 'Puts a sticker on today’s date on the calendar.', cue: 'After breakfast', setup: 'Hang the calendar at their eye level.' } } },
      { id: 'jan-shoes', category: 'belongings', byStage: { preschool: { behavior: 'Puts their shoes by the door the night before an outing.', cue: 'After bath' } } },
    ],
    early: [
      { id: 'jan-tomorrow', category: 'school-prep', byStage: { early: { behavior: 'Checks tomorrow on the calendar and lays out what they need.', cue: 'After dinner' } } },
      { id: 'jan-own-day', category: 'routines', byStage: { early: { behavior: 'Finds their day on the calendar and says what’s on.', cue: 'At breakfast' } } },
    ],
    middle: [
      { id: 'jan-own-entries', category: 'other', byStage: { middle: { behavior: 'Adds their own activities to the family calendar.', cue: 'As new plans come up', setup: 'Keep a pen by the calendar.' } } },
      { id: 'jan-check-first', category: 'other', byStage: { middle: { behavior: 'Checks the calendar before asking what’s happening.', cue: 'Before asking “what are we doing?”' } } },
    ],
    teen: [
      { id: 'jan-own-plans', category: 'transportation', byStage: { teen: { behavior: 'Keeps their own plans on the family calendar, rides included.', cue: 'As they make plans' } } },
      { id: 'jan-ask-early', category: 'transportation', byStage: { teen: { behavior: 'Asks for rides or money at least a day ahead.', cue: 'As they make plans' } } },
    ],
    child: [
      { id: 'jan-tomorrow-any', category: 'school-prep', byStage: { child: { behavior: 'Lays out what they need for tomorrow.', cue: 'After dinner' } } },
      { id: 'jan-own-day-any', category: 'routines', byStage: { child: { behavior: 'Finds their day on the calendar and says what’s on.', cue: 'At breakfast' } } },
    ],
  },
  maxIdeas: 2,
  partsNote: 'Ideas to choose from, not jobs. Decide together; one small part each is plenty.',
  support: {
    toddler: 'Joins in and watches.',
    preschool: 'Do it together at first, then let them lead.',
    early: 'Show it once, then step back.',
    middle: 'Can do it on their own.',
    teen: 'Their way, their call.',
    adult: '',
    child: 'Start together, then step back.',
  },
  keepsDoing: '{name} already takes care of {area}. Notice it out loud.',
  grownUps: 'Add your own plans to the calendar, and leave the kids’ plans to them.',
  practice: {
    tryNow: 'Try a part once, right now, while everyone’s together.',
    stack: 'Give each part a clear “when” that follows something already done: {example}',
    setupLead: 'Make it easy',
    simplify: 'If a part keeps slipping, make it smaller instead of reminding more.',
  },
  maxPractice: 4,
  checkIn: 'At a later meeting, come back to a part: on my own, with reminders, or hard? Keep it, shrink it or swap it.',
};
