/**
 * Summer rhythms for the routine chart's Summer type (src/components/site/RoutineChart.astro, routine-chart.ts): a few
 * daily anchors (morning, midday, afternoon, evening) instead of an hourly schedule, so a child can see what comes
 * next without asking. Three quick answers shape it: who it's for (an age band), where their days are (home or a
 * camp or program), how much structure the family wants, and what needs the most attention. Every line stays editable
 * on the chart; this only writes the starting steps.
 *
 * Relaxed: a handful of steps, no times. Balanced (the default): the chart's eight steps, no times. More structured:
 * the same eight with approximate times (the chart already has a time column; the brief keeps hours to
 * this one choice). Lines that are library jobs carry their illustration.
 */
export type SummerStage = 'young' | 'school' | 'teen';
export type SummerDays = 'home' | 'camp';
export type Structure = 'relaxed' | 'balanced' | 'structured';
export type SummerFocus = 'mornings' | 'independent' | 'outdoor' | 'reading' | 'responsibilities' | 'rest' | 'screens';
export type Anchor = 'Morning' | 'Midday' | 'Afternoon' | 'Evening';

export const ANCHORS: Anchor[] = ['Morning', 'Midday', 'Afternoon', 'Evening'];
export const stageOptions: { id: SummerStage; label: string }[] = [
  { id: 'young', label: 'Ages 3–5' },
  { id: 'school', label: 'Ages 6–12' },
  { id: 'teen', label: 'Teens' },
];
export const dayOptions: { id: SummerDays; label: string }[] = [
  { id: 'home', label: 'Mostly home' },
  { id: 'camp', label: 'Camp or a program' },
];
export const structureOptions: { id: Structure; label: string; hint: string }[] = [
  { id: 'relaxed', label: 'Relaxed', hint: 'A few anchors, lots of free time' },
  { id: 'balanced', label: 'Balanced', hint: 'A loose order for the day' },
  { id: 'structured', label: 'More structured', hint: 'The full day, with rough times' },
];
export const focusOptions: { id: SummerFocus; label: string }[] = [
  { id: 'mornings', label: 'Morning routines' },
  { id: 'independent', label: 'Independent activities' },
  { id: 'outdoor', label: 'Outdoor play' },
  { id: 'reading', label: 'Reading or learning' },
  { id: 'responsibilities', label: 'Household responsibilities' },
  { id: 'rest', label: 'Rest and downtime' },
  { id: 'screens', label: 'Screen-time boundaries' },
];
export const FOCI = focusOptions.map((f) => f.id);
export const ageStage = (age: number | undefined | null): SummerStage => (age == null ? 'school' : age <= 5 ? 'young' : age >= 13 ? 'teen' : 'school');

interface Line {
  id: string;
  anchor: Anchor;
  /** Order within the anchor. */
  at: number;
  /** Rough time for a more structured day ('HH:MM'); on a camp day, or for an older child, when it differs. */
  time: string;
  campTime?: string;
  stageTime?: Partial<Record<SummerStage, string>>;
  words: Record<SummerStage, string | null>;
  /** A library job's illustration (src/data/responsibilities.ts). */
  icon?: string;
  /** Kept in every rhythm (a relaxed day still has these). */
  core?: true;
  /** Higher comes first when there isn't room. */
  priority: number;
  focus?: SummerFocus[];
  days?: SummerDays;
}

