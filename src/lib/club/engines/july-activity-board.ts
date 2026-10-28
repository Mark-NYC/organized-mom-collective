/**
 * July 2027 Activity Board: the rules behind the one-page "I'm Bored! What Can I Do?" printable
 * (src/components/club/JulyActivityBoard.astro). Pure functions only, so the printable, the desktop rail and the
 * mobile plan screen (JulyPlanMobile.astro) read one plan.
 *
 * A board is three groups of up to three activities, chosen for one child's age (or for all the children), how they
 * play (alone, with a sibling, with friends already here), what they enjoy and indoors/outdoors. Each child keeps their
 * own board; the sheet prints the board that's selected. Children are by member ID.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-07';
export type Tier = 'quick' | 'busy' | 'project';
export const TIERS: readonly Tier[] = ['quick', 'busy', 'project'];
export const TIER_INFO: Record<Tier, { title: string; subtitle: string }> = {
  quick: { title: 'Start Playing', subtitle: 'I can start right now.' },
  busy: { title: 'Make & Imagine', subtitle: 'I want to get into something.' },
  project: { title: 'Keep Going', subtitle: 'I can work on this again tomorrow.' },
};
export const PER_TIER = 3;
export const LABEL_LIMIT = 55;
export const TEXT_LIMIT = 130;
export type Participation = 'solo' | 'sibling' | 'friends';
export type Focus = 'mixed' | 'inside' | 'outside';
export const PARTICIPATION: Record<Participation, { label: string; line: string; summary: string }> = {
  solo: { label: 'By myself', line: 'BY MYSELF', summary: 'By myself' },
  sibling: { label: 'With a sibling', line: 'WITH A SIBLING', summary: 'With a sibling' },
  friends: { label: 'With friends already here', line: 'WITH FRIENDS ALREADY HERE', summary: 'With friends' },
};
export const INTERESTS: Record<string, string> = { mixed: 'A bit of everything', art: 'Art and crafts', building: 'Building and LEGO', movement: 'Movement', stories: 'Stories and pretend play' };
export const FOCUS: Record<Focus, string> = { mixed: 'A little of everything', inside: 'Mostly indoors', outside: 'Mostly outdoors' };
export const DEFAULT_INTRO = 'Fun things I can do without asking Mom or Dad.';
export const DEFAULT_RULE = 'Before asking: Pick one · Get what you need · Have fun · Put things away.';

export interface Idea { id: string; label: string; icon: string; minAge?: number; maxAge?: number }
export const LIBRARY: Record<Tier, readonly Idea[]> = {
  quick: [
    { id: 'picture', label: 'Look at a picture book', icon: 'book', maxAge: 5 },
    { id: 'sort', label: 'Sort blocks by color', icon: 'blocks', maxAge: 5 },
    { id: 'doodle', label: 'Draw a funny animal', icon: 'draw', maxAge: 8 },
    { id: 'read', label: 'Read a book', icon: 'book', minAge: 6 },
    { id: 'draw', label: 'Draw a superhero', icon: 'draw', minAge: 6 },
    { id: 'build', label: 'Build with blocks', icon: 'blocks' },
    { id: 'stretch', label: 'Have a dance party', icon: 'dance', minAge: 6 },
    { id: 'look', label: 'Find five things in nature', icon: 'hunt', minAge: 6 },
    { id: 'friend-draw', label: 'Draw funny portraits together', icon: 'draw', minAge: 5 },
    { id: 'sibling-build', label: 'Build a LEGO tower together', icon: 'sibling', minAge: 5 },
    { id: 'cars', label: 'Make a Hot Wheels race track', icon: 'car', minAge: 5 },
  ],
  busy: [
    { id: 'pretend', label: 'Set up pretend play', icon: 'pretend', maxAge: 5 },
    { id: 'easy-puzzle', label: 'Work on a picture puzzle', icon: 'puzzle', maxAge: 5 },
    { id: 'picture-art', label: 'Make a big picture', icon: 'draw', maxAge: 5 },
    { id: 'puzzle', label: 'Finish a puzzle', icon: 'puzzle', minAge: 6 },
    { id: 'outdoor', label: 'Find five things in nature', icon: 'hunt', minAge: 6 },
    { id: 'craft', label: 'Make a paper craft', icon: 'craft', minAge: 6 },
    { id: 'bike', label: 'Ride my bike (ask first)', icon: 'bike', minAge: 6 },
    { id: 'tower', label: 'Build a giant tower', icon: 'blocks' },
    { id: 'reading', label: 'Read a whole chapter', icon: 'book', minAge: 9 },
    { id: 'sibling-puzzle', label: 'Solve a puzzle together', icon: 'sibling', minAge: 5 },
    { id: 'friend-game', label: 'Play a favorite board game', icon: 'game', minAge: 5 },
    { id: 'dough', label: 'Build a scene with Play-Doh', icon: 'dough', maxAge: 10 },
    { id: 'board-game', label: 'Play a favorite board game', icon: 'game', minAge: 6 },
  ],
  project: [
    { id: 'small-town', label: 'Build a pretend town', icon: 'blocks', maxAge: 5 },
    { id: 'picture-story', label: 'Make a picture story', icon: 'book', maxAge: 5 },
    { id: 'big-art', label: 'Add to a big drawing', icon: 'draw', maxAge: 5 },
    { id: 'city', label: 'Build a LEGO city', icon: 'legoCity', minAge: 6 },
    { id: 'story', label: 'Write & draw a story', icon: 'book', minAge: 9 },
    { id: 'course', label: 'Design a safe obstacle course', icon: 'rope', minAge: 6 },
    { id: 'comic', label: 'Draw a comic strip', icon: 'comic', minAge: 6 },
    { id: 'garden', label: 'Observe a plant growing', icon: 'tree', minAge: 6 },
    { id: 'mural', label: 'Make a big art project', icon: 'craft', minAge: 6 },
    { id: 'sibling-town', label: 'Build a pretend town together', icon: 'sibling', minAge: 5 },
    { id: 'friend-story', label: 'Invent a pretend-play story', icon: 'pretend', minAge: 5 },
    { id: 'bracelet', label: 'Make a friendship bracelet', icon: 'bracelet', minAge: 7 },
    { id: 'puppet', label: 'Put on a puppet show', icon: 'pretend', minAge: 5 },
  ],
};
const INTEREST_IDS: Record<string, string[]> = {
  mixed: [],
  art: ['doodle', 'draw', 'craft', 'comic', 'picture-art', 'big-art', 'mural', 'bracelet', 'dough'],
  building: ['build', 'tower', 'city', 'small-town', 'cars', 'dough'],
  movement: ['stretch', 'course', 'bike', 'look'],
  stories: ['read', 'picture', 'story', 'pretend', 'picture-story', 'reading', 'puppet', 'friend-story'],
};
const AGE_GROUPS: Record<'little' | 'middle' | 'older', Record<Tier, string[]>> = {
  little: { quick: ['picture', 'sort', 'build'], busy: ['pretend', 'easy-puzzle', 'picture-art'], project: ['small-town', 'picture-story', 'big-art'] },
  middle: { quick: ['read', 'draw', 'build'], busy: ['puzzle', 'outdoor', 'craft'], project: ['city', 'comic', 'course'] },
  older: { quick: ['read', 'draw', 'stretch'], busy: ['puzzle', 'reading', 'craft'], project: ['city', 'story', 'garden'] },
};

export interface Item { id: string; label: string }
export interface Board {
  quick: Item[];
  busy: Item[];
  project: Item[];
  participation: Participation;
  interest: string;
  focus: Focus;
  intro?: string;
  rule?: string;
}
export interface JulyState {
  /** 'family' (all the children) or a child's member ID. */
  child: string;
  boards: Record<string, Board>;
}
export interface JulyMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }

