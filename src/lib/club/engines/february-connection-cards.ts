/**
 * February 2027 Connection Cards: the personalization rules behind the one-page, four-card printable
 * (src/components/club/FebruaryConnectionCards.astro). Pure functions only, so the printable, the desktop rail and
 * the mobile plan screen (FebruaryPlanMobile.astro) read one plan.
 *
 * Each card is from one family member to another, by member ID. What prints is derived: a child's card to a parent
 * says Mom or Dad (editable as "what they call them"), and the invitation starts with that name until she rewrites it.
 */
import type { PlanResource } from '../plan/resource';

export const CARD_COUNT = 4;
/** The prepared wording, card by card: title, the invitation after the recipient's name, the little note. */
export const CARD_TEXT = [
  { headline: 'Game night?', body: 'will you play a game with me tonight?', idea: 'I’ll get the game ready!' },
  { headline: 'Just us two', body: 'will you read a book with me after dinner?', idea: 'I’ll pick the book!' },
  { headline: 'I picked you!', body: 'want to build something with me this weekend?', idea: 'You choose what we build.' },
  { headline: 'Let’s have fun!', body: 'will you make a blanket fort with me?', idea: 'I’ll bring the blankets!' },
] as const;
export const LIMITS = { name: 32, headline: 44, invite: 88, idea: 180 } as const;

export interface FebMember {
  id: string;
  firstName: string;
  kind: string;
  role?: string;
  archived?: boolean;
}

export interface FebCard {
  from: string;
  to: string;
  /** Her wording; absent means the prepared wording. */
  fromName?: string;
  toName?: string;
  headline?: string;
  invite?: string;
  idea?: string;
}
export interface FebState { cards: FebCard[] }
export type TextField = 'fromName' | 'toName' | 'headline' | 'invite' | 'idea';

export const planMembers = <M extends FebMember>(members: readonly M[]): M[] =>
  members.filter((m) => (m.kind === 'adult' || m.kind === 'child') && !m.archived && m.firstName.trim());

const parentsOf = (members: readonly FebMember[]) => members.filter((m) => m.kind === 'adult' && (m.role === 'parent' || m.role === 'partner'));

/** What the sender calls the recipient: a child calls the first two parents or partners Mom and Dad. */
export const address = (to: FebMember | undefined, from: FebMember | undefined, members: readonly FebMember[]) => {
  if (!to) return '';
  if (from?.kind !== 'child' || to.kind === 'child') return to.firstName;
  const i = parentsOf(members).findIndex((m) => m.id === to.id);
  return i === 0 ? 'Mom' : i === 1 ? 'Dad' : to.firstName;
};

/** The prepared sender and recipient: children invite parents on the first two cards, grown-ups invite children on the last two. */
export const suggestedPair = (i: number, all: readonly FebMember[]): { from: string; to: string } => {
  const members = planMembers(all);
  const kids = members.filter((m) => m.kind === 'child');
  const adults = members.filter((m) => m.kind === 'adult');
  const parents = parentsOf(members);
  const sender = i < 2 ? kids[i % Math.max(kids.length, 1)] ?? adults[0] : adults[(i - 2) % Math.max(adults.length, 1)] ?? kids[0];
  const preferred = i < 2 ? parents[i === 0 && parents.length > 1 ? 1 : 0] ?? adults[0] : kids[(i - 2) % Math.max(kids.length, 1)];
  const to = (preferred && preferred.id !== sender?.id ? preferred : undefined)
    ?? members.find((m) => m.id !== sender?.id && (i < 2 ? m.kind === 'adult' : m.kind === 'child'))
    ?? members.find((m) => m.id !== sender?.id);
  return { from: sender?.id ?? '', to: to?.id ?? '' };
};

export const freshState = (): FebState => ({ cards: [] });

/** Fill missing cards, and re-prepare any card whose sender or recipient is no longer on the sheet. Mutates `s`. */
export const applyFamily = (s: FebState, all: readonly FebMember[]) => {
  const ids = new Set(planMembers(all).map((m) => m.id));
  for (let i = 0; i < CARD_COUNT; i++) {
    const card = s.cards[i];
    const valid = card && ids.has(card.from) && (card.to === '' ? ids.size < 2 : ids.has(card.to)) && card.from !== card.to;
    if (!valid) {
      const pair = suggestedPair(i, all);
      const { headline, invite, idea } = card ?? {};
      s.cards[i] = { ...pair, ...(headline ? { headline } : {}), ...(invite ? { invite } : {}), ...(idea ? { idea } : {}) };
    }
  }
  s.cards.length = CARD_COUNT;
  return s;
};

export const isFebState = (x: unknown): x is FebState => {
  const s = x as Partial<FebState> | null;
  return Boolean(s && Array.isArray(s.cards) && s.cards.every((c) => c && typeof c.from === 'string' && typeof c.to === 'string'
    && (['fromName', 'toName', 'headline', 'invite', 'idea'] as const).every((k) => c[k] === undefined || typeof c[k] === 'string')));
};

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Everything the sheet shows, card by card. */
export const febView = (s: FebState, all: readonly FebMember[]) => {
  const members = planMembers(all);
  return Array.from({ length: CARD_COUNT }, (_, i) => {
    const c = s.cards[i] ?? suggestedPair(i, all);
    const from = members.find((m) => m.id === c.from);
    const to = members.find((m) => m.id === c.to);
    const toLabel = c.toName ?? address(to, from, members);
    const text = CARD_TEXT[i];
    return {
      from, to,
      owner: c.fromName ?? from?.firstName ?? '',
      recipient: toLabel,
      headline: c.headline ?? text.headline,
      invite: c.invite ?? (toLabel ? `${toLabel}, ${text.body}` : cap(text.body)),
      idea: c.idea ?? text.idea,
    };
  });
};
export type FebView = ReturnType<typeof febView>;

