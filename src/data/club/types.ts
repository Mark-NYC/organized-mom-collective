/**
 * Organized Family Club: the shape of a monthly kit (docs/club/KIT_TEMPLATE.md). Planning-phase code: no page,
 * function or database reads this yet (docs/club/IMPLEMENTATION_PLAN.md → Phase 1).
 *
 * A kit is one file in src/data/club/kits/, reviewed in a pull request. Its content is curated and deterministic:
 * the engines in src/lib/club/engines/ turn a family profile plus these rules into a filled-in kit, with no AI.
 */

export type EngineId = 'responsibilities' | 'routines' | 'planning' | 'projects';

export type Frequency = 'daily' | 'weekdays' | 'twice-weekly' | 'weekly' | 'as-needed' | 'once';
export const FREQUENCIES: readonly Frequency[] = ['daily', 'weekdays', 'twice-weekly', 'weekly', 'as-needed', 'once'];

/**
 * How much of a job is theirs, always owner language, never "helps Mom":
 * - learning: their job, done with a grown-up or older sibling beside them while they learn it
 * - with-check: their job start to finish; their coach checks it's done
 * - owns: theirs completely, including noticing it needs doing. Nobody reminds or checks.
 */
export type OwnershipLevel = 'learning' | 'with-check' | 'owns';
export const OWNERSHIP_LEVELS: readonly OwnershipLevel[] = ['learning', 'with-check', 'owns'];

/** Where a job sits on the chart: work for the whole family, their own room or things, taking care of themselves. */
export type ChartSection = 'family' | 'space' | 'self';

/** Household preferences that turn items on (club_households.preferences). */
export interface Requires {
  pets?: true;
  faith_content?: true;
  school?: 'homeschool' | 'public';
}

/** One curated thing an engine may place on someone's row. */
export interface KitItem {
  /** Stable forever once released: saved edits point at it. Reword `title` freely; never reuse an id. */
  id: string;
  /** Short chart wording. Adult items are whole jobs, written start to finish. */
  title: string;
  /** What "done" looks like when they own it, so nobody has to inspect it. */
  doneMeans: string;
  /** adult: adults only. child: children and teens. anyone: children past minAge, teens and adults. */
  for: 'adult' | 'child' | 'anyone';
  /** Children and teens only (adults are never age-limited). */
  minAge?: number;
  maxAge?: number;
  /** Ownership level from an age, ascending, e.g. [[4, 'learning'], [6, 'with-check'], [9, 'owns']]. Adults always own. */
  levels?: [age: number, level: OwnershipLevel][];
  frequency: Frequency;
  /** Relative weekly load, 1 small – 5 big. Balancing uses it; it's never shown. */
  effort: 1 | 2 | 3 | 4 | 5;
  section: ChartSection;
  /**
   * household: the family needs it done once, so it gets exactly one owner (set the table, the trash).
   * each: every eligible person gets their own (make my bed, put my clothes away). Never balanced between people.
   */
  scope: 'household' | 'each';
  /** Household jobs every family needs: placed before the extras. */
  core?: boolean;
  area?: string;
  /** Jobs that cover the same ground (cleaning a bathroom includes its sink): a family gets one or the other. */
  excludes?: string[];
  requires?: Requires;
  /** An id from src/data/responsibilities.ts: the illustration and its fixed category color. */
  illustration?: string;
}

export interface KitPrintable {
  /** club_documents.doc: stable once released. */
  id: string;
  title: string;
  page: 'letter-portrait' | 'letter-landscape';
  kind: 'flagship' | 'worksheet' | 'reset' | 'activity';
  /** Component in src/components/club/print/ (Phase 1 UI). */
  component: string;
  /** For engine-filled printables: which item set to run. */
  items?: 'items' | 'reset';
}

export interface KitInput {
  id: string;
  label: string;
  type: 'time' | 'date' | 'choice';
  default: string;
  options?: string[];
}

export interface KitConfig {
  /** 'YYYY-MM-theme', permanent once printed on a mailer. */
  slug: string;
  /** 'YYYY-MM' */
  month: string;
  theme: string;
  /** The one shift this kit asks of the family, in a sentence. */
  shift: string;
  engine: EngineId;
  /** Bump when rules change in a way saved edits must be checked against. */
  engineVersion: number;
  /** At most two kit-specific choices, each with a default, so the kit opens filled in. */
  inputs?: KitInput[];
  /** The flagship generator's rules. */
  items: KitItem[];
  /** The month's team reset: the companion's monthly project (src/data/cleaning.ts) as owned jobs. */
  reset?: { month: number; title: string; items: KitItem[] };
  printables: KitPrintable[];
  mailer: {
    /** Megan's letter, in her words. null until she's written it; a kit can't be scheduled without it. */
    letter: { title: string; body: string } | null;
    fieldGuide: { title: string; sections: { heading: string; body: string }[] };
    activity: { title: string; minutes: number; steps: string[] };
    /** '/club/kits/<slug>?source=mailer' */
    qrPath: string;
  };
  /** Free tools this kit points to instead of duplicating (paths from src/routes.ts). */
  related?: string[];
}