export const kidsOf = <M extends JulyMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived);
/** Age in July 2027, 2–18; the family board is pitched at 8. */
export const ageFor = (child: string, members: readonly JulyMember[]) => {
  const kid = kidsOf(members).find((k) => k.id === child);
  return kid?.birthYear ? Math.max(2, Math.min(18, ageInMonth(kid.birthYear, kid.birthMonth, KIT_MONTH))) : 8;
};
export const ideaById = (tier: Tier, id: string) => LIBRARY[tier].find((x) => x.id === id);
const item = (i: Idea): Item => ({ id: i.id, label: i.label });

/** What may go on this board: right for the age, and the together-ideas only when playing together. */
export const available = (tier: Tier, b: Board, age: number) => LIBRARY[tier].filter((x) => (x.minAge ?? 0) <= age && (x.maxAge ?? 99) >= age
  && (b.participation !== 'solo' || (!x.id.startsWith('sibling-') && !x.id.startsWith('friend-')))
  && (b.participation !== 'sibling' || !x.id.startsWith('friend-'))
  && (b.participation !== 'friends' || !x.id.startsWith('sibling-')));

export const preparedBoard = (age: number): Board => {
  const preset = age <= 5 ? AGE_GROUPS.little : age >= 10 ? AGE_GROUPS.older : AGE_GROUPS.middle;
  const pick = (tier: Tier) => preset[tier].map((id) => item(ideaById(tier, id)!));
  return { quick: pick('quick'), busy: pick('busy'), project: pick('project'), participation: 'solo', interest: 'mixed', focus: 'mixed' };
};

