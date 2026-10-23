/**
 * Organized Family Club: the shape of a monthly kit (docs/club/KIT_TEMPLATE.md). Planning-phase code: no page,
 * function or database reads this yet (docs/club/IMPLEMENTATION_PLAN.md → Phase 1).
 *
 * A kit is one file in src/data/club/kits/, reviewed in a pull request. Its content is curated and deterministic:
 * the engines in src/lib/club/engines/ turn a family profile plus these rules into a filled-in kit, with no AI.
 */
import type { CountdownItem } from '../../lib/club/countdown';

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

/**
 * Where a row sits: work for the whole family, their own room or things, taking care of themselves; a routine's
 * morning or after-school steps; a recurring commitment (a practice, a lesson) on the command center.
 */
export type ChartSection = 'family' | 'space' | 'self' | 'morning' | 'after-school' | 'commitment';
export const CHART_SECTIONS: readonly ChartSection[] = ['family', 'space', 'self', 'morning', 'after-school', 'commitment'];

/** Where a child goes to school this year (a kit's school setup; never assumed the same for every child). */
export type SchoolType = 'public' | 'private' | 'homeschool' | 'preschool' | 'none';
export const SCHOOL_TYPES: readonly SchoolType[] = ['public', 'private', 'homeschool', 'preschool', 'none'];

/** When a one-time prep task is due, counted back from a child's first day. */
export type Lead = 'two-weeks' | 'one-week' | 'night-before' | 'first-day';
export const LEAD_DAYS: Record<Lead, number> = { 'two-weeks': 14, 'one-week': 7, 'night-before': 1, 'first-day': 0 };

