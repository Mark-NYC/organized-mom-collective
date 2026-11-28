/**
 * Labeled synthetic calendar titles for evaluating the interpreter (docs/intelligence/EVALUATION_PLAN.md).
 *
 * Every title is already minimized the way production will send it: people are tokens (P1, P2), no descriptions,
 * places or contact details. Each has the kind a careful parent would assign, other kinds that are also fair, and the
 * needs that MUST be suggested (from the playbooks' closed list). Made up by us; no family's data.
 *
 * Deliberately includes the hard cases the rules get wrong or can't decide: a birthday that's a reminder not a party,
 * a class party that's a school event, picture day, early dismissal, swim meets, tryouts, dress rehearsals.
 */
import type { EVENT_KINDS, NEED_IDS } from '../../../../supabase/functions/_shared/intel/tasks';

type Kind = (typeof EVENT_KINDS)[number];
type NeedId = (typeof NEED_IDS)[number];

export interface CatalogEvent {
  key: string;
  title: string;
  kind: Kind;
  alsoOk?: Kind[];
  needs: NeedId[];
  repeats?: boolean;
  dayPart?: 'morning' | 'afternoon' | 'evening' | 'all-day';
  /** For reporting: which kind of difficulty this is. */
  group: 'clear' | 'birthday' | 'school-day' | 'sports' | 'social' | 'appointment' | 'performance' | 'other';
}

const e = (key: string, title: string, kind: Kind, needs: NeedId[], group: CatalogEvent['group'], extra: Partial<CatalogEvent> = {}): CatalogEvent => ({ key, title, kind, needs, group, ...extra });

export const CATALOG: CatalogEvent[] = [
  // the rules handle these confidently and correctly (they should never reach the model)
  e('soccer-practice', 'S1 soccer practice', 'sports-practice', ['gear'], 'clear', { repeats: true, dayPart: 'afternoon' }),
  e('soccer-game', 'S1 soccer game', 'sports-game', ['gear', 'ride'], 'clear', { dayPart: 'morning' }),
  e('field-trip', 'Field trip to the zoo', 'field-trip', ['lunch'], 'clear', { dayPart: 'all-day' }),
  e('dentist', 'P2 dentist', 'appointment', [], 'clear', { dayPart: 'afternoon' }),
  e('band-concert', 'Winter band concert', 'performance', ['outfit', 'ride'], 'clear', { dayPart: 'evening' }),
  e('piano-lesson', 'Piano lesson', 'routine', [], 'clear', { repeats: true, alsoOk: ['other'] }),
  e('bday-party', 'P3 birthday party', 'birthday-party', ['rsvp', 'gift'], 'birthday', { dayPart: 'afternoon' }),
  // birthdays: a reminder, not a party (rules say "birthday-party")
  e('bday-reminder', 'P2 birthday', 'birthday-reminder', ['card'], 'birthday', { repeats: true, dayPart: 'all-day' }),
  e('bday-reminder-2', 'P4 bday', 'birthday-reminder', ['card'], 'birthday', { repeats: true, dayPart: 'all-day' }),
  e('bday-bash', 'P5 turns 7: bowling', 'birthday-party', ['rsvp', 'gift', 'ride'], 'birthday', { dayPart: 'afternoon' }),
  // school days the rules can't see
  e('picture-day', 'Picture day', 'school-event', ['outfit'], 'school-day', { dayPart: 'morning' }),
  e('yearbook', 'Yearbook photos', 'school-event', ['outfit'], 'school-day', { dayPart: 'morning' }),
  e('early-dismissal', 'Early dismissal', 'school-event', ['pickup'], 'school-day', { dayPart: 'afternoon' }),
  e('pajama-day', 'Pajama day', 'school-event', ['outfit'], 'school-day', { dayPart: 'all-day' }),
  e('costume-parade', 'Halloween parade', 'school-event', ['outfit'], 'school-day', { dayPart: 'morning', alsoOk: ['performance'] }),
  e('valentines', 'Valentine exchange', 'school-event', ['card'], 'school-day', { alsoOk: ['party'] }),
  e('class-party', 'Class party', 'school-event', [], 'school-day', { alsoOk: ['party'] }),
  e('book-fair', 'Book fair', 'school-event', [], 'school-day', { alsoOk: ['other'] }),
  e('no-school', 'No school', 'school-event', [], 'school-day', { dayPart: 'all-day', alsoOk: ['other', 'routine'] }),
  e('science-fair', 'Science fair', 'school-event', [], 'school-day', { alsoOk: ['performance'] }),
  e('conference', 'Teacher conference', 'appointment', [], 'appointment', { alsoOk: ['routine', 'school-event'] }),
  // sports the rules can't see, or tournaments
  e('swim-meet', 'Swim meet', 'sports-game', ['gear', 'ride'], 'sports', { dayPart: 'morning', alsoOk: ['tournament'] }),
  e('tournament', 'S2 tournament', 'tournament', ['gear', 'ride'], 'sports', { dayPart: 'all-day', alsoOk: ['sports-game'] }),
  e('tryouts', 'Volleyball tryouts', 'sports-game', ['gear', 'ride'], 'sports', { alsoOk: ['sports-practice'] }),
  e('meet-practice', 'Swim', 'sports-practice', ['gear'], 'sports', { repeats: true, alsoOk: ['routine'] }),
  e('team-photos', 'Team photos', 'other', ['outfit'], 'sports', { alsoOk: ['school-event', 'sports-game'] }),
  // social
  e('sleepover', 'Sleepover at P3', 'party', ['ride'], 'social', { dayPart: 'evening', alsoOk: ['other'] }),
  e('playdate', 'Playdate with P4', 'party', ['ride'], 'social', { alsoOk: ['other'] }),
  // appointments
  e('ortho', 'Orthodontist', 'appointment', [], 'appointment'),
  e('haircut', 'Haircuts', 'appointment', [], 'appointment', { alsoOk: ['other'] }),
  e('vet', 'Vet for S4', 'appointment', [], 'appointment', { alsoOk: ['other'] }),
  // performances the rules miss
  e('rehearsal', 'Dress rehearsal', 'performance', ['outfit', 'ride'], 'performance', { dayPart: 'evening', alsoOk: ['sports-practice', 'routine'] }),
  e('nutcracker', 'Nutcracker', 'performance', ['outfit', 'ride'], 'performance', { dayPart: 'evening' }),
  // ordinary family life: nothing to prepare
  e('pizza', 'Pizza night', 'other', [], 'other', { repeats: true, dayPart: 'evening', alsoOk: ['routine'] }),
  e('date-night', 'Date night', 'other', [], 'other', { alsoOk: ['routine'] }),
  e('garbage', 'Garbage day', 'other', [], 'other', { repeats: true, alsoOk: ['routine'] }),
];
