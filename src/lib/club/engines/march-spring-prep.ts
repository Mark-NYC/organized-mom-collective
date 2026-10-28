/**
 * March 2027 Spring Prep: the personalization rules behind the one-page printable
 * (src/components/club/MarchSpringPrep.astro). The five jobs are the cleaning companion's own March project
 * (src/data/cleaning.ts, never retyped); this adds who owns each job and how to do it. Pure functions only, so the
 * printable, the desktop rail and the mobile plan screen (MarchPlanMobile.astro) read one plan.
 *
 * Owners are member IDs, or '' for optional and unassigned. Grown-ups own the jobs with heights or ladders; children
 * 5 and up can own the rest. On the sheet, which children read, the first two parents are Mom and Dad.
 */
import { monthlyDeepClean } from '../../../data/cleaning';
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-03';
export const PROJECT = monthlyDeepClean.find((p) => p.month === 2)!;
export const ADULT_ONLY = new Set(['mar-vents', 'mar-curtains']);
export const MIN_CHILD_AGE = 5;

export const TASK_ICONS: Record<string, string> = {
  'mar-baseboards': 'spray-bottle-and-cloth', 'mar-vents': 'duster', 'mar-winter-gear': 'sorting-clothes',
  'mar-curtains': 'washing-window', 'mar-donate': 'donation-box',
};
export const HANDOFFS: Record<string, { ready: string; doJob: string; done: string; supplies: string; childRole: string }> = {
  'mar-baseboards': { ready: 'Take a soft cloth and dampen it with water. Choose one room.', doJob: 'Wipe reachable baseboards and corners.', done: 'No visible dust; cloth rinsed and put away.', supplies: 'Soft cloth + water', childRole: 'Children 5+: own one reachable room.' },
  'mar-vents': { ready: 'Turn fans off. Gather a microfiber duster.', doJob: 'An adult dusts accessible vents and fan blades safely.', done: 'Visible dust is gone; tools put away.', supplies: 'Microfiber duster + cloth', childRole: 'Children: put away safe supplies only.' },
  'mar-winter-gear': { ready: 'Gather hats, gloves and scarves. Get a storage bin.', doJob: 'Sort items; set aside anything still needed.', done: 'Stored items are clean and dry; labeled bin put away.', supplies: 'Storage bin + label', childRole: 'Children 5+: sort their own gear.' },
  'mar-curtains': { ready: 'Check fabric care labels and gather supplies.', doJob: 'An adult cleans one set and handles taking down/rehanging.', done: 'Curtains are clean, dry and rehung properly.', supplies: 'Laundry supplies or duster', childRole: 'Children: help with safe sorting only.' },
  'mar-donate': { ready: 'Get a bag. Choose one small area.', doJob: 'Suggest unused items; ask before adding anyone else’s.', done: 'Adult approves contents; bag goes to donation spot.', supplies: 'Donation bag', childRole: 'Children 5+: suggest their own items.' },
};
export const TASK_TYPES: Record<string, string> = {
  'mar-baseboards': 'Children can wipe reachable areas with a soft, damp cloth. An adult handles anything higher.',
  'mar-vents': 'Adult job. Keep children off ladders and away from ceiling fans and vents.',
  'mar-winter-gear': 'Kids can help sort their own gear; a grown-up decides what is ready to store.',
  'mar-curtains': 'Adult job for removal, washing, and rehanging. Kids can help with safe sorting.',
  'mar-donate': 'Children can suggest items. A grown-up approves what leaves the home.',
};

export type Field = 'title' | 'supplies' | 'ready' | 'doJob' | 'done';
export const FIELDS: readonly { id: Field; label: string; limit: number }[] = [
  { id: 'title', label: 'Job', limit: 60 },
  { id: 'supplies', label: 'Supplies', limit: 180 },
  { id: 'ready', label: 'Get ready', limit: 180 },
  { id: 'doJob', label: 'Do the job', limit: 180 },
  { id: 'done', label: 'Check it’s done', limit: 180 },
];
export const UNASSIGNED = 'Optional · unassigned';

export const prepared = (task: string, field: Field) => (field === 'title' ? PROJECT.tasks.find((t) => t.id === task)?.label ?? '' : HANDOFFS[task]?.[field] ?? '');

export interface MarMember {
  id: string;
  firstName: string;
  kind: string;
  role?: string;
  birthYear?: number;
  birthMonth?: number;
  isAccountHolder?: boolean;
  archived?: boolean;
}

export interface MarState {
  /** taskId → member ID, or '' (optional, unassigned). */
  owners: Record<string, string>;
  /** Jobs whose owner she chose herself; the rest follow the family. */
  customized: string[];
  text: Record<string, Partial<Record<Field, string>>>;
}

export const planMembers = <M extends MarMember>(members: readonly M[]): M[] => members.filter((m) => (m.kind === 'adult' || m.kind === 'child') && !m.archived);

export const eligible = (task: string, m: MarMember) => {
  if (m.archived) return false;
  if (m.kind === 'adult') return true;
  return !ADULT_ONLY.has(task) && m.birthYear !== undefined && ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH) >= MIN_CHILD_AGE;
};

