/**
 * The customer discovery survey (/survey). Questions, answer ids and copy.
 *
 * Answer ids are what's stored in Supabase. Reword a label freely; never change
 * or reuse an id once responses exist. The database checks submitted ids
 * against the same lists (supabase/migrations/*_customer_survey.sql →
 * survey_allowed), so add a new option in both places.
 */

export interface SurveyOption {
  id: string;
  label: string;
  /** Selecting it clears the others (multi-select only). */
  exclusive?: boolean;
}

export interface ChoiceQuestion {
  id: 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6';
  kind: 'single' | 'multi';
  prompt: string;
  /** Short name for the admin view and CSV. */
  short: string;
  options: SurveyOption[];
}

export interface TextQuestion {
  id: 'q7';
  kind: 'text';
  prompt: string;
  short: string;
  placeholder: string;
  maxLength: number;
}

export type SurveyQuestion = ChoiceQuestion | TextQuestion;

export const SURVEY_ID = 'discovery-2026';

export const surveyQuestions: SurveyQuestion[] = [
  {
    id: 'q1',
    kind: 'multi',
    short: 'Schedule tools',
    prompt: 'How do you currently keep track of your family’s schedule?',
    options: [
      { id: 'paper', label: 'Paper wall calendar or planner' },
      { id: 'digital_calendar', label: 'Google Calendar or Apple Calendar' },
      { id: 'school_sports_apps', label: 'School or sports apps' },
      { id: 'phone_notes', label: 'Notes or lists on my phone' },
      { id: 'in_my_head', label: 'Mostly keeping it in my head' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'q2',
    kind: 'single',
    short: 'Biggest frustration',
    prompt: 'What’s the most frustrating part of keeping your family organized?',
    options: [
      { id: 'scattered', label: 'Information is scattered across too many places' },
      { id: 'forgetting', label: 'Forgetting appointments or activities' },
      { id: 'last_minute', label: 'Keeping up with last-minute changes' },
      { id: 'cleaning', label: 'Staying on top of cleaning and household tasks' },
      { id: 'everyone_knows', label: 'Making sure everyone knows the plan' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'q3',
    kind: 'multi',
    short: 'How updates arrive',
    prompt: 'How do school, sports, and activity updates usually reach you?',
    options: [
      { id: 'email', label: 'Email' },
      { id: 'text', label: 'Text messages' },
      { id: 'school_apps', label: 'School apps or portals' },
      { id: 'team_apps', label: 'Sports/team apps' },
      { id: 'paper', label: 'Paper notices' },
      { id: 'other', label: 'Something else' },
      { id: 'na', label: 'Not applicable', exclusive: true },
    ],
  },
  {
    id: 'q4',
    kind: 'single',
    short: 'Weekly planning',
    prompt: 'How often do you sit down and plan the coming week?',
    options: [
      { id: 'every_week', label: 'Every week' },
      { id: 'most_weeks', label: 'Most weeks' },
      { id: 'occasionally', label: 'Occasionally' },
      { id: 'rarely', label: 'Rarely or never' },
    ],
  },
  {
    id: 'q5',
    kind: 'single',
    short: 'Cleaning approach',
    prompt: 'How do you currently keep up with household cleaning?',
    options: [
      { id: 'routine', label: 'I follow a routine or checklist' },
      { id: 'app', label: 'I use an app' },
      { id: 'as_noticed', label: 'I clean things as I notice them' },
      { id: 'weekends', label: 'I do most of it on weekends' },
      { id: 'someone_else', label: 'Someone else handles most of it' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'q6',
    kind: 'single',
    short: 'Most mental energy',
    prompt: 'Which part of managing your home or family takes the most mental energy?',
    options: [
      { id: 'tracking', label: 'Keeping track of appointments and activities' },
      { id: 'messages', label: 'Sorting through school and activity messages' },
      { id: 'cleaning', label: 'Keeping up with cleaning and household tasks' },
      { id: 'planning', label: 'Planning the week and keeping everyone informed' },
      { id: 'last_minute', label: 'Managing last-minute schedule changes' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'q7',
    kind: 'text',
    short: 'A hard week',
    prompt: 'Think of a recent week that felt hard to manage. What made it difficult?',
    placeholder: 'A sentence or two is plenty.',
    maxLength: 1000,
  },
];

/** The "Something else" option id. Picking it reveals a short optional text field. */
export const OTHER = 'other';
export const OTHER_MAX = 200;

/** Questions that offer "Something else", and the answer key its text is stored under. */
export const otherKey = (id: ChoiceQuestion['id']) => `${id}_other` as const;
export type OtherKey = ReturnType<typeof otherKey>;

export type SurveyAnswers = Partial<
  Record<'q1' | 'q3', string[]> & Record<'q2' | 'q4' | 'q5' | 'q6' | 'q7', string> & Record<OtherKey, string>
>;

/**
 * Where the survey link was shared (?source=…). Missing → direct; anything not
 * listed → other, so a mistyped link shows up instead of disappearing.
 */
export const SURVEY_SOURCES = ['website', 'instagram', 'customer-insert', 'direct', 'other'] as const;
export type SurveySource = (typeof SURVEY_SOURCES)[number];

export function normalizeSource(raw: string | null | undefined): SurveySource {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return 'direct';
  return (SURVEY_SOURCES as readonly string[]).includes(v) ? (v as SurveySource) : 'other';
}

/** Drops "Something else" text for questions where it's no longer selected; trims the rest. */
export function cleanAnswers(answers: SurveyAnswers): SurveyAnswers {
  const out: SurveyAnswers = { ...answers };
  for (const q of surveyQuestions) {
    if (q.kind === 'text') continue;
    const key = otherKey(q.id);
    const picked = q.kind === 'multi' ? (answers[q.id] as string[] | undefined)?.includes(OTHER) : answers[q.id] === OTHER;
    const text = answers[key]?.trim().slice(0, OTHER_MAX);
    if (picked && text) out[key] = text;
    else delete out[key];
  }
  const q7 = answers.q7?.trim();
  if (q7) out.q7 = q7;
  else delete out.q7;
  return out;
}

/** Toggle a multi-select option, keeping "exclusive" options on their own. */
export function toggleMulti(question: ChoiceQuestion, current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  const exclusive = new Set(question.options.filter((o) => o.exclusive).map((o) => o.id));
  if (exclusive.has(id)) return [id];
  return [...current.filter((x) => !exclusive.has(x)), id];
}

/** True when every required question (all but the open text) has an answer. */
export function isComplete(answers: SurveyAnswers): boolean {
  return surveyQuestions.every((q) => {
    if (q.kind === 'text') return true;
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : typeof a === 'string' && a.length > 0;
  });
}
