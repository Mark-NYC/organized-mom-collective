/**
 * January 2027: Our First Family Meeting. The month's resource is the personalized guide itself: it introduces the
 * Club's four-part meeting and gets the family through its first one. Content only; the generator
 * (src/lib/club/meeting-guide/generate.ts) matches it to a family. Rules: src/lib/club/meeting-guide/types.ts.
 *
 * Priority and challenge ids: src/data/club/family-profile.ts (PRIORITIES, CHALLENGES).
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
      goal: 'Say why we’re meeting, in one minute.',
      say: 'This is our first Family Meeting. Once a month we’ll sit down for ten minutes so everyone knows the plan and everyone has a part. Nobody has to keep it all in their head.',
      byStage: {
        toddler: [
          { id: 'focus-clap', text: 'Claps to start the meeting with everyone.' },
          { id: 'focus-hold', text: 'Holds the guide on a lap while it’s read.' },
        ],
        preschool: [
          { id: 'focus-start', text: 'Rings a bell or claps to start the meeting.' },
          { id: 'focus-point', text: 'Points to where our family calendar hangs.' },
        ],
        early: [
          { id: 'focus-easier', text: 'Tells one thing that would make our week easier.' },
          { id: 'focus-repeat', text: 'Says the focus back in their own words.' },
        ],
        middle: [
          { id: 'focus-read', text: 'Reads the focus out loud.' },
          { id: 'focus-explain', text: 'Explains in their own words what a Family Meeting is for.' },
        ],
        teen: [
          { id: 'focus-example', text: 'Gives one real example from our week where a heads-up would have helped.' },
          { id: 'focus-want', text: 'Says one thing they want these meetings to be, and one thing they don’t.' },
        ],
        adult: [
          { id: 'focus-why-holder', text: 'Shares in one sentence why this matters to them, without listing anyone’s misses.', requires: 'holder' },
          { id: 'focus-why', text: 'Shares in one sentence why they’re glad to try this.', requires: 'not-holder' },
          { id: 'focus-carry', text: 'Names one thing they’d love the family to share.' },
        ],
        child: [
          { id: 'focus-start-any', text: 'Helps start the meeting: a clap, a bell or “Let’s begin.”' },
          { id: 'focus-easier-any', text: 'Tells one thing that would make our week easier.' },
        ],
      },
    },
    talk: {
      goal: 'Everyone answers, youngest first. No wrong answers, no fixing anyone.',
      say: 'Let’s each answer, starting with the youngest. We’re just listening today.',
      byStage: {
        toddler: [
          { id: 'talk-point', text: 'Points to something they like doing with the family, or says one word.' },
        ],
        preschool: [
          { id: 'talk-favorite', text: 'Answers first: their favorite thing we do together.' },
          { id: 'talk-fun', text: 'Tells one fun thing they’re looking forward to.' },
        ],
        early: [
          { id: 'talk-coming', text: 'Names one thing coming up for them this week.' },
          { id: 'talk-hard', text: 'Says one part of getting ready that feels hard.' },
        ],
        middle: [
          { id: 'talk-week', text: 'Names what’s on for them this week and what they’ll need for it.' },
          { id: 'talk-car', text: 'Asks one question about the week they’d usually ask in the car.' },
        ],
        teen: [
          { id: 'talk-own-week', text: 'Walks through their own week: plans, practices, anything that needs a ride or money.' },
          { id: 'talk-early', text: 'Flags one thing coming up that needs help early.' },
        ],
        adult: [
          { id: 'talk-own', text: 'Shares their own week the same way the kids do.' },
          { id: 'talk-listen', text: 'Listens first, and asks “What would help?” before offering a fix.' },
        ],
        child: [
          { id: 'talk-coming-any', text: 'Names one thing coming up for them this week.' },
        ],
      },
    },
    parts: {
      goal: 'Each person picks one small part they own this month.',
      say: 'Everyone picks one small part for this month. It’s yours, so nobody needs to remind you.',
      byStage: {
        toddler: [
          { id: 'part-join', text: 'Joins in and watches. No job yet.' },
        ],
        preschool: [
          { id: 'part-sticker', text: 'Puts a sticker on today’s date on the calendar each morning.', finished: 'Today has a sticker.' },
          { id: 'part-shoes', text: 'Puts their shoes by the door the night before an outing.', finished: 'Shoes are by the door before bed.' },
        ],
        early: [
          { id: 'part-tomorrow', text: 'Checks the calendar each evening and lays out what they need for tomorrow.', finished: 'Tomorrow’s things are out before bed.' },
          { id: 'part-bag', text: 'Packs their own bag for {school} the night before.', finished: 'Their bag is packed and by the door.', requires: 'school' },
          { id: 'part-own-day', text: 'Finds their own day on the calendar each morning and says what’s on.', finished: 'They told someone what’s on today.' },
        ],
        middle: [
          { id: 'part-own-entries', text: 'Adds their own activities to the family calendar.', finished: 'Everything they have this month is on the calendar.' },
          { id: 'part-gear', text: 'Packs their own gear for {activity} the night before.', finished: 'Gear is packed before bed.', requires: 'activity' },
          { id: 'part-check', text: 'Checks the calendar before asking what’s happening.', finished: 'They knew the plan without asking.' },
        ],
        teen: [
          { id: 'part-own-plans', text: 'Keeps their own plans on the family calendar, including rides they need.', finished: 'Their month is on the calendar, rides included.' },
          { id: 'part-read-week', text: 'Reads the week ahead out loud at our next meeting.', finished: 'They read next month’s week at the meeting.' },
          { id: 'part-ask-early', text: 'Asks for rides or money at least a day ahead.', finished: 'No same-day asks this month.' },
        ],
        adult: [
          { id: 'part-own-holder', text: 'Adds only their own plans to the calendar and leaves the kids’ plans to them.', finished: 'Their own plans are on it; nobody else’s.', requires: 'holder' },
          { id: 'part-ride', text: 'Owns rides and gear for one regular activity.', finished: 'That activity is covered all month.', requires: 'not-holder' },
          { id: 'part-own-work', text: 'Adds their own work and plans to the calendar each week.', finished: 'Their week is on the calendar.' },
        ],
        child: [
          { id: 'part-tomorrow-any', text: 'Lays out what they need for tomorrow before bed.', finished: 'Tomorrow’s things are out before bed.' },
        ],
      },
    },
    practice: {
      goal: 'Try it right now, so the first time isn’t a reminder later.',
      say: 'Let’s try it now. Everyone finds their next thing and puts it on the calendar.',
      byStage: {
        toddler: [
          { id: 'practice-sticker', text: 'Puts a sticker on today’s date.' },
        ],
        preschool: [
          { id: 'practice-draw', text: 'Draws a small picture next to one thing that’s theirs.' },
          { id: 'practice-find', text: 'Finds their birthday month or a fun day and marks it.' },
        ],
        early: [
          { id: 'practice-write', text: 'Writes their own next thing on the calendar. Spelling doesn’t matter.' },
          { id: 'practice-color', text: 'Picks their color and marks their next thing with it.' },
        ],
        middle: [
          { id: 'practice-two-weeks', text: 'Writes in their own plans for the next two weeks.' },
          { id: 'practice-help', text: 'Helps a younger one find their day and mark it.' },
        ],
        teen: [
          { id: 'practice-clash', text: 'Adds their next two weeks and checks for clashes with anyone else’s.' },
          { id: 'practice-month', text: 'Writes in their own month, then circles anything that needs a ride.' },
        ],
        adult: [
          { id: 'practice-own', text: 'Adds their own next two weeks, and leaves the kids’ entries to the kids.' },
          { id: 'practice-date', text: 'Writes next month’s meeting on the calendar.' },
        ],
        child: [
          { id: 'practice-write-any', text: 'Marks their own next thing on the calendar.' },
        ],
      },
    },
  },

  questions: {
    withActivity: 'What’s happening for each of us this week, like {activity}?',
    generic: 'What’s one thing happening this week that everyone should know about?',
    always: ['What’s one thing that would make our week feel easier?'],
    byPriority: {
      mornings: 'What’s the trickiest part of our mornings?',
      evenings: 'What would make our evenings calmer?',
      activities: 'Which ride or activity catches us by surprise most often?',
      'school-stuff': 'What do we usually forget for school?',
      tidying: 'Where do things pile up in our home?',
      laundry: 'Where do clothes get stuck on their way back to drawers?',
      reminding: 'What’s something you could remember on your own if it were on the calendar?',
    },
    byChallenge: {
      'knowing-plans': 'When did you last not know what was happening?',
      preparing: 'What’s one thing we always end up rushing for?',
      remembering: 'Who does what at our house right now?',
      routines: 'Which part of our day feels most rushed?',
      communicating: 'How do you like to hear about plans?',
      'sharing-fairly': 'Which jobs at home could someone else try?',
    },
  },

  why: 'When everyone can see the plan, nobody has to carry it alone.',
  whyByPriority: {
    activities: 'You want to share keeping track of activities and rides. It starts with everyone seeing the plan.',
    reminding: 'You want to stop being everyone’s reminder. When everyone sees the plan, they can remember their own part.',
    mornings: 'Mornings go smoother when the night before has a plan everyone knows.',
    'school-stuff': 'School things come up every week. A shared plan catches them early.',
    evenings: 'Evenings feel calmer when everyone knows what’s coming.',
  },
  whyByChallenge: {
    'knowing-plans': 'Knowing what’s happening is hard right now, so this month starts there.',
    communicating: 'Sharing plans is hard right now. One short meeting gives everyone the same picture.',
    preparing: 'Getting ready is hard right now. Seeing what’s coming gives everyone time to prepare.',
    remembering: 'Remembering who does what is hard right now. Today everyone says their own part out loud.',
  },

  actions: [
    { id: 'calendar-spot', text: 'Hang the family calendar where everyone walks past every day.', finished: 'Anyone can find today’s plan without asking.' },
    { id: 'own-entries', text: 'Everyone 9 and up adds their own plans to the calendar.', finished: 'Nobody adds plans for anyone 9 and up.', priorities: ['reminding', 'activities'], challenges: ['knowing-plans', 'communicating'], needsKids: true },
    { id: 'night-before', text: 'The night before a busy day, everyone gets their own things ready.', finished: 'Bags, shoes and gear are out before bed.', priorities: ['mornings', 'school-stuff'], challenges: ['preparing', 'routines'] },
    { id: 'sunday-look', text: 'Take two minutes each weekend to look at the week ahead together.', finished: 'We looked at the week before it started.', challenges: ['knowing-plans', 'preparing'], priorities: ['activities'] },
    { id: 'check-first', text: 'Check the calendar first before asking “What are we doing?”', finished: 'Fewer “What’s happening?” questions.', priorities: ['reminding'], challenges: ['remembering', 'communicating'] },
    { id: 'keep-part', text: 'Everyone keeps the part they picked today for the whole month.', finished: 'At next month’s meeting, each person says how their part went.', challenges: ['sharing-fairly', 'remembering'], priorities: ['tidying', 'laundry', 'evenings'] },
  ],
  defaultActions: ['calendar-spot', 'keep-part'],
  maxActions: 2,

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