/** The first child's board, or the family board when there are no children. */
export const freshState = (members: readonly JulyMember[]): JulyState => ({ child: kidsOf(members)[0]?.id ?? 'family', boards: {} });
export const boardOf = (s: JulyState, members: readonly JulyMember[]) => (s.boards[s.child] ??= preparedBoard(ageFor(s.child, members)));

/** Keep the selected child and boards to people still on the profile. Mutates `s`. */
export const applyFamily = (s: JulyState, members: readonly JulyMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  for (const id of Object.keys(s.boards)) if (id !== 'family' && !ids.has(id)) delete s.boards[id];
  if (s.child !== 'family' && !ids.has(s.child)) s.child = kidsOf(members)[0]?.id ?? 'family';
  const b = boardOf(s, members);
  if (b.participation === 'sibling' && ids.size < 2) b.participation = 'solo';
  return s;
};

const isItem = (x: unknown): x is Item => Boolean(x) && typeof (x as Item).id === 'string' && typeof (x as Item).label === 'string';
const isBoard = (x: unknown): x is Board => {
  const b = x as Partial<Board> | null;
  return Boolean(b && TIERS.every((t) => Array.isArray(b[t]) && b[t]!.length <= PER_TIER && b[t]!.every(isItem))
    && b.participation && b.participation in PARTICIPATION && typeof b.interest === 'string' && b.focus && b.focus in FOCUS);
};
export const isJulyState = (x: unknown): x is JulyState => {
  const s = x as Partial<JulyState> | null;
  return Boolean(s && typeof s.child === 'string' && s.boards && typeof s.boards === 'object' && Object.values(s.boards).every(isBoard));
};

export const julyView = (s: JulyState, members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  const kid = kidsOf(members).find((k) => k.id === s.child);
  return {
    child: s.child,
    childName: kid?.firstName ?? 'My children',
    title: kid ? `${kid.firstName}'s activity ideas` : 'Our activity ideas',
    age: ageFor(s.child, members),
    mode: PARTICIPATION[b.participation].line,
    tiers: Object.fromEntries(TIERS.map((t) => [t, b[t].map((i) => ({ ...i, icon: ideaById(t, i.id)?.icon ?? 'lightbulb' }))])) as Record<Tier, (Item & { icon: string })[]>,
    intro: b.intro ?? DEFAULT_INTRO,
    rule: b.rule ?? DEFAULT_RULE,
    board: b,
    kids: kidsOf(members).map((k) => ({ id: k.id, name: k.firstName })),
  };
};
export type JulyView = ReturnType<typeof julyView>;

