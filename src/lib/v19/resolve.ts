/**
 * V19: resolving an insight, and learning from how the family responded. Every change goes through an existing
 * workflow: an agreement edit is the same edit + "We agree" the meeting uses; a cleaning move is the cleaning
 * companion's one-week move; a handoff is a Suggested part the other person still agrees to; an event is the family's
 * own calendar event. Nothing happens until the family taps "Update our plan".
 */
import { addDays } from '../calendar/recurrence';
import { moveSession, partReducer, type V16State } from '../v16/model';
import { confirm } from '../v18/memory';
import { emptyIntel } from '../v18/engine';
import { laterUntil, type Feedback, type SmartInsight } from './attention';

const intelOf = (s: V16State) => s.intel ?? emptyIntel('m-ana');

export function addFeedback(s: V16State, i: Pick<SmartInsight, 'key' | 'fingerprint' | 'pattern'>, kind: Feedback['kind'], today: string, until?: string): V16State {
  const intel = intelOf(s);
  const rest = (intel.feedback ?? []).filter((f) => !(f.key === i.key && f.kind === kind));
  return { ...s, intel: { ...intel, feedback: [...rest, { key: i.key, fingerprint: i.fingerprint, pattern: i.pattern, kind, on: today, until }] } };
}

/**
 * The optional feedback after a Dismiss. A plain Dismiss means only "not now, for these facts".
 *   handled       the underlying issue is taken care of
 *   not-relevant  this kind of suggestion doesn't fit this family (needs: remembered as "not needed for us")
 *   later         hide until its useful window (or tomorrow)
 *   never         don't suggest this pattern again (correctable in Account; calendar changes always still count)
 */
export function giveFeedback(s: V16State, i: SmartInsight, kind: 'handled' | 'not-relevant' | 'later' | 'never' | 'dismissed', today: string): V16State {
  let next = addFeedback(s, i, kind, today, kind === 'later' ? laterUntil(today, i) : undefined);
  if (kind === 'not-relevant' && i.kind && i.possibilities.length) {
    const intel = intelOf(next);
    let memory = intel.memory;
    for (const p of i.possibilities) memory = confirm(memory, { eventKind: i.kind, need: p.need, effect: 'not-needed' }, today);
    next = { ...next, intel: { ...intel, memory } };
  }
  return next;
}

/** Apply the options the family chose (affected id → option id). Returns the new state and parts to agree on screen. */
export function applyChoices(s: V16State, i: SmartInsight, choices: Record<string, string>, ctx: { today: string; monday: string; viewer: string }): { state: V16State; openParts: string[] } {
  let next = s;
  const openParts: string[] = [];
  let resolved = false;
  for (const a of i.affected) {
    const opt = a.options.find((o) => o.id === choices[a.id]);
    if (!opt) continue;
    const e = opt.effect;
    switch (e.type) {
      case 'edit': {
        // The same edit + "We agree" as the meeting: choosing it here IS the family's decision.
        const before = next.parts.find((p) => p.id === e.partId);
        if (!before) break;
        let parts = partReducer(next.parts, { type: 'edit', id: e.partId, patch: e.patch }, next.online);
        parts = partReducer(parts, { type: 'agree', id: e.partId, today: ctx.today }, next.online);
        next = { ...next, parts };
        resolved = true;
        break;
      }
      case 'move-cleaning':
        next = { ...next, cleaning: { ...next.cleaning, moved: moveSession(next, ctx.monday, e.zoneDay, e.to) } };
        resolved = true;
        break;
      case 'propose': {
        if (next.parts.some((p) => p.id === e.part.id)) break;
        // Volunteering yourself is your own agreement; anyone else still decides (a Suggested part on their Today).
        const mine = e.part.ownerId === ctx.viewer;
        const part = mine ? partReducer([e.part], { type: 'agree', id: e.part.id, today: ctx.today }, next.online)[0] : e.part;
        next = { ...next, parts: [...next.parts, part] };
        if (!mine) openParts.push(part.id);
        resolved = true;
        break;
      }
      case 'add-event':
        if (!next.extraEvents.some((x) => x.id === e.event.id)) next = { ...next, extraEvents: [...next.extraEvents, e.event] };
        resolved = true;
        break;
      case 'editor':
        openParts.push(e.partId);
        break;
      case 'topic':
        next = addFeedback(next, i, 'topic', ctx.today);
        break;
      case 'later':
        next = addFeedback(next, i, 'later', ctx.today, e.until);
        break;
      case 'note':
        resolved = true;
        break;
    }
  }
  if (resolved) next = addFeedback(next, i, 'handled', ctx.today);
  return { state: next, openParts };
}

/** The card was shown: the attention budget's record (first day, urgency, facts). */
export function markShown(s: V16State, i: SmartInsight, today: string): V16State {
  const intel = intelOf(s);
  const prev = intel.shown?.[i.key];
  if (prev && prev.fp === i.fingerprint) return s;
  return { ...s, intel: { ...intel, shown: { ...(intel.shown ?? {}), [i.key]: { on: today, urgent: i.urgent, fp: i.fingerprint } } } };
}

/** Talked about at the meeting (Let's Talk): it leaves the agenda. */
export const talked = (s: V16State, key: string, today: string): V16State => {
  const intel = intelOf(s);
  return { ...s, intel: { ...intel, talked: { ...(intel.talked ?? {}), [key]: today } } };
};

/** "Don't suggest this again" is always correctable. */
export function undoFeedback(s: V16State, f: Feedback): V16State {
  const intel = intelOf(s);
  return { ...s, intel: { ...intel, feedback: (intel.feedback ?? []).filter((x) => x !== f && !(x.key === f.key && x.kind === f.kind && x.on === f.on)) } };
}

export const tomorrow = (today: string) => addDays(today, 1);