/** The prepared owner: children 5+ own the reachable jobs, grown-ups the ones with heights. */
export const suggestedOwner = (task: string, all: readonly MarMember[]) => {
  const members = planMembers(all);
  const adults = members.filter((m) => m.kind === 'adult');
  const kids = members.filter((m) => m.kind === 'child' && eligible(task, m));
  const pick = ADULT_ONLY.has(task) ? adults[task === 'mar-vents' && adults.length > 1 ? 1 : 0]
    : task === 'mar-baseboards' ? kids[0] ?? adults[0]
      : task === 'mar-winter-gear' ? kids[1] ?? kids[0] ?? adults[0]
        : task === 'mar-donate' ? adults[0] ?? kids[0]
          : adults[0];
  return pick?.id ?? '';
};

/** Children by first name; the first two parents or partners are Mom and Dad, other grown-ups by name. */
export const ownerLabel = (m: MarMember, all: readonly MarMember[]) => {
  if (m.kind === 'child') return m.firstName;
  const parents = planMembers(all).filter((x) => x.kind === 'adult' && (x.role === 'parent' || x.role === 'partner'));
  const i = parents.findIndex((x) => x.id === m.id);
  return i === 0 ? 'Mom' : i === 1 ? 'Dad' : m.firstName;
};

export const freshState = (): MarState => ({ owners: {}, customized: [], text: {} });

/** Fill owners she hasn't chosen, and re-prepare any whose person can't own the job any more. Mutates `s`. */
export const applyFamily = (s: MarState, all: readonly MarMember[]) => {
  const members = planMembers(all);
  for (const { id } of PROJECT.tasks) {
    const owner = s.owners[id];
    const kept = s.customized.includes(id) && (owner === '' || members.some((m) => m.id === owner && eligible(id, m)));
    if (!kept) {
      s.owners[id] = suggestedOwner(id, all);
      s.customized = s.customized.filter((t) => t !== id);
    }
  }
  return s;
};

export const isMarState = (x: unknown): x is MarState => {
  const s = x as Partial<MarState> | null;
  return Boolean(s && s.owners && typeof s.owners === 'object' && Object.values(s.owners).every((v) => typeof v === 'string')
    && Array.isArray(s.customized) && s.text && typeof s.text === 'object');
};

export const marView = (s: MarState, all: readonly MarMember[], displayName?: string) => {
  const members = planMembers(all);
  return {
    family: displayName ?? 'Our Family',
    tasks: PROJECT.tasks.map((t) => {
      const owner = members.find((m) => m.id === s.owners[t.id] && eligible(t.id, m));
      return {
        id: t.id,
        adultOnly: ADULT_ONLY.has(t.id),
        ownerId: owner?.id ?? '',
        owner: owner ? ownerLabel(owner, members) : UNASSIGNED,
        ...Object.fromEntries(FIELDS.map((f) => [f.id, s.text[t.id]?.[f.id] ?? prepared(t.id, f.id)])) as Record<Field, string>,
      };
    }),
  };
};
export type MarView = ReturnType<typeof marView>;

export const marFingerprint = (s: MarState, all: readonly MarMember[], displayName?: string) => {
  const v = marView(s, all, displayName);
  return JSON.stringify([v.family, v.tasks.map((t) => [t.owner, ...FIELDS.map((f) => t[f.id])])]);
};

// Edits. Each changes `s` in place and returns it.

/** '' leaves the job optional and unassigned. */
export const setOwner = (s: MarState, task: string, memberId: string, all: readonly MarMember[]) => {
  if (memberId && !planMembers(all).some((m) => m.id === memberId && eligible(task, m))) return s;
  s.owners[task] = memberId;
  if (!s.customized.includes(task)) s.customized.push(task);
  return s;
};

export const setText = (s: MarState, task: string, field: Field, value: string) => {
  const limit = FIELDS.find((f) => f.id === field)!.limit;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, limit);
  const edits = (s.text[task] ??= {});
  if (!clean || clean === prepared(task, field)) delete edits[field];
  else edits[field] = clean;
  if (!Object.keys(edits).length) delete s.text[task];
  return s;
};

export const restoreOwners = (s: MarState, all: readonly MarMember[]) => { s.customized = []; return applyFamily(s, all); };
export const restoreWording = (s: MarState) => { s.text = {}; return s; };
export const ownersChanged = (s: MarState) => s.customized.length > 0;
export const wordingChanged = (s: MarState) => Object.keys(s.text).length > 0;

/**
 * The plan saved by the earlier March page (sessionStorage `omc:club:march-mobile:v1:<sample|account>:<householdId>`):
 * { sampleKey, chosen, custom, customOwnerLabels, textEdits }. Owners were already member IDs.
 */
export const fromLegacy = (raw: string | null): MarState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { chosen?: Record<string, unknown>; custom?: unknown; textEdits?: Record<string, Record<string, unknown>> } | null;
    if (!old?.chosen) return null;
    const s = freshState();
    for (const { id } of PROJECT.tasks) {
      if (typeof old.chosen[id] === 'string') s.owners[id] = old.chosen[id] as string;
      if (Array.isArray(old.custom) && old.custom.includes(id)) s.customized.push(id);
      for (const f of FIELDS) {
        const v = old.textEdits?.[id]?.[f.id];
        if (typeof v === 'string') setText(s, id, f.id, v);
      }
    }
    return s;
  } catch {
    return null;
  }
};

export interface MarPlan extends PlanResource<MarState> {
  members: () => MarMember[];
  view: () => MarView;
  setLocked: (on: boolean) => void;
  /** The desktop owner editor. */
  openEditor: () => void;
}