export const julyFingerprint = (s: JulyState, members: readonly JulyMember[]) => {
  const v = julyView(s, members);
  return JSON.stringify([v.title, v.mode, TIERS.map((t) => v.tiers[t].map((i) => [i.id, i.label])), v.intro, v.rule]);
};

// Edits on the selected board. Each changes `s` in place and returns it.

export const setChild = (s: JulyState, child: string, members: readonly JulyMember[]) => {
  if (child === 'family' || kidsOf(members).some((k) => k.id === child)) s.child = child;
  boardOf(s, members);
  return s;
};

/** Up to three activities from what's available; ones she renamed keep her name. */
export const setActivities = (s: JulyState, tier: Tier, ids: readonly string[], members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  const ok = available(tier, b, ageFor(s.child, members));
  const out: Item[] = [];
  for (const id of ids) {
    if (out.length >= PER_TIER || out.some((x) => x.id === id)) continue;
    const kept = b[tier].find((x) => x.id === id);
    const idea = ok.find((x) => x.id === id);
    if (kept) out.push(kept);
    else if (idea) out.push(item(idea));
  }
  b[tier] = out;
  return s;
};
export const toggleActivity = (s: JulyState, tier: Tier, id: string, members: readonly JulyMember[]) => {
  const ids = boardOf(s, members)[tier].map((x) => x.id);
  return setActivities(s, tier, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id], members);
};
export const relabel = (s: JulyState, tier: Tier, index: number, label: string, members: readonly JulyMember[]) => {
  const it = boardOf(s, members)[tier][index];
  if (it) it.label = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT) || ideaById(tier, it.id)?.label || it.label;
  return s;
};
export const removeActivity = (s: JulyState, tier: Tier, index: number, members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  b[tier] = b[tier].filter((_, i) => i !== index);
  return s;
};

