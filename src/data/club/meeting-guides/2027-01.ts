/**
 * January 2027: Our Family Meeting Companion. January is about starting Family Meetings; the reusable four-part
 * framework is the Welcome Kit's Family Meeting guide (src/data/club/meeting-guide.ts), and this is the month's
 * personalized menu of ideas for whichever meetings the family holds in January. Content only; the generator
 * (src/lib/club/meeting-guide/generate.ts) scores it against her intake. Rules: src/lib/club/meeting-guide/types.ts.
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

  opportunities: [
    { id: 'mornings', title: 'Calmer mornings', opportunity: 'Each child gets a little more of their own morning done without being told.',
      discuss: 'What’s the trickiest part of our mornings?', discover: 'What usually gets in the way in the morning: forgetting a step, running out of time, or something else?',
      priorities: ['mornings'], challenges: ['routines', 'preparing'], items: ['morning-routine', 'pack-school-bag', 'own-belongings'] },
    { id: 'evenings', title: 'Easier evenings', opportunity: 'Each person takes one small piece of the evening.',
      discuss: 'What would make our evenings calmer?', discover: 'What usually gets in the way in the evening: too much at once, tired kids, or something else?',
      priorities: ['evenings'], challenges: ['routines'], items: ['bedtime-routine', 'help-with-meals', 'tidy-room', 'own-belongings'] },
    { id: 'school', title: 'School things ready on time', opportunity: 'The kids get their own {school} things ready the night before.',
      discuss: 'What do we usually forget for {school}?', discover: 'What gets in the way of having {school} things ready: no set time, no set spot, or something else?',
      priorities: ['school-stuff'], challenges: ['preparing'], items: ['pack-school-bag', 'homework-start'] },
    { id: 'schedules', title: 'Everyone knowing the plan', opportunity: 'Nobody is surprised by what’s happening this week, and the kids get ready for their own activities.',
      discuss: 'Which activity or ride catches us by surprise most?', discover: 'Where do plans get lost between us?',
      priorities: ['activities'], challenges: ['knowing-plans', 'communicating'], items: ['jan-calendar', 'own-belongings', 'jan-today'] },
    { id: 'reminders', title: 'Fewer reminders', opportunity: 'The kids know when their part happens, so one person isn’t everyone’s reminder.',
      discuss: 'What do we remind each other about most?', discover: 'What usually makes a reminder necessary: no clear time, too many steps, or something else?',
      askFirst: 'Ask {names} which job they hear the most reminders about, then give that job a clear “when” together.',
      priorities: ['reminding'], challenges: ['remembering'], items: ['jan-calendar', 'own-belongings', 'pack-school-bag', 'morning-routine', 'bedtime-routine', 'tidy-room', 'put-away-laundry', 'help-with-meals', 'pet-care', 'homework-start'] },
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
  fallback: { id: 'meetings', title: 'Starting our Family Meetings', opportunity: 'A short, regular time when everyone hears the plan and has a say.',
    discuss: 'What’s one thing that makes our weeks harder than they need to be?', discover: 'What would each of us like to do more on our own this month?',
    priorities: [], challenges: [], items: ['jan-calendar', 'jan-today'] },
  ownWordsDiscuss: 'What’s one small step toward this we could try this month?',

  obstacles: {
    'knowing-plans': { obstacle: 'plans might be living in one person’s head or phone.', principle: 'environment', adjustment: 'hang the calendar where everyone passes, and add plans the day they’re made.' },
    preparing: { obstacle: 'getting ready might be happening in the morning rush.', principle: 'stacking', adjustment: 'a spot by the door for tomorrow’s things, filled after dinner.' },
    remembering: { obstacle: 'jobs might not have a clear “when”.', principle: 'trigger', adjustment: 'tie each part to something that already happens, like after dinner or coming in the door.' },
    routines: { obstacle: 'the routine might have too many steps to own at once.', principle: 'simplicity', adjustment: 'each child takes one step of the routine instead of the whole thing.' },
    communicating: { obstacle: 'plans might be getting shared in passing.', principle: 'consistency', adjustment: 'share new plans at a meeting and write them on the calendar that day.' },
    'sharing-fairly': { obstacle: 'jobs might be falling to whoever notices first.', principle: 'ownership', adjustment: 'let each child choose a part from two that fit their age.' },
  },

  // Each `try` is one small habit with its cue built in. The `ask` brings the child into solving it.
  practices: [
    { id: 'morning-routine', category: 'routines', ask: 'Ask {name} which part of the morning is hardest to remember.', byStage: {
      preschool: { try: 'Get dressed in clothes laid out on a chair the night before.', cue: 'After breakfast', setup: 'a chair for tomorrow’s clothes', principle: 'environment' },
      early: { try: 'After breakfast: dressed, teeth, shoes, following a picture list by the mirror.', cue: 'After breakfast', setup: 'a three-step picture list by the mirror', principle: 'simplicity' },
      middle: { try: 'Get ready solo after breakfast, with a clock in view, and be at the door on time.', cue: 'After breakfast', setup: 'a clock where getting ready happens', principle: 'trigger' },
      teen: { try: 'Run the whole morning, starting with a self-set alarm.', cue: 'Own alarm', principle: 'ownership' },
    } },
    { id: 'bedtime-routine', category: 'routines', ask: 'Ask {name} which bedtime step usually gets skipped.', byStage: {
      preschool: { try: 'After bath, pick pajamas and put toys in the bin before the story.', cue: 'After bath', setup: 'a toy bin within reach', principle: 'stacking' },
      early: { try: 'After the table is cleared: pajamas, teeth, book ready, from a picture list by the bed.', cue: 'After the table is cleared', setup: 'a picture list by the bed', principle: 'simplicity' },
      middle: { try: 'Screens off, then ready for bed solo by the agreed time.', cue: 'Screens off', principle: 'stacking' },
      teen: { try: 'Set a school-night wind-down time and keep it most nights.', cue: 'A phone alarm', principle: 'ownership' },
    } },
    { id: 'pack-school-bag', category: 'school-prep', ask: 'Ask {name} what usually gets forgotten for {school}.', byStage: {
      preschool: { try: 'After dinner, put the folder and water bottle in the bag, together at first.', cue: 'After dinner', setup: 'a low hook for the bag by the door', principle: 'environment' },
      early: { try: 'Pack the bag after dinner and hang it on a hook by the door, next to the shoes.', cue: 'After dinner', setup: 'a hook by the door at the right height', principle: 'stacking' },
      middle: { try: 'After homework, pack the bag and check the calendar for anything extra.', cue: 'After homework', principle: 'stacking' },
      teen: { try: 'Pack bag and gear the night before, without a check.', cue: 'Before screens at night', principle: 'ownership' },
    } },
    { id: 'homework-start', category: 'homework', ask: 'Ask {name} what makes homework hard to start.', byStage: {
      early: { try: 'Start homework at the same spot right after the after-school snack.', cue: 'After the snack', setup: 'one homework spot with pencils ready', principle: 'stacking' },
      middle: { try: 'Start homework solo after the snack, and ask for help when stuck.', cue: 'After the snack', setup: 'supplies kept at the homework spot', principle: 'stacking' },
      teen: { try: 'Sunday evening, plan the week’s homework time.', cue: 'Sunday evening', principle: 'ownership' },
    } },
    { id: 'tidy-room', category: 'cleaning', ask: 'Ask {name} where things usually end up instead of put away.', byStage: {
      preschool: { try: 'Before bath, put toys back in bins with picture labels.', cue: 'Before bath', setup: 'a picture label on each bin', principle: 'environment' },
      early: { try: 'A five-minute bedroom pick-up before screen time.', cue: 'Before screen time', setup: 'a basket for things that live elsewhere', principle: 'stacking' },
      middle: { try: 'A weekly bedroom reset before weekend screen time.', cue: 'Before weekend screen time', principle: 'stacking' },
      teen: { try: 'A weekly bedroom reset, any way that works, on a day picked ahead.', cue: 'A day picked ahead', principle: 'ownership' },
    } },
    { id: 'put-away-laundry', category: 'laundry', ask: 'Ask {name} what makes putting clothes away a hassle.', byStage: {
      preschool: { try: 'Put folded clothes in drawers with picture labels, together at first.', cue: 'When the basket arrives', setup: 'picture labels on the drawers', principle: 'environment' },
      early: { try: 'Put clean clothes away the day the basket arrives.', cue: 'When the basket arrives', setup: 'drawers that open without help', principle: 'environment' },
      middle: { try: 'Fold and put away clean clothes the day the basket arrives.', cue: 'When the basket arrives', principle: 'trigger' },
      teen: { try: 'Wash, dry and put away one load a week, on a set day.', cue: 'A set laundry day', principle: 'ownership' },
    } },
    { id: 'help-with-meals', category: 'meals', ask: 'Ask {name} which dinner job sounds best.', byStage: {
      preschool: { try: 'Five minutes before dinner, set out napkins and spoons from a low drawer.', cue: 'Five minutes before dinner', setup: 'napkins and spoons in a low drawer', principle: 'environment' },
      early: { try: 'Set the table when dinner is five minutes away.', cue: 'Five minutes before dinner', setup: 'plates and cups on a reachable shelf', principle: 'trigger' },
      middle: { try: 'Clear and rinse the dishes right after dinner.', cue: 'After dinner', principle: 'stacking' },
      teen: { try: 'Help cook one dinner a week, on a night picked together.', cue: 'A dinner night picked together', principle: 'ownership' },
    } },
    { id: 'own-belongings', category: 'belongings', ask: 'Ask {name} which things go missing most often.', byStage: {
      preschool: { try: 'Coming in the door, coat on the low hook and shoes in the shoe spot.', cue: 'Coming in the door', setup: 'a low hook and a shoe spot by the door', principle: 'environment' },
      early: { try: 'Coming in the door, hang up the bag and coat and put shoes away.', cue: 'Coming in the door', setup: 'a hook at the right height', principle: 'stacking' },
      middle: { try: 'Coming home, put gear and water bottle in one home spot.', cue: 'Coming home', setup: 'one home spot for gear', principle: 'environment' },
      teen: { try: 'Coming home, keys, chargers and gear go in one spot.', cue: 'Coming home', principle: 'stacking' },
    } },
    { id: 'pet-care', category: 'pet-care', ask: 'Ask {name} which part of caring for the pet sounds best.', byStage: {
      preschool: { try: 'At breakfast, scoop the pet’s food with a grown-up.', cue: 'At breakfast', principle: 'stacking' },
      early: { try: 'After breakfast, fill the pet’s water bowl.', cue: 'After breakfast', setup: 'the bowl somewhere easy to reach', principle: 'stacking' },
      middle: { try: 'Feed the pet right after breakfast.', cue: 'After breakfast', principle: 'stacking' },
      teen: { try: 'Handle the pet’s daily care as part of the morning.', cue: 'Part of the morning', principle: 'ownership' },
    } },
    // January's own: the shared family calendar (for schedules, and families who told us little).
    { id: 'jan-calendar', category: 'other', ask: 'Ask {name} what’s coming up that everyone should know.', byStage: {
      preschool: { try: 'After breakfast, put a sticker on today’s date on the calendar.', cue: 'After breakfast', setup: 'the calendar hung at eye level', principle: 'feedback' },
      early: { try: 'After dinner, check tomorrow on the calendar and lay out what’s needed.', cue: 'After dinner', principle: 'stacking' },
      middle: { try: 'Add each new activity to the family calendar the same day.', cue: 'As new plans come up', setup: 'a pen kept by the calendar', principle: 'trigger' },
      teen: { try: 'Keep plans on the family calendar, rides included, and ask for rides a day ahead.', cue: 'As plans are made', principle: 'ownership' },
    } },
    { id: 'jan-today', category: 'other', ask: 'Ask {name} what would help everyone know the plan for the day.', byStage: {
      preschool: { try: 'At breakfast, point to today on the calendar and say one thing that’s happening.', cue: 'At breakfast', principle: 'feedback' },
      early: { try: 'At breakfast, find today on the calendar and share what’s on.', cue: 'At breakfast', principle: 'stacking' },
      middle: { try: 'Before asking “what are we doing?”, check the calendar first.', cue: 'Before asking', principle: 'trigger' },
      teen: { try: 'Read out the week ahead from the calendar at a meeting.', cue: 'At the meeting', principle: 'ownership' },
    } },
  ],

  talkLittle: 'Little ones can point or answer with one word.',
  invite: 'Kids first: what would make it easier?',
  partsNote: 'Ideas to choose from, not jobs. Decide together.',
  partsDiscover: 'Ask {names} what to take on this month, then pick one small part together.',
  weekQuestion: { withActivity: 'What’s happening for each of us this week, like {activity}?', generic: 'What’s one thing happening this week that everyone should know about?' },
  keepsDoing: '{name} already takes care of {area}. Worth noticing out loud.',
  showHow: '{name} already takes care of {area}. Ask {name} to show everyone how, instead of adding a new job.',
  support: {
    toddler: 'Joins in and watches.',
    preschool: 'Do it together for a week or two, then step back.',
    early: 'Show it once, then one reminder at most.',
    middle: 'Ready for more independence.',
    teen: 'Free to choose how and when.',
    adult: '',
    child: 'Start together, then step back.',
  },
  grownUps: 'For the grown-ups to talk through: how will we help without taking over, and how will we notice the effort?',
  practice: {
    adjustmentLead: 'One thing worth trying',
    // January's own habit, for a family who told us too little to suggest more: a regular meeting, stacked on a routine.
    meetingHabit: 'One thing worth trying: hold the meeting after something you already do every week, like Sunday lunch, and write the next one on the calendar.',
    sustain: {
      reminders: 'Before reminding, try asking “What’s next?” and let the answer come from the kids.',
      default: 'When it’s going well, say so, and hold off on adding a new job.',
    },
  },
  checkIn: 'At a later meeting, you might check how it’s going: on my own, with reminders, or hard. Keep it, shrink it or swap it.',
};
