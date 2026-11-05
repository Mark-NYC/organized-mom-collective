/**
 * January 2027: Our Family Meeting Companion. January is about starting Family Meetings; the reusable four-part
 * framework is the Welcome Kit's Family Meeting guide (src/data/club/meeting-guide.ts), and this is the month's
 * personalized menu of ideas for whichever meetings the family holds in January. Content only; the
 * generator (src/lib/club/meeting-guide/generate.ts) matches it to a family. Rules: src/lib/club/meeting-guide/types.ts.
 *
 * Ids: priorities and challenges from src/data/club/family-profile.ts (PRIORITIES, CHALLENGES); practices keyed by
 * GROWTH_ITEMS id, so what she said she'd like each child to take on is offered to that child first.
 */
import type { GuideMonthContent } from '../../../lib/club/meeting-guide/types';

export const january2027: GuideMonthContent = {
  month: '2027-01',
  title: 'Our Family Meeting Companion',
  subtitle: 'Ideas for our January Family Meetings.',
  howTo: 'Use the four parts from your Family Meeting guide. Pick what fits at each meeting, come back to what matters, skip the rest.',
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
    preparing: { obstacle: 'Getting ready might be happening in the morning rush.', principle: 'environment', adjustment: 'A spot by the door for tomorrow’s things, filled after dinner.' },
    remembering: { obstacle: 'Jobs might not have a clear “when”.', principle: 'trigger', adjustment: 'Tie each part to something that already happens, like after dinner or coming in the door.' },
    routines: { obstacle: 'The routine might have too many steps to own at once.', principle: 'simplicity', adjustment: 'Each person takes one step of the routine instead of the whole thing.' },
    communicating: { obstacle: 'Plans might be getting shared in passing.', principle: 'consistency', adjustment: 'Share new plans at a meeting and write them on the calendar that day.' },
    'sharing-fairly': { obstacle: 'Jobs might be falling to whoever notices first.', principle: 'ownership', adjustment: 'Let each child choose a part from two that fit their age.' },
  },
  obstacleOpen: 'What usually gets in our way? Pick one thing to try changing.',
  talkLittle: 'Little ones can point or answer with one word.',
  maxTalk: 4,

  // Ideas read under a child's name, so they're written as plain actions with no pronouns.
  practices: [
    { id: 'morning-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Get dressed in clothes laid out the night before.', cue: 'After breakfast', setup: 'Tomorrow’s clothes on a chair within reach.' },
      early: { behavior: 'Three morning steps: dressed, teeth, shoes.', cue: 'After breakfast', setup: 'A picture list of the three steps by the mirror.' },
      middle: { behavior: 'Get ready solo and be at the door on time.', cue: 'Right after breakfast', setup: 'A clock or timer where getting ready happens.' },
      teen: { behavior: 'Run the whole morning, alarm included.', cue: 'A self-set alarm' },
    } },
    { id: 'bedtime-routine', category: 'routines', byStage: {
      preschool: { behavior: 'Pick pajamas and put toys in the bin before story time.', cue: 'After bath', setup: 'A toy bin within reach.' },
      early: { behavior: 'Bedtime steps: pajamas, teeth, book ready.', cue: 'After the table is cleared', setup: 'A picture list of the steps by the bed.' },
      middle: { behavior: 'Get ready for bed solo at the agreed time.', cue: 'Screens off' },
      teen: { behavior: 'Set a school-night wind-down time and keep it.', cue: 'A phone alarm' },
    } },
    { id: 'pack-school-bag', category: 'school-prep', byStage: {
      preschool: { behavior: 'Put the folder and water bottle in the bag.', cue: 'After dinner', setup: 'A low hook for the bag by the door.' },
      early: { behavior: 'Pack the {school} bag the night before.', cue: 'After dinner', setup: 'A hook by the door at the right height.' },
      middle: { behavior: 'Pack the bag and check the calendar for anything extra.', cue: 'After homework' },
      teen: { behavior: 'Pack bag and gear without a check.', cue: 'Before screens at night' },
    } },
    { id: 'homework-start', category: 'homework', byStage: {
      early: { behavior: 'Start homework at the same spot after a snack.', cue: 'After the after-school snack', setup: 'One homework spot with pencils ready.' },
      middle: { behavior: 'Start homework solo, and ask for help when stuck.', cue: 'After the after-school snack', setup: 'Supplies kept at the homework spot.' },
      teen: { behavior: 'Plan homework time for the week.', cue: 'Sunday evening, looking at the week' },
    } },
    { id: 'tidy-room', category: 'cleaning', byStage: {
      preschool: { behavior: 'Put toys back in the bins.', cue: 'Before bath', setup: 'A picture label on each bin.' },
      early: { behavior: 'A five-minute bedroom pick-up.', cue: 'Before screen time', setup: 'A basket for things that live elsewhere.' },
      middle: { behavior: 'Keep the bedroom picked up, with a weekly reset.', cue: 'Before weekend screen time' },
      teen: { behavior: 'A weekly bedroom reset, done any way that works.', cue: 'A day picked ahead' },
    } },
    { id: 'put-away-laundry', category: 'laundry', byStage: {
      preschool: { behavior: 'Put folded clothes in the right drawer.', cue: 'When the basket arrives', setup: 'Picture labels on the drawers.' },
      early: { behavior: 'Put clean clothes away.', cue: 'When the basket arrives', setup: 'Drawers that open without help.' },
      middle: { behavior: 'Fold and put away clean clothes.', cue: 'The day the basket arrives' },
      teen: { behavior: 'Wash, dry and put away one load a week.', cue: 'A set laundry day' },
    } },
    { id: 'help-with-meals', category: 'meals', byStage: {
      preschool: { behavior: 'Set out the napkins and spoons.', cue: 'Five minutes before dinner', setup: 'Napkins and spoons in a low drawer.' },
      early: { behavior: 'Set the table.', cue: 'Five minutes before dinner', setup: 'Plates and cups on a reachable shelf.' },
      middle: { behavior: 'Clear and rinse the dishes after dinner.', cue: 'After dinner' },
      teen: { behavior: 'Help cook one dinner a week.', cue: 'A dinner night picked together' },
    } },
    { id: 'own-belongings', category: 'belongings', byStage: {
      preschool: { behavior: 'Coat on the hook, shoes in the shoe spot.', cue: 'Coming in the door', setup: 'A low hook and a shoe spot by the door.' },
      early: { behavior: 'Hang up the bag and coat, and put shoes away.', cue: 'Coming in the door', setup: 'A hook at the right height.' },
      middle: { behavior: 'Keep track of gear and water bottle.', cue: 'Coming home', setup: 'One home spot for gear.' },
      teen: { behavior: 'Keep track of keys, chargers and gear.', cue: 'Coming home' },
    } },
    { id: 'pet-care', category: 'pet-care', byStage: {
      preschool: { behavior: 'Scoop the pet’s food with a grown-up.', cue: 'At breakfast' },
      early: { behavior: 'Fill the pet’s water bowl.', cue: 'After breakfast', setup: 'The bowl somewhere easy to reach.' },
      middle: { behavior: 'Feed the pet.', cue: 'After breakfast' },
      teen: { behavior: 'Handle the pet’s daily care.', cue: 'Part of the morning' },
    } },
  ],

  // No growth item named for a child: ideas tied to this month's theme, the shared family calendar.
  defaults: {
    preschool: [
      { id: 'jan-sticker', category: 'routines', byStage: { preschool: { behavior: 'Put a sticker on today’s date on the calendar.', cue: 'After breakfast', setup: 'The calendar hung at eye level.' } } },
      { id: 'jan-shoes', category: 'belongings', byStage: { preschool: { behavior: 'Line up shoes by the door the night before an outing.', cue: 'After bath' } } },
    ],
    early: [
      { id: 'jan-tomorrow', category: 'school-prep', byStage: { early: { behavior: 'Check tomorrow on the calendar and lay out what’s needed.', cue: 'After dinner' } } },
      { id: 'jan-own-day', category: 'routines', byStage: { early: { behavior: 'Find today on the calendar and share what’s on.', cue: 'At breakfast' } } },
    ],
    middle: [
      { id: 'jan-own-entries', category: 'other', byStage: { middle: { behavior: 'Add new activities to the family calendar.', cue: 'As new plans come up', setup: 'A pen kept by the calendar.' } } },
      { id: 'jan-check-first', category: 'other', byStage: { middle: { behavior: 'Check the calendar before asking what’s happening.', cue: 'Before asking “what are we doing?”' } } },
    ],
    teen: [
      { id: 'jan-own-plans', category: 'transportation', byStage: { teen: { behavior: 'Keep plans on the family calendar, rides included.', cue: 'As plans are made' } } },
      { id: 'jan-ask-early', category: 'transportation', byStage: { teen: { behavior: 'Ask for rides or money at least a day ahead.', cue: 'As plans are made' } } },
    ],
    child: [
      { id: 'jan-tomorrow-any', category: 'school-prep', byStage: { child: { behavior: 'Lay out what’s needed for tomorrow.', cue: 'After dinner' } } },
      { id: 'jan-own-day-any', category: 'routines', byStage: { child: { behavior: 'Find today on the calendar and share what’s on.', cue: 'At breakfast' } } },
    ],
  },
  maxIdeas: 2,
  partsNote: 'Ideas to choose from, not jobs. Decide together.',
  support: {
    toddler: 'Joins in and watches.',
    preschool: 'Do it together at first, then step back.',
    early: 'Show it once, then step back.',
    middle: 'Ready for more independence.',
    teen: 'Free to choose how and when.',
    adult: '',
    child: 'Start together, then step back.',
  },
  keepsDoing: '{name} already takes care of {area}. Worth noticing out loud.',
  grownUps: 'For the grown-ups to talk through: how will we help without taking over, and how will we notice the effort?',
  practice: {
    tryNow: 'If there’s time, try a part together before the meeting ends.',
    stack: 'It can help to tie a part to something that already happens. For {example}',
    setupLead: 'To make it easier',
    simplify: 'If a part keeps slipping, try a smaller version before adding reminders.',
  },
  maxPractice: 4,
  checkIn: 'At a later meeting, you might check how a part is going: on my own, with reminders, or hard. Keep it, shrink it or swap it.',
};