/** Household preferences that turn items on (club_households.preferences). */
export interface Requires {
  pets?: true;
  faith_content?: true;
  school?: 'homeschool' | 'public';
  /**
   * A child's school type this year (kits with a school setup). On a child's own item ("each"): that child's type is
   * one of these. On a household item: at least one child's is.
   */
  childSchool?: SchoolType[];
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
  /** One-time prep tasks: when, counted back from the child's (or the earliest) first day. */
  lead?: Lead;
  /** Shown on a kit's overview as a recommended first action, lowest first. */
  priority?: number;
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
  /** For engine-filled printables: which item set to run ('items', 'reset', or a key of the kit's `itemSets`). */
  items?: string;
  /**
   * How the editor works: 'chart' (owners, the default), 'command' (shared owners plus the family's recurring
   * commitments).
   */
  editor?: 'chart' | 'command';
  /** Tab name in the kit (defaults from the kind). */
  tabLabel?: string;
  /** Lives under the kit's "In the mail" tab instead of its own (the mailer's printable twins). */
  secondary?: true;
  /** For a worksheet: its intro and lines, each useful printed on its own; `lineLabel` heads the per-person lines. */
  content?: { intro: string; items: string[]; lineLabel?: string };
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
  /** More engine-filled printables' rules, by key (KitPrintable.items). */
  itemSets?: Record<string, KitItem[]>;
  /**
   * Kits that need to know where each child goes to school. Today it's guessed from age and the family's
   * homeschool preference (src/lib/club/school.ts), with no setup step.
   */
  setup?: 'school';
  /** The line under the theme, on screen and on the letter ("One calmer start. Everyone has a part."). */
  subtitle?: string;
  /**
   * The month's one action (three-part kits: the letter, the action, the tool): a short checklist the family does
   * together, printed on the front of the letter and checkable on screen. Each line has a suggested number of days
   * before a date she enters (src/lib/club/countdown.ts). Never per-person assignments; each line has an optional
   * `helperLabel` blank instead.
   */
  action?: {
    /**
     * 'countdown' (August): she enters a date and each line gets a suggested day (`daysBefore`).
     * 'checklist' (October): the lines alone, no dates, done whenever suits the family.
     */
    kind: 'countdown' | 'checklist';
    title: string;
    /** The heading on screen, when it differs from the printed title ("Your Back-to-School Countdown"). */
    screenTitle?: string;
    intro: string;
    items: CountdownItem[];
    helperLabel?: string;
    /** Where the helper blank goes: beside the line (a name: "Who's helping?") or under it, full width (February's "Our idea"). */
    helperPlacement?: 'beside' | 'below';
    /** One line under the intro, on screen and on the letter: how to use it if she's already started (December). */
    note?: string;
    /** She can reword a line for her family (her wording prints on her copy; the mailer keeps the kit's). */
    editable?: true;
    /**
     * The family's one thing (January): a blank above the steps on the letter; online, one of the suggestions (the
     * tool's own ids, handed to it) or her own words, a short plan on step `planAt`, an optional start day on step
     * `startAt` with its check-in a week later. No tracking beyond the steps' checkboxes.
     */
    focus?: {
      label: string;
      printLabel: string;
      suggestions: { id: string; label: string }[];
      /** What the suggestions are, for screen readers (default "Ideas for your one thing"). */
      suggestionsLabel?: string;
      /** January: a short plan on this step, and a start day on `startAt` with its check-in a week later. */
      planAt?: number;
      planLabel?: string;
      startAt?: number;
      startLabel?: string;
      /** March: one optional day with the one thing ("When we’re doing it"), a blank on the letter. No check-in. */
      whenLabel?: string;
    };
  };
  /**
   * The month's one optional tool: one of the site's own tools, opened inside the Club (src/data/club/tools.ts), never
   * a Club copy of it; and the invitation to it.
   */
  tool?: {
    tool: string;
    title: string;
    blurb: string;
    cta: string;
    note?: string;
    /** How the tool starts when the kit offers no choice (the tool's own variant id, e.g. the chore chart's 'one-job'). */
    start?: string;
  };
  /**
   * The kit opens on a short overview: her family's situation and a few recommended first actions (items with
   * `priority` in `from`), then the detail one tap away.
   */
  overview?: { from: string; intro: string; minActions: number; maxActions: number };
  printables: KitPrintable[];
  mailer: {
    /**
     * Megan's letter, in her words. null until written; `draft` until she's approved it. A kit can't be scheduled
     * with either.
     */
    letter: {
      title: string;
      /** For a letter without her name. */
      greeting?: string;
      /** With her first name, when it's reliably known: 'Hi {name},'. Never a made-up name. */
      namedGreeting?: string;
      body: string;
      signoff?: string;
      draft?: true;
    } | null;
    /** Three-part kits: the guidance on the back of the letter (a short `intro`, then a few principles). */
    fieldGuide: { title: string; intro?: string; sections: { heading: string; body: string }[] };
    /** Three-part kits: a short worked example in words, on the back of the letter. */
    story?: { title: string; body: string };
    /** A compact reference on the back (April's kitchen jobs by age): a few rows, suggestions, never rules. */
    ageGuide?: { title: string; note: string; rows: { ages: string; jobs: string }[] };
    /** One small tip on the back (April's five-minute pantry check). */
    tip?: { title: string; body: string };
    /** A small keepsake on the back for a child to fill in (May's reflection prompts), with room to write; can be cut out. */
    reflection?: { title: string; note: string; prompts: string[] };
    /** A short optional list on the back (March's decluttering ideas): small boxes, framed as ideas, not more work. */
    checklist?: { title: string; note: string; items: string[] };
    /** Three-part kits: on the kit page, how the mailed copy and her own printout relate (one or the other, never both). */
    screenNote?: string;
    /** A "Read this month's letter" link under the kit's title (the letter itself sits at the end of the page). */
    letterLinkTop?: true;
    /** A family activity (November's team meeting). Three-part kits use `action` instead. */
    activity?: { title: string; minutes: number; steps: string[] };
    /** Three-part kits: the month's one family conversation question, on the back of the letter. */
    conversation?: {
      label: string;
      question: string;
      note?: string;
      /** Where it sits on the back: first (August) or after the example (October). */
      placement?: 'top' | 'after-example';
      /** Several short prompts instead of the one question (February): printed as a list, the letter's question among them. */
      prompts?: string[];
    };
    /** Three-part kits: a worked example on the back of the letter: the tool's own starter (src/data/routines.ts). */
    example?: { title: string; variant: string };
    /** Three-part kits: the invitation beside the QR code, and the one reminder about the family calendar. */
    invite?: { title: string; body: string };
    calendarNote?: string;
    /** '/club/kits/<slug>?source=mailer' */
    qrPath: string;
    /**
     * A restrained seasonal touch on the letter: December's evergreen sprig; February's fine-line heart and blush
     * panels; March's leafy stem; April's place setting and pale apricot panels; May's open notebook and soft blue panels.
     */
    accent?: 'evergreen' | 'blush' | 'spring' | 'table' | 'school';
  };
  /** Free tools this kit points to instead of duplicating (paths from src/routes.ts). */
  related?: string[];
}