const same = (s: string) => ({ young: s, school: s, teen: s });
const lines: Line[] = [
  { id: 'dressed', anchor: 'Morning', at: 1, time: '08:00', words: same('Get dressed'), icon: 'get-dressed', core: true, priority: 10, focus: ['mornings'] },
  { id: 'breakfast', anchor: 'Morning', at: 2, time: '08:15', words: same('Breakfast'), core: true, priority: 10, focus: ['mornings'] },
  { id: 'bed', anchor: 'Morning', at: 3, time: '08:35', words: { young: 'Make my bed', school: 'Make my bed', teen: null }, icon: 'make-my-bed', priority: 3, focus: ['mornings'] },
  { id: 'teeth', anchor: 'Morning', at: 3, time: '08:35', words: { young: 'Brush my teeth', school: null, teen: null }, icon: 'brush-my-teeth', priority: 4, focus: ['mornings'] },
  { id: 'job', anchor: 'Morning', at: 4, time: '08:45', words: { young: 'Help with one job', school: 'My summer job: __________', teen: 'My summer job: __________' }, priority: 8.5, focus: ['responsibilities'] },
  { id: 'pack', anchor: 'Morning', at: 5, time: '08:50', words: { young: 'Get my camp bag', school: 'Pack my camp bag', teen: 'Pack what I need for the day' }, icon: 'pack-my-backpack', priority: 8, days: 'camp' },
  { id: 'camp', anchor: 'Midday', at: 1, time: '09:00', words: { young: 'Camp or program', school: 'Camp or program', teen: 'Camp, program or work' }, core: true, priority: 10, days: 'camp' },
  { id: 'outside', anchor: 'Midday', at: 1, time: '09:30', words: { young: 'Play outside', school: 'Play outside', teen: 'Get outside or get moving' }, priority: 8, focus: ['outdoor'], days: 'home' },
  { id: 'free', anchor: 'Midday', at: 2, time: '10:30', words: { young: 'Play on my own', school: 'Free play: my choice', teen: 'My own plans or a project' }, priority: 6, focus: ['independent'], days: 'home' },
  { id: 'lunch', anchor: 'Midday', at: 3, time: '12:00', words: same('Lunch'), core: true, priority: 9, days: 'home' },
  { id: 'quiet', anchor: 'Afternoon', at: 1, time: '13:00', words: { young: 'Rest or quiet time', school: 'Quiet time: read or rest', teen: 'Read, rest or recharge' }, priority: 7, focus: ['rest', 'reading'], days: 'home' },
  { id: 'downtime', anchor: 'Afternoon', at: 1, time: '15:30', words: { young: 'Snack and rest', school: 'Snack and downtime', teen: 'Snack and downtime' }, priority: 8, focus: ['rest'], days: 'camp' },
  { id: 'reading', anchor: 'Afternoon', at: 2, time: '14:00', campTime: '16:00', words: { young: 'Books together', school: 'Reading or a learning project', teen: 'Read or learn something new' }, priority: 4, focus: ['reading'] },
  { id: 'make', anchor: 'Afternoon', at: 3, time: '14:30', campTime: '16:15', words: { young: 'Draw, build or pretend', school: 'Make or build something', teen: 'Create, practice or build' }, priority: 3, focus: ['independent'] },
  { id: 'screens', anchor: 'Afternoon', at: 4, time: '15:30', campTime: '16:30', words: same('Screen time (our agreement)'), priority: 6, focus: ['screens'] },
  { id: 'table', anchor: 'Evening', at: 1, time: '17:30', words: { young: 'Set the table', school: 'Set the table', teen: 'Help with dinner' }, icon: 'set-the-table', priority: 5, focus: ['responsibilities'] },
  { id: 'dinner', anchor: 'Evening', at: 2, time: '18:00', words: same('Family dinner'), core: true, priority: 9 },
  { id: 'tidy', anchor: 'Evening', at: 3, time: '18:45', words: { young: 'Put toys away', school: 'Ten-minute tidy', teen: 'Quick reset of my space' }, icon: 'put-toys-away', priority: 6, focus: ['responsibilities'] },
  { id: 'bedtime', anchor: 'Evening', at: 4, time: '19:00', stageTime: { school: '20:00', teen: '21:30' }, words: { young: 'Get ready for bed', school: 'Get ready for bed', teen: 'Wind down: devices to charge' }, icon: 'get-ready-for-bed', core: true, priority: 9 },
];
// The tidy line's illustration fits a young child's toys; older children's reset is words only.
const iconFor = (l: Line, stage: SummerStage) => (l.id === 'tidy' && stage !== 'young' ? undefined : l.id === 'bedtime' && stage === 'teen' ? undefined : l.icon);

/** Steps per rhythm; a more structured day fills the chart's eight rows (ROUTINE_ROWS in src/data/routines.ts). */
const COUNT: Record<Structure, number> = { relaxed: 5, balanced: 8, structured: 8 };
const BEDTIME: Record<SummerStage, string> = { young: '19:30', school: '20:30', teen: '22:00' };

export interface SummerInput {
  stage: SummerStage;
  days: SummerDays;
  structure: Structure;
  focus: SummerFocus[];
}

export interface SummerRhythm {
  anchors: Anchor[];
  /** [time, step, note] like the chart's starters; times only for a more structured day. */
  steps: [string, string, string][];
  icons: (string | undefined)[];
  endLabel: string;
  endTime: string;
}

/** The starting steps for one child's summer days. */
export function summerRhythm(o: SummerInput): SummerRhythm {
  const fits = lines.filter((l) => l.words[o.stage] && (!l.days || l.days === o.days));
  const score = (l: Line) => (l.core ? 100 : 0) + l.priority + (l.focus?.some((f) => o.focus.includes(f)) ? 8 : 0);
  const chosen = [...fits].sort((a, b) => score(b) - score(a)).slice(0, COUNT[o.structure]);
  // Every anchor keeps at least one line, so the day still reads morning to evening.
  for (const a of ANCHORS) {
    if (chosen.some((l) => l.anchor === a)) continue;
    const add = fits.filter((l) => l.anchor === a).sort((x, y) => score(y) - score(x))[0];
    if (!add) continue;
    const drop = [...chosen].filter((l) => !l.core && chosen.filter((c) => c.anchor === l.anchor).length > 1).sort((x, y) => score(x) - score(y))[0];
    if (drop) chosen.splice(chosen.indexOf(drop), 1);
    chosen.push(add);
  }
  const ordered = chosen.sort((a, b) => ANCHORS.indexOf(a.anchor) - ANCHORS.indexOf(b.anchor) || a.at - b.at);
  const timed = o.structure === 'structured';
  return {
    anchors: ordered.map((l) => l.anchor),
    steps: ordered.map((l) => [timed ? (o.days === 'camp' && l.campTime) || l.stageTime?.[o.stage] || l.time : '', l.words[o.stage]!, '']),
    icons: ordered.map((l) => iconFor(l, o.stage)),
    endLabel: 'Lights out by',
    endTime: o.structure === 'relaxed' ? '' : BEDTIME[o.stage],
  };
}
