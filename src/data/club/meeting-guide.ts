/**
 * The Family Meeting guide: a standard, reusable one-page insert in every Welcome Kit (the same sheet for every
 * family, not personalized; no fulfillment order of its own, it's on the kit's packing list). It explains the Club's
 * ongoing meeting rhythm: once a month, about ten minutes, the same four parts as each month's prepared Family Meeting
 * on the website (src/data/club/family-meeting.ts). It is not January's Weekly Family Meeting resource.
 *
 * DRAFT copy for the owner's approval before the first kit prints (docs/club/WELCOME_KIT.md).
 * Writing rules (tests/club-meeting-guide.test.ts): no "Mom", "Dad" or "parents"; nothing that makes one grown-up the
 * family's reminder; "website", never "app"; no promised dates.
 */
export const MEETING_GUIDE = {
  title: 'Our Family Meeting',
  subtitle: 'Ten minutes, once a month, so everyone knows the plan and plays a part.',
  rhythm: [
    { label: 'When', text: 'Once a month, when your new Club resource arrives. Pick a time that already happens, like Sunday after lunch, and keep it.' },
    { label: 'How long', text: 'About ten minutes. Short enough that everyone can sit still, long enough to agree on one thing.' },
    { label: 'Who', text: 'Everyone who lives at home. Little ones can sit on a lap and hold the sheet.' },
    { label: 'What you need', text: 'This month’s resource and your family wall calendar, if you have one.' },
  ],
  parts: [
    { minutes: 2, title: 'Our Focus', text: 'Read this month’s focus out loud. One sentence is enough: what we’re working on together, and why it helps all of us.' },
    { minutes: 3, title: 'Let’s Talk', text: 'Ask the questions on this month’s meeting page. Everyone answers, the youngest first. No wrong answers, no fixing anyone.' },
    { minutes: 3, title: 'Everyone’s Part', text: 'Each person picks or agrees to one small part they own this month. Write it down where everyone can see it.' },
    { minutes: 2, title: 'Let’s Practice', text: 'Try one part together right now, so the first time isn’t a reminder later.' },
  ],
  habits: [
    'Keep the same day and time each month, so nobody has to call the meeting.',
    'Let each person say their own part out loud. Owning it starts there.',
    'Celebrate one thing that went well last month before starting something new.',
    'End on time, even if you didn’t get to everything. Next month comes soon.',
  ],
  website: 'Each month’s meeting, prepared with your family’s names and questions, is on the Club website beside that month’s resource.',
} as const;
