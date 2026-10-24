/**
 * August 2027 Club: My School Day.
 * Flagship: one illustrated morning + after-school routine sheet,
 * seeded from the existing Routine Chart Generator defaults.
 * Preserve 2027-08-school-year slug for existing member links.
 */
import type { KitConfig } from '../types';
import { routes } from '../../../routes';
const SLUG = '2027-08-school-year';
export const kit: KitConfig = {
 slug: SLUG,
 month: '2027-08',
 theme: 'My School Day',
 subtitle: 'Ready for school. Ready for home.',
 shift: 'Children can follow a short picture-led morning and after-school routine rather than waiting for Mom to repeat instructions.',
 engine: 'routines',
 engineVersion: 2,
 items: [],
 tool: {
  tool: 'routine-chart',
  title: 'Adjust Your School Day Routine',
  blurb: 'The Club mails a finished school day board. You can use the existing Routine Chart Generator for a more detailed custom routine if you want.',
  cta: 'Open the Routine Chart Generator',
  start: 'morning',
  note: 'Optional. The mailed routine board is ready to display.',
 },
 printables: [
  { id: 'school-day', title: 'My School Day', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
 ],
 mailer: {
  letter: {
   draft: true,
   title: 'A School Day They Can Follow',
   greeting: 'Hi friend,',
   namedGreeting: 'Hi {name},',
   body: [
    'When school starts, morning and afternoon reminders can pile up. Get dressed. Find your backpack. Put your lunchbox away. Before long, Mom is managing every little transition.',
    'This month your family receives one illustrated school-day routine. It gives kids a simple place to look for what happens next before school and when they get home.',
    'Review the routine, hang it where your child can see it, and practice together once. The goal is not a perfect morning. It is one less set of instructions Mom needs to repeat each day.',
    'Adjust the steps online only if you need to. Your printed tool is intended to be useful as delivered.',
   ].join('\n\n'),
   signoff: 'Megan',
  },
  fieldGuide: {
   title: 'Help Them Own the Next Step',
   sections: [
    { heading: 'See it.', body: 'Put the illustrated routine at your child’s eye level where transitions happen.' },
    { heading: 'Practice once.', body: 'Walk through the steps together before the school-day rush.' },
    { heading: 'Point, don’t repeat.', body: 'Help your child check the next picture instead of delivering every reminder.' },
   ],
  },
  tip: {
   title: 'One page, not one more project',
   body: 'The routine comes prepared. Choose one child’s version to display first, and adjust only steps that do not fit your household.',
  },
  invite: {
   title: 'Make It Yours',
   body: 'Change or reorder routine steps online if needed, or use the full Routine Chart Generator for more options.',
  },
  calendarNote: 'Put school start times, practices, drop-off arrangements, and events on the family calendar. The routine page handles the daily actions in between.',
  screenNote: 'The mailed routine board is the product. Optional digital edits are available, but no setup is required to begin.',
  letterLinkTop: true,
  accent: 'school',
  qrPath: '/club/kits/' + SLUG + '?source=mailer',
 },
 related: [routes.routineChart, routes.backToSchool],
};
