/**
 * January 2027: Our Family Focus. January is about starting Family Meetings; the reusable four-part
 * framework is the Welcome Kit's Family Meeting guide (src/data/club/meeting-guide.ts), and this is the month's
 * personalized companion for whichever meetings the family holds in January.
 *
 * January-specific: its opportunities and copy, its theme limits (at most two experiments, school in session) and its
 * starting point for families who told us little (the Family Meeting habit). Behaviors come from the shared library
 * (src/data/club/habit-library.ts); selection is month-independent (src/lib/club/habits/).
 */
import { HABIT_LIBRARY } from '../habit-library';
import type { GuideMonthContent } from '../../../lib/club/meeting-guide/types';

export const january2027: GuideMonthContent = {
  month: '2027-01',
  title: 'Our Family Focus',
  subtitle: 'Ideas for our January Family Meetings.',
  howTo: 'Use the four parts from your Family Meeting guide. Pick what fits at each meeting, come back to what matters, skip the rest.',
  goals: {
    focus: 'What we’re working on together, and why it helps all of us.',
    talk: 'Everyone answers, the youngest first. No wrong answers, no fixing anyone.',
    parts: 'Each person picks or agrees to one small part they own this month.',
    practice: 'Try one part together right now, so the first time isn’t a reminder later.',
  },
  theme: { month: '2027-01', schoolInSession: true, maxExperiments: 2, sharedFrom: 3, allowed: HABIT_LIBRARY.map((h) => h.id) },

  opportunities: [
    { id: 'mornings', title: 'Calmer mornings', opportunity: 'Each child gets a little more of their own morning done without being told.',
      discuss: 'What’s the trickiest part of our mornings?', discover: 'What usually gets in the way in the morning: forgetting a step, running out of time, or something else?',
      priorities: ['mornings'], challenges: ['routines', 'preparing'], items: ['morning-routine', 'pack-school-bag', 'own-belongings'] },
    { id: 'evenings', title: 'Easier evenings', opportunity: 'Each person takes one small piece of the evening.',
      discuss: 'What would make our evenings calmer?', discover: 'What usually gets in the way in the evening: too much at once, tired kids, or something else?',
      priorities: ['evenings'], challenges: ['routines'], items: ['bedtime-routine', 'pack-school-bag', 'help-with-meals', 'tidy-room', 'own-belongings'] },
    { id: 'school', title: 'School things ready on time', opportunity: 'The kids get their own {school} things ready the night before.',
      discuss: 'What do we usually forget for {school}?', discover: 'What gets in the way of having {school} things ready: no set time, no set spot, or something else?',
      priorities: ['school-stuff'], challenges: ['preparing'], items: ['pack-school-bag', 'homework-start'] },
    { id: 'schedules', title: 'Everyone knowing the plan', opportunity: 'Nobody is surprised by what’s happening this week, and the kids get ready for their own activities.',
      discuss: 'Which activity or ride catches us by surprise most?', discover: 'Where do plans get lost between us?',
      priorities: ['activities'], challenges: ['knowing-plans', 'communicating'], items: ['activity-gear', 'calendar-check', 'own-belongings'] },
    { id: 'reminders', title: 'Fewer reminders', opportunity: 'The kids know when their part happens, so one person isn’t everyone’s reminder.',
      discuss: 'What do we remind each other about most?', discover: 'What usually makes a reminder necessary: no clear time, too many steps, or something else?',
      askFirst: 'Ask {names} which job they hear the most reminders about, then give that job a clear “when” together.',
      priorities: ['reminding'], challenges: ['remembering'], items: ['own-belongings', 'pack-school-bag', 'morning-routine', 'bedtime-routine', 'tidy-room', 'put-away-laundry', 'help-with-meals', 'pet-care', 'homework-start'] },
    { id: 'home', title: 'A home that stays picked up', opportunity: 'Things have a home, and everyone puts their own things back.',
      discuss: 'Where do things pile up, and where should they live?', discover: 'What makes putting things away hard: no set spot, the spot is out of reach, or something else?',
      priorities: ['tidying'], challenges: ['sharing-fairly'], items: ['tidy-room', 'own-belongings'] },
    { id: 'laundry', title: 'Laundry that doesn’t land on one person', opportunity: 'Each child handles one step of their own laundry.',
      discuss: 'Where do clothes get stuck on their way back to drawers?', discover: 'Which laundry step gets skipped: sorting, folding or putting away?',
      priorities: ['laundry'], challenges: [], items: ['put-away-laundry'] },
    { id: 'sharing', title: 'Sharing the work at home', opportunity: 'The work is spread so no one carries most of it, and the kids choose their part.',
      discuss: 'Which jobs at home could someone else try?', discover: 'What makes it hard to pitch in: not knowing what to do, not wanting to, or something else?',
      priorities: [], challenges: ['sharing-fairly'], items: ['help-with-meals', 'tidy-room', 'put-away-laundry', 'pet-care'] },
  ],
  fallback: { id: 'meetings', title: 'Starting our Family Meeting habit', opportunity: 'A short, regular time when everyone hears the plan and has a say. It’s the habit that makes every other one easier.',
    discuss: 'What’s one thing that makes our weeks harder than they need to be?', discover: 'What would each of us like to do more on our own this month?',
    priorities: [], challenges: [], items: [] },
  // Too little intake: January's own habit, and one clearly framed idea to consider.
  starter: { sharedId: 'family-meeting', considerId: 'calendar-check' },
  ownWordsDiscuss: 'What’s one small step toward this we could try this month?',

  obstacles: {
    'knowing-plans': { obstacle: 'plans might be living in one person’s head or phone.', principle: 'environment', adjustment: 'hang the calendar where everyone passes, and add plans the day they’re made.' },
    preparing: { obstacle: 'getting ready might be happening in the morning rush.', principle: 'stacking', adjustment: 'a spot by the door for tomorrow’s things, filled the evening before.' },
    remembering: { obstacle: 'jobs might not have a clear “when”.', principle: 'trigger', adjustment: 'tie each job to something that already happens every day.' },
    routines: { obstacle: 'the routine might have too many steps to own at once.', principle: 'simplicity', adjustment: 'start with one step of the routine instead of the whole thing.' },
    communicating: { obstacle: 'plans might be getting shared in passing.', principle: 'consistency', adjustment: 'share new plans at a meeting and write them on the calendar that day.' },
    'sharing-fairly': { obstacle: 'jobs might be falling to whoever notices first.', principle: 'ownership', adjustment: 'let each child choose a part from two that fit their age.' },
  },

  talkLittle: 'Little ones can point or answer with one word.',
  invite: 'Ask {names}: would these help, or what would you try instead?',
  weekQuestion: { withActivity: 'What’s happening for each of us this week, like {activity}?', generic: 'What’s one thing happening this week that everyone should know about?' },
  experimentsLabel: 'Habit experiments to discuss',
  experimentsNote: 'To talk over and try, not assignments. One is plenty to start.',
  considerNote: 'Something to consider: an idea for this age, not a known need.',
  starterNote: 'Start with the meeting itself, and one small idea to try now. Suggestions, not assignments.',
  anchorOptions: 'When, your pick',
  keepsDoing: '{name} already takes care of {area}. Worth noticing out loud.',
  showHow: '{name} already takes care of {area}. Ask {name} to show everyone how, instead of adding a new job.',
  partsDiscover: 'Ask {names} to pick one small part to try this month.',
  grownUps: 'For the grown-ups to talk through: how will we help without taking over, and how will we notice the effort?',
  practice: {
    tryNow: 'Try the first step together before the meeting ends.',
    adjustmentLead: 'If it gets stuck',
    sustain: {
      reminders: 'Before reminding, try asking “What’s next?” and let the answer come from the kids.',
      default: 'When it’s going well, say so, and hold off on adding a new job.',
    },
  },
  checkIn: 'At the next meeting: on my own, with reminders, or hard? Keep it, shrink it or swap it.',
  focusPage: {
    title: 'Our Family Focus',
    monthPurpose: 'January is about starting our Family Meeting, and using it to work on one thing together.',
    words: [
      { word: 'Notice', question: 'What needs our attention?' },
      { word: 'Choose', question: 'What small responsibility can we own?' },
      { word: 'Practice', question: 'What can we keep doing until it’s easier?' },
      { word: 'Grow', question: 'What’s changing because we’re practicing?' },
    ],
    wordsNote: 'One word for each week’s meeting, all about the same focus. Write it in the calendar’s Word of the Week space; a fifth week can repeat a favorite.',
    bringIt: ['Talk about the focus', 'Choose what to try', 'Celebrate what’s working', 'Adjust what isn’t', 'Add it to the wall calendar, in everyone’s colors'],
  },
};
