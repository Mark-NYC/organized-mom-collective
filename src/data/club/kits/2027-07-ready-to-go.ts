/**
 * July 2027 Club: What Can I Do Right Now? Personalized activity choice board.
 * Keep original slug to preserve existing membership links.
 * Printed prototype: src/components/club/JulyActivityBoard.astro.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-07-ready-to-go';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-07',
  theme: 'What Can I Do Right Now?',
  subtitle: 'Fewer “I’m bored” requests. More kid-led summer.',
  shift: 'Kids see three levels of specific, ready-to-start activities and choose one without Mom assigning their free time.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  printables: [
    { id: 'activity-board', title: 'What Can I Do Right Now?', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
  ],
  mailer: {
    letter: {
      draft: true,
      title: 'They Can Find Their Next Thing',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'By the middle of summer, even kids who love free time can run out of ideas. And when every pause becomes “What can I do?”, Mom ends up planning the afternoon again.',
        'This month’s board gives kids three kinds of choices: something to start in five minutes, something to get into for longer, and a project they can come back to another day.',
        'The activities are starting points, not assignments. Keep only those your child can safely do with things your family already has. Show them the board once, then let them choose.',
        'The goal is not to keep kids occupied every minute. It is to help them practice making a decision and getting started without needing you to come up with the plan.'
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'One Board. Three Ways to Begin.',
      intro: 'Help your child choose activities that fit their energy, independence and attention span.',
      sections: [
        { heading: '5-Minute Ideas', body: 'Low-preparation ideas a child can start immediately when they need a little direction.' },
        { heading: 'Keep Me Busy', body: 'Activities that have a few more steps and invite children to stick with them.' },
        { heading: 'My Own Project', body: 'Ideas that build toward something a child can return to across multiple days.' }
      ],
    },
    tip: {
      title: 'Use what you already have',
      body: 'Avoid ideas that require shopping, elaborate parent setup or unsafe unsupervised activities.',
    },
    invite: {
      title: 'Adjust Your Activity Board',
      body: 'The delivered board is ready to use. Open the Club page only if you want to change the choices or reprint it.',
    },
    calendarNote: 'May teaches kids the rhythm of the day; June gives them independent snack choices; July helps them choose what to do during free time.',
    screenNote: 'The mailed activity board is the finished product. Editing it online is optional.',
    letterLinkTop: true,
    accent: 'summer',
    qrPath: '/club/kits/' + SLUG + '?source=mailer',
  },
};