const replaceSlot = (b: Board, tier: Tier, slot: number, ids: string[], age: number) => {
  const pick = ids.map((id) => available(tier, b, age).find((x) => x.id === id)).find((x): x is Idea => Boolean(x));
  if (pick && !b[tier].some((x) => x.id === pick.id)) b[tier][slot] = item(pick);
};
/** Playing together puts a together-idea first in each group; back to alone restores the prepared first ideas. */
export const setParticipation = (s: JulyState, p: Participation, members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  b.participation = p === 'sibling' && kidsOf(members).length < 2 ? 'solo' : p;
  const age = ageFor(s.child, members);
  const together = b.participation === 'sibling' ? { quick: 'sibling-build', busy: 'sibling-puzzle', project: 'sibling-town' }
    : b.participation === 'friends' ? { quick: 'friend-draw', busy: 'friend-game', project: 'friend-story' } : null;
  const prepared = preparedBoard(age);
  for (const t of TIERS) {
    b[t] = b[t].filter((x) => available(t, b, age).some((a) => a.id === x.id) || !ideaById(t, x.id));
    replaceSlot(b, t, 0, [together?.[t] ?? prepared[t][0].id], age);
  }
  return s;
};
export const setInterest = (s: JulyState, interest: string, members: readonly JulyMember[]) => {
  if (!(interest in INTERESTS)) return s;
  const b = boardOf(s, members);
  b.interest = interest;
  const age = ageFor(s.child, members);
  const ids = INTEREST_IDS[interest];
  if (ids.length) for (const t of TIERS) {
    const matches = available(t, b, age).filter((x) => ids.includes(x.id)).slice(0, PER_TIER);
    matches.forEach((x, i) => { b[t][i] = item(x); });
  }
  return s;
};
export const setFocus = (s: JulyState, focus: Focus, members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  b.focus = focus;
  const age = ageFor(s.child, members);
  if (focus === 'inside') { replaceSlot(b, 'busy', 1, ['tower', 'easy-puzzle'], age); replaceSlot(b, 'project', 2, ['comic', 'big-art'], age); }
  else if (focus === 'outside') { replaceSlot(b, 'quick', 1, ['look', 'sort'], age); replaceSlot(b, 'busy', 1, ['bike', 'pretend'], age); replaceSlot(b, 'project', 2, ['garden', 'big-art'], age); }
  else { replaceSlot(b, 'quick', 1, ['draw', 'sort'], age); replaceSlot(b, 'busy', 1, ['outdoor', 'easy-puzzle'], age); replaceSlot(b, 'project', 2, ['course', 'big-art'], age); }
  return s;
};
export const setText = (s: JulyState, key: 'intro' | 'rule', value: string, members: readonly JulyMember[]) => {
  const b = boardOf(s, members);
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (!clean || clean === (key === 'intro' ? DEFAULT_INTRO : DEFAULT_RULE)) delete b[key];
  else b[key] = clean;
  return s;
};
/** Only the selected board goes back to its prepared activities and wording. */
export const restoreBoard = (s: JulyState, members: readonly JulyMember[]) => { s.boards[s.child] = preparedBoard(ageFor(s.child, members)); return s; };
export const boardChanged = (s: JulyState, members: readonly JulyMember[]) => JSON.stringify(boardOf(s, members)) !== JSON.stringify(preparedBoard(ageFor(s.child, members)));

/**
 * The earlier July page kept { profile, state, boards } in localStorage with three slots a tier ({ id, label, removed }).
 * Read once for the same family, then the localStorage copy is removed (family plans stay in this tab).
 */
export const fromLegacy = (raw: string | null, profile: string, members: readonly JulyMember[]): JulyState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { profile?: string; state?: Record<string, unknown>; boards?: Record<string, Record<string, unknown>> } | null;
    if (!old?.state || old.profile !== profile) return null;
    const toBoard = (o: Record<string, unknown>, age: number): Board => {
      const b = preparedBoard(age);
      if (typeof o.participation === 'string' && o.participation in PARTICIPATION) b.participation = o.participation as Participation;
      if (typeof o.interest === 'string' && o.interest in INTERESTS) b.interest = o.interest;
      if (typeof o.focus === 'string' && o.focus in FOCUS) b.focus = o.focus as Focus;
      for (const t of TIERS) if (Array.isArray(o[t])) b[t] = (o[t] as (Item & { removed?: boolean })[]).filter((x) => isItem(x) && !x.removed && ideaById(t, x.id)).slice(0, PER_TIER).map((x) => ({ id: x.id, label: x.label.slice(0, LABEL_LIMIT) }));
      for (const k of ['intro', 'rule'] as const) if (typeof o[k] === 'string' && o[k] !== (k === 'intro' ? DEFAULT_INTRO : DEFAULT_RULE)) b[k] = (o[k] as string).slice(0, TEXT_LIMIT);
      return b;
    };
    const s = freshState(members);
    for (const [id, o] of Object.entries(old.boards ?? {})) if (o && typeof o === 'object') s.boards[id] = toBoard(o, ageFor(id, members));
    const child = typeof old.state.child === 'string' ? old.state.child : s.child;
    s.boards[child] = toBoard(old.state, ageFor(child, members));
    s.child = child;
    return applyFamily(s, members);
  } catch {
    return null;
  }
};

export interface JulyPlan extends PlanResource<JulyState> {
  members: () => JulyMember[];
  view: () => JulyView;
  setLocked: (on: boolean) => void;
  /** The desktop activity picker. */
  openEditor: () => void;
}
