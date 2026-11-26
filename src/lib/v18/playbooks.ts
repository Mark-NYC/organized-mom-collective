/**
 * V18 (docs/ios/V18_TODAY_INTELLIGENCE.md) · A. Invisible-work anticipation, the deterministic half.
 *
 * What a kind of activity usually needs, written down once, so the app can notice "nobody has this yet" without any
 * model. Keyword classification is the first and cheapest pass; an optional interpreter (interpret.ts) may refine
 * the kind for ambiguous titles, but it can only choose from these kinds and these need ids.
 *
 * `core` needs surface on their own when nobody has them. Non-core needs only surface when an interpretation or the
 * family's own parts point at them (so the app stays quiet about things most families never think about).
 */
export type EventKind = 'field-trip' | 'birthday-party' | 'party' | 'sports-game' | 'sports-practice' | 'performance' | 'appointment' | 'routine' | 'other';
export type NeedKind = 'prep' | 'materials' | 'transport' | 'rsvp' | 'purchase' | 'decision';

export interface Need {
  id: string;
  kind: NeedKind;
  /** "Lunch", "A ride", in Today's words. */
  label: string;
  /** Days before the event it should be done by (0 = the same day). */
  leadDays: number;
  /** Who typically can own it: a child old enough to practice it, an adult, or either. */
  owner: 'child' | 'adult' | 'either';
  /** The proposal's words if the family wants to make a plan. */
  title: string;
  finish: string;
  core: boolean;
  /** Canonical skill (src/lib/family-development/skills.ts) when a child could own it. */
  skill?: string;
}

const n = (id: string, kind: NeedKind, label: string, leadDays: number, owner: Need['owner'], title: string, finish: string, core: boolean, skill?: string): Need =>
  ({ id, kind, label, leadDays, owner, title, finish, core, skill });

export const PLAYBOOKS: Record<EventKind, Need[]> = {
  'field-trip': [
    n('lunch', 'prep', 'Lunch', 1, 'either', 'Pack lunch for the field trip', 'Lunch and water bottle packed in the backpack', true, 'school-day-prep'),
    n('pickup', 'transport', 'Pickup', 0, 'adult', 'Pick up after the field trip', 'Someone is at school when the bus gets back', false),
  ],
  'birthday-party': [
    n('rsvp', 'rsvp', 'RSVP', 2, 'adult', 'RSVP to the party', 'The host knows who’s coming', true),
    n('gift', 'purchase', 'A gift', 1, 'either', 'Get a gift for the party', 'A wrapped gift by the door', true),
    n('card', 'prep', 'A card', 1, 'child', 'Make a birthday card', 'A signed card with the gift', true),
    n('ride', 'transport', 'A ride', 0, 'adult', 'Drive to the party', 'Drop-off and pickup times decided', true),
  ],
  party: [
    n('rsvp', 'rsvp', 'RSVP', 2, 'adult', 'RSVP to the party', 'The host knows who’s coming', true),
    n('ride', 'transport', 'A ride', 0, 'adult', 'Drive to the party', 'Drop-off and pickup times decided', true),
  ],
  'sports-game': [
    n('gear', 'materials', 'Gear', 1, 'child', 'Pack the game bag', 'Uniform, cleats and water bottle by the door', true, 'school-day-prep'),
    n('ride', 'transport', 'A ride', 0, 'adult', 'Drive to the game', 'Who drives and when to leave, decided', true),
  ],
  'sports-practice': [
    n('gear', 'materials', 'Gear', 1, 'child', 'Pack the practice bag', 'Cleats, shin guards and water bottle in the bag', true, 'school-day-prep'),
    n('ride', 'transport', 'A ride', 0, 'adult', 'Drive to practice', 'Who drives and when to leave, decided', false),
  ],
  performance: [
    n('outfit', 'prep', 'Outfit', 1, 'child', 'Lay out the performance outfit', 'Outfit ready the night before', true),
    n('ride', 'transport', 'A ride', 0, 'adult', 'Drive to the performance', 'Who drives and when to leave, decided', true),
  ],
  appointment: [],
  routine: [],
  other: [],
};

export const needOf = (kind: EventKind, id: string) => PLAYBOOKS[kind].find((x) => x.id === id) ?? null;
export const ALL_NEED_IDS = [...new Set(Object.values(PLAYBOOKS).flat().map((x) => x.id))];

/** Rules first. Order matters: "birthday" beats "party", "game" beats "soccer". */
const RULES: [RegExp, EventKind, number][] = [
  [/field\s*trip|excursion/i, 'field-trip', 0.95],
  [/birthday|b-?day/i, 'birthday-party', 0.9],
  [/\bparty\b/i, 'party', 0.7],
  [/\b(game|match|tournament)\b/i, 'sports-game', 0.85],
  [/practice|training/i, 'sports-practice', 0.85],
  [/recital|concert|performance|play\b|show\b/i, 'performance', 0.75],
  [/dentist|doctor|appointment|checkup|orthodont/i, 'appointment', 0.9],
  [/^school$|lesson|meeting|conference/i, 'routine', 0.8],
];

export interface Classification { kind: EventKind; confidence: number; source: 'rules' | 'interpreter' }

/** Titles only. Notes are untrusted text and never reach the rules (or anything that executes). */
export function classify(title: string): Classification {
  for (const [re, kind, confidence] of RULES) if (re.test(title)) return { kind, confidence, source: 'rules' };
  return { kind: 'other', confidence: 0.3, source: 'rules' };
}
