/**
 * The worksheet's fixed copy and the job presets. Template text lives here, never in the layout, so a later month
 * can reuse the engine with new words. November 2026 kit: src/data/club/kits/2026-11-family-ownership.ts.
 */

export const WORKSHEET = {
  month: 'November',
  year: '2026',
  brand: 'Organized Family Club',
  site: 'organizedmomcollective.com',
  front: {
    eyebrow: 'Family ownership',
    title: 'I own this job.',
    deck: 'One whole job. One clear owner. Less reminding for everyone.',
    preparedFor: 'Prepared for',
    preparedNote: 'A home where everyone knows the plan and plays a part.',
    sections: { job: 'The job', done: 'What finished looks like', handoff: 'The handoff' },
    owner: 'This job belongs to',
    job: 'The whole job',
    when: 'When it happens',
    addMore: 'Anything to add',
    handoff: [
      { title: 'Show it', body: 'Watch a grown-up do the whole job, start to finish.' },
      { title: 'Do it together', body: 'Practice side by side until the steps feel clear.' },
      { title: 'Hand it over', body: 'The owner notices when it’s needed and does it.' },
      { title: 'Check in', body: 'Talk about how it went. Adjust, then keep going.' },
    ],
    handoffDate: 'Date',
    promiseLabel: 'My promise',
    promise: 'I’ll notice when it needs doing, do the whole job, and finish it without a reminder.',
    signOwner: 'Job owner',
    signCoach: 'Grown-up coach',
  },
  back: {
    eyebrow: 'A note for your family',
    title: ['Helping is good.', 'Owning is better.'],
    letter: [
      'When one person has to notice every job, ask for help, and check that it got done, the responsibility never really moves. This month, give someone the entire job. Start with one. Show them what done looks like, practice together, then give them room to learn.',
      'The goal isn’t perfection. It’s a home where everyone can see what’s needed and take responsibility for their part.',
    ],
    guidanceLabel: 'For the grown-ups',
    // From the kit's "Handing Over a Whole Job" checklist.
    guidance: [
      'Hand over the remembering too: when it’s due and where things live.',
      'Step back. Done differently is still done.',
      'If it slips, the owner catches up. The job stays theirs.',
    ],
    checkInLabel: 'Our family check-in',
    checkInDate: 'Date',
    prompts: ['What went well?', 'What was hard?', 'What will we change?'],
    tryLabel: 'Try it together',
    checks: [
      'We agreed on what finished means.',
      'We practiced it together.',
      'The owner knows when to do it.',
      'We checked in without nagging.',
    ],
    calendarLabel: 'Bring it to your calendar',
    calendar: (owner: string | null) =>
      `Write ${owner ? `${owner}’s` : 'the owner’s'} name beside the day it happens. Then let the calendar do some of the reminding.`,
    signoff: 'Cheering you on,',
    signature: 'Megan',
  },
} as const;

/** Whole jobs a child can own, with a starting "when" and "finished looks like". All editable. */
export const JOB_PRESETS = [
  {
    job: 'Set and clear the dinner table',
    when: 'Every evening, before and after dinner',
    done: 'Plates, cups and forks out before we eat. After dinner, dishes in the sink, table wiped and chairs pushed in.',
  },
  {
    job: 'Pack my school bag',
    when: 'Every school night, before bed',
    done: 'Homework, folder, water bottle and lunch box in the bag, and the bag waiting by the door.',
  },
  {
    job: 'Put away my clean laundry',
    when: 'The day clean clothes come out of the laundry',
    done: 'Clothes folded or hung in the right place, and the empty basket back where it belongs.',
  },
  {
    job: 'Empty the dishwasher',
    when: 'Every morning, once it has finished',
    done: 'Clean dishes put away where they live, and the dishwasher empty and ready for dirty ones.',
  },
  {
    job: 'Keep the entryway tidy',
    when: 'After school, and again before bed',
    done: 'Shoes in pairs, coats and bags hung up, and nothing left on the floor.',
  },
  {
    job: 'Feed the pet',
    when: 'Every morning and evening',
    done: 'Food and fresh water in the bowls, and the scoop and food put away.',
  },
  {
    job: 'Take out the trash and recycling',
    when: 'Every evening, and the night before pickup',
    done: 'Small bins emptied, bags out, and cans at the curb the night before pickup, without a reminder.',
  },
] as const;

/** Input limits. The form enforces them; normalize() enforces them again for server-side use. */
export const LIMITS = { familyName: 48, owner: 28, job: 90, when: 80, done: 260 } as const;
