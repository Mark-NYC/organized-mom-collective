/**
 * The family profile's choices beyond the people (onboarding steps 2–6 and /club/family). Ids are stored in the
 * database (supabase/migrations/20261109000000_club_family_profile.sql checks categories against the same lists),
 * so they're stable; labels can change. Every question here feeds a future monthly resource or Family Meeting:
 * nothing is asked just because it might be interesting later.
 */

const icon = (name: string) => `/images/club/onboarding/${name}.webp`;

export type ActivityCategory = 'school' | 'work' | 'sports' | 'lessons' | 'community' | 'clubs' | 'appointments' | 'other';
export type ResponsibilityCategory =
  | 'meals' | 'laundry' | 'cleaning' | 'transportation' | 'belongings' | 'school-prep' | 'homework' | 'pet-care' | 'routines' | 'other';

export interface Choice<T extends string = string> {
  id: T;
  label: string;
  /** A processed onboarding icon (public/images/club/onboarding/), when one fits. Others show a plain mark. */
  icon?: string;
}

/** Step 2: what a typical week holds. Broad categories first; details are optional. */
export const ACTIVITY_CATEGORIES: Choice<ActivityCategory>[] = [
  { id: 'school', label: 'School or homeschool', icon: icon('school') },
  { id: 'work', label: 'Work schedules', icon: icon('work-schedule') },
  { id: 'sports', label: 'Sports and practices', icon: icon('sports') },
  { id: 'lessons', label: 'Music, dance or lessons', icon: icon('music-lessons') },
  { id: 'community', label: 'Church and community', icon: icon('community') },
  { id: 'clubs', label: 'Clubs and extracurriculars' },
  { id: 'appointments', label: 'Appointments', icon: icon('appointments') },
  { id: 'other', label: 'Something else regular' },
];

/** Step 3: what someone already takes care of. */
export const RESPONSIBILITY_CATEGORIES: Choice<Exclude<ResponsibilityCategory, 'routines'>>[] = [
  { id: 'meals', label: 'Meals and kitchen' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'cleaning', label: 'Cleaning and tidying' },
  { id: 'transportation', label: 'Driving and pickups' },
  { id: 'belongings', label: 'Keeping track of their things' },
  { id: 'school-prep', label: 'Getting ready for school', icon: icon('school') },
  { id: 'homework', label: 'Homework', icon: icon('homework') },
  { id: 'pet-care', label: 'Pet care', icon: icon('pet-care') },
  { id: 'other', label: 'Something else' },
];

/** Step 4: what she'd like the kids to own. Common sticking points, each tied to a category for later resources. */
export const GROWTH_ITEMS: (Choice & { category: ResponsibilityCategory })[] = [
  { id: 'morning-routine', category: 'routines', label: 'Getting ready in the morning' },
  { id: 'bedtime-routine', category: 'routines', label: 'Their bedtime routine' },
  { id: 'pack-school-bag', category: 'school-prep', label: 'Packing their school bag' },
  { id: 'homework-start', category: 'homework', label: 'Starting homework without reminders' },
  { id: 'tidy-room', category: 'cleaning', label: 'Keeping their room picked up' },
  { id: 'put-away-laundry', category: 'laundry', label: 'Putting their laundry away' },
  { id: 'help-with-meals', category: 'meals', label: 'Helping with meals or dishes' },
  { id: 'own-belongings', category: 'belongings', label: 'Keeping track of their things' },
  { id: 'pet-care', category: 'pet-care', label: 'Taking care of the pet' },
];

/** Step 5: where the family struggles to stay on the same page. */
export const CHALLENGES: Choice[] = [
  { id: 'knowing-plans', label: 'Knowing what’s happening' },
  { id: 'preparing', label: 'Getting ready for what’s coming up' },
  { id: 'remembering', label: 'Remembering who does what' },
  { id: 'routines', label: 'Morning and evening routines' },
  { id: 'communicating', label: 'Sharing plans with each other' },
  { id: 'sharing-fairly', label: 'Sharing the housework fairly' },
  { id: 'other', label: 'Something else' },
];

/** Step 6: the one thing she'd love to stop managing alone. Becomes the family's first priority. */
export const PRIORITIES: Choice[] = [
  { id: 'mornings', label: 'The morning rush' },
  { id: 'evenings', label: 'Dinner and evenings' },
  { id: 'activities', label: 'Keeping track of activities and rides' },
  { id: 'school-stuff', label: 'School papers, bags and homework' },
  { id: 'tidying', label: 'Keeping the house picked up' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'reminding', label: 'Reminding everyone what to do' },
  { id: 'other', label: 'Something else' },
];

/** Monday first, the way most school weeks read; stored as 0 = Sunday … 6 = Saturday. */
export const WEEK_DAYS: { day: number; short: string; label: string }[] = [
  { day: 1, short: 'M', label: 'Monday' },
  { day: 2, short: 'T', label: 'Tuesday' },
  { day: 3, short: 'W', label: 'Wednesday' },
  { day: 4, short: 'T', label: 'Thursday' },
  { day: 5, short: 'F', label: 'Friday' },
  { day: 6, short: 'S', label: 'Saturday' },
  { day: 0, short: 'S', label: 'Sunday' },
];

export const PROFILE_ICONS = {
  family: icon('family-members'),
  owns: icon('individual-ownership'),
  shared: icon('shared-responsibility'),
  meeting: icon('family-meeting'),
};

export const labelOf = (list: Choice[], id: string | undefined) => list.find((c) => c.id === id)?.label ?? '';