export const febFingerprint = (s: FebState, all: readonly FebMember[]) =>
  JSON.stringify(febView(s, all).map(({ owner, recipient, headline, invite, idea }) => [owner, recipient, headline, invite, idea]));

/** The prepared text for a field, for this card as it stands (the invitation follows the recipient's name). */
export const preparedText = (s: FebState, i: number, field: TextField, all: readonly FebMember[]) => {
  const v = febView({ cards: s.cards.map((c, j) => (j === i ? { from: c.from, to: c.to } : c)) }, all)[i];
  return { fromName: v.owner, toName: v.recipient, headline: v.headline, invite: v.invite, idea: v.idea }[field];
};

const limit = (field: TextField) => (field === 'fromName' || field === 'toName' ? LIMITS.name : LIMITS[field]);

/** Wording on one card; blank or the prepared wording goes back to prepared. A new name for the recipient carries into the invitation. */
export const setText = (s: FebState, i: number, field: TextField, value: string, all: readonly FebMember[]) => {
  const c = s.cards[i];
  if (!c) return s;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, limit(field));
  const before = febView(s, all)[i].recipient;
  if (!clean || clean === preparedText(s, i, field, all)) delete c[field];
  else c[field] = clean;
  if (field === 'toName') followRecipient(c, before, febView(s, all)[i].recipient);
  return s;
};

/** Her own invitation keeps her words; only a leading "Name," moves to the new recipient. */
const followRecipient = (c: FebCard, before: string, after: string) => {
  if (c.invite && before && c.invite.startsWith(`${before},`)) c.invite = after ? `${after}${c.invite.slice(before.length)}` : cap(c.invite.slice(before.length + 1).trim());
};

/** Change who sends or receives. The other person moves over if they'd be the same. Names she typed for that person go. */
export const setPerson = (s: FebState, i: number, side: 'from' | 'to', id: string, all: readonly FebMember[]) => {
  const c = s.cards[i];
  const members = planMembers(all);
  if (!c || !members.some((m) => m.id === id) || c[side] === id) return s;
  const before = febView(s, all)[i].recipient;
  const other = side === 'from' ? 'to' : 'from';
  const swapped = c[other] === id;
  if (swapped) c[other] = c[side];
  c[side] = id;
  // What the sender calls the recipient depends on both; a sender's own name goes with the sender.
  delete c.toName;
  if (side === 'from' || swapped) delete c.fromName;
  followRecipient(c, before, febView(s, all)[i].recipient);
  return s;
};

export const restoreCard = (s: FebState, i: number, all: readonly FebMember[]) => {
  s.cards[i] = suggestedPair(i, all);
  return s;
};
export const restoreAll = (s: FebState, all: readonly FebMember[]) => {
  s.cards = Array.from({ length: CARD_COUNT }, (_, i) => suggestedPair(i, all));
  return s;
};
export const cardChanged = (s: FebState, i: number, all: readonly FebMember[]) => {
  const c = s.cards[i];
  const p = suggestedPair(i, all);
  return Boolean(c && (c.from !== p.from || c.to !== p.to || c.fromName || c.toName || c.headline || c.invite || c.idea));
};

/**
 * The plan saved by the earlier February page (sessionStorage `omc:club:february-mobile:v1:<family>`):
 * { fingerprint, cards: [{ owner, recipient, headline, invite, idea }] } with names, not IDs. Names that match a
 * person are read back as that person; anything else is kept as her wording.
 */
export const fromLegacy = (raw: string | null, all: readonly FebMember[]): FebState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { cards?: { owner?: unknown; recipient?: unknown; headline?: unknown; invite?: unknown; idea?: unknown }[] } | null;
    if (!Array.isArray(old?.cards) || old.cards.length !== CARD_COUNT) return null;
    const members = planMembers(all);
    const s = restoreAll(freshState(), all);
    old.cards.forEach((o, i) => {
      const str = (x: unknown) => (typeof x === 'string' ? x : '');
      const by = (name: string, from?: FebMember) => members.find((m) => m.firstName === name || (from && address(m, from, members) === name));
      const from = by(str(o.owner));
      if (from) setPerson(s, i, 'from', from.id, all);
      else if (str(o.owner)) setText(s, i, 'fromName', str(o.owner), all);
      const sender = members.find((m) => m.id === s.cards[i].from);
      const to = by(str(o.recipient), sender);
      if (to && to.id !== s.cards[i].from) setPerson(s, i, 'to', to.id, all);
      else if (str(o.recipient)) setText(s, i, 'toName', str(o.recipient), all);
      for (const f of ['headline', 'invite', 'idea'] as const) if (str(o[f])) setText(s, i, f, str(o[f]), all);
    });
    return s;
  } catch {
    return null;
  }
};

export interface FebPlan extends PlanResource<FebState> {
  members: () => FebMember[];
  view: () => FebView;
  setLocked: (on: boolean) => void;
  /** The desktop editor, at one card. */
  openEditor: (card?: number) => void;
}
