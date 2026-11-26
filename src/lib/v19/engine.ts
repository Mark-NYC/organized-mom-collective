/**
 * V19 Today (docs/ios/V19_ATTENTION.md): maximum intelligence, minimum interruption.
 *
 * Built ON the V18 engine (src/lib/v18/engine.ts), not beside it: V18's detectors (needs, open loops, capacity,
 * development), its memory, playbooks, interpreter seam, baseline and suppression are reused as they are. V19 adds:
 *   - cascading consequences: one change, every affected agreement, ONE insight with a resolution per agreement
 *   - backup: a known commitment (or a reported one) overlapping someone's part today
 *   - "Something changed?": reported circumstances → one "keep today simple" plan
 *   - recurring friction from completion history · growing ownership from family check-ins
 *   - undated intentions (the family's own ideas) matched to a real open morning · seasonal transitions on the calendar
 *   - preparation windows per need, the attention router (today / meeting / remembered) and the attention budget
 *   - feedback that distinguishes handled, not relevant, later, never and a plain dismiss
 * Deterministic throughout. The optional interpreter (V18's seam) is still the only place a model could be used.
 */
import { addDays, daysBetween, occurrences, weekday, type Occurrence } from '../calendar/recurrence';
import { weeklySchedule } from '../../data/cleaning';
import {
  agreedParts, currentPriorities, dayName, durable, eventsFor, isShared, linkOf, partDate, sessionDay, sessionsOn, sharedOccurrences, weekOccurrences, type Part, type V16State,
} from '../v16/model';
import {
  ROUTINE, base, capacity, development, emptyIntel, intelOf, list, looseLoops, needsWork, nextMeeting, occKey, possessive, short, whenWord,
  type Insight, type Person, type TodayInput,
} from '../v18/engine';
import { PLAYBOOKS } from '../v18/playbooks';
import {
  EYEBROW, THRESHOLD, agendaOf, destinationFor, feedbackGate, independentAt, pickCard, windowFor, worthOf,
  type Affected, type Category, type Destination, type Feedback, type Gate, type ResolutionOption, type RouteInput, type SmartInsight,
} from './attention';

export { EYEBROW, THRESHOLD };

// ------------------------------------------------------------------ helpers

const min = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const lowerFirst = (t: string) => (/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** "Leave at 3:40 PM", "Start at 5:30 PM", "After dinner, 6:30 PM" → '15:40'. */
export function cueTime(cue?: string): string | null {
  const m = cue?.match(/(\d{1,2}):(\d{2})\s?([AP]M)/i);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return hhmm(h * 60 + Number(m[2]));
}
const cueLabel = (t: string) => short(t);
/** "Soccer practice" → "Soccer". */
export const shortTitle = (t: string) => t.replace(/\s+(practice|lesson|class|game)$/i, '') || t;
const deltaWords = (d: number) => ({ 30: 'half an hour', 60: 'an hour', 90: 'an hour and a half', 120: 'two hours' }[Math.abs(d)] ?? null);
const WEEKS = ['', 'one', 'two', 'three', 'four', 'five'];

interface Ctx { inp: TodayInput; names: Record<string, string>; adults: Person[]; viewer: string; intel: ReturnType<typeof intelOf> }

/** Wrap a V18 insight with V19's routing metadata. */
function smart(i: Insight, x: Partial<SmartInsight> & Pick<SmartInsight, 'category' | 'actionLabel' | 'flow'>): SmartInsight {
  const defaults: Omit<SmartInsight, keyof Insight | 'category' | 'actionLabel' | 'flow' | 'worth'> = {
    destination: 'today', urgent: false, earliestUseful: '0000-01-01', latestUseful: i.expiresOn, actionable: true, pattern: i.key.split(':').slice(0, 2).join(':'),
    affected: [], reassurance: [], routeWhy: '',
  };
  const merged = { ...defaults, ...i, ...x } as SmartInsight;
  return { ...merged, eyebrow: EYEBROW[x.category], worth: worthOf(merged) };
}

const doneLine = (p: Part, names: Record<string, string>) => {
  const who = names[p.ownerId ?? ''] ?? 'Someone';
  if (p.need === 'gear' && /soccer/i.test(p.title)) return `${who}’s soccer bag is already packed ✓`;
  return `${who} · ${p.title}: already done ✓`;
};

// ------------------------------------------------------------------ A. cascading consequences of a change

function changes(c: Ctx): SmartInsight[] {
  const { inp, names, intel } = c;
  const { s, monday, today } = inp;
  if (!intel.baseline) return [];
  const shared = sharedOccurrences(s, monday);
  const now = new Map(shared.map((o) => [occKey(o), o]));
  const out: SmartInsight[] = [];
  for (const [key, was] of Object.entries(intel.baseline.items)) {
    if (was.date < today || ROUTINE.test(was.title)) continue;
    const o = now.get(key);
    const link = key.slice(0, key.lastIndexOf('@'));
    const evParts = agreedParts(s).filter((p) => p.eventLink === link);
    const reassurance = evParts.filter((p) => p.done).map((p) => doneLine(p, names));
    const pending = evParts.filter((p) => !p.done);
    const owners = [...new Set(evParts.map((p) => p.ownerId).filter((x): x is string => Boolean(x)))];
    const sTitle = shortTitle(was.title);
    if (o && o.date === was.date && o.event.start_time === was.start) continue;
    const date = o?.date ?? was.date;
    const d = daysBetween(today, date);
    const affected: Affected[] = [];
    const areas: string[] = [];
    let title: string;
    const body: string[] = [];
    if (!o) {
      title = `${sTitle} is off ${whenWord(was.date, today) === 'Today' ? 'today' : whenWord(was.date, today) === 'Tomorrow' ? 'tomorrow' : `on ${dayName(was.date)}`}.`;
      body.push(pending.length ? `${list(pending.map((p) => `${names[p.ownerId ?? ''] ?? 'Someone'}’s “${p.title}”`))} isn’t needed this time. The agreement stays for next time.` : 'Nothing on your plan depends on it.');
    } else {
      const start = o.event.start_time!, end = o.event.end_time ?? start;
      const oldStart = was.start ?? start, oldEnd = was.end ?? oldStart;
      const delta = o.date === was.date ? min(start) - min(oldStart) : 0;
      const kid = o.event.member_ids.map((m) => names[m]).filter(Boolean)[0] ?? 'Someone';
      const clash = shared.find((x) => x !== o && x.date === o.date && x.event.end_time && x.event.start_time
        && x.event.member_ids.some((m) => o.event.member_ids.includes(m)) && x.event.end_time >= start && x.event.start_time < start);
      // The ride: the one agreement whose timing the change breaks.
      for (const p of pending.filter((p) => p.need === 'ride')) {
        const owner = names[p.ownerId ?? ''] ?? 'Someone';
        const at = cueTime(p.cue);
        const opts: ResolutionOption[] = [];
        let question: string; const facts: string[] = [];
        if (clash && delta < 0) {
          question = `How will ${kid} get to ${lowerFirst(sTitle)}?`;
          facts.push(`${clash.event.title} ends at ${short(clash.event.end_time!)}. ${o.event.title.replace(/^./, (x) => x)} now starts at ${short(start)}.`);
          opts.push(
            { id: 'school', label: `${owner} picks ${kid} up from ${clash.event.title.toLowerCase()} and goes straight there`, detail: `Only if ${owner} can be there by ${short(clash.event.end_time!)}.`,
              effect: { type: 'edit', partId: p.id, patch: { title: `Pick up ${kid} from ${clash.event.title.toLowerCase()} and drive to ${lowerFirst(sTitle)}`, cue: `Pick up at ${short(clash.event.end_time!)}` } } },
            { id: 'late', label: `Let the coach know ${kid} will be a few minutes late`, detail: 'Nothing is sent from here.', effect: { type: 'note' } },
            { id: 'other', label: 'Make another plan', detail: 'Change who drives or when.', effect: { type: 'editor', partId: p.id } },
          );
          areas.push('pickup');
          body.push(`${o.event.title.split(' ').slice(-1)[0].replace(/^./, (x) => x.toUpperCase())} now starts when ${clash.event.title.toLowerCase()} ends.`);
        } else if (at && delta) {
          const leave = cueLabel(hhmm(min(at) + delta));
          question = `When should ${owner} leave?`;
          facts.push(`${o.event.title} now starts at ${short(start)}.`);
          opts.push(
            { id: 'shift', label: `Leave at ${leave} instead`, effect: { type: 'edit', partId: p.id, patch: { cue: `Leave at ${leave}` } } },
            { id: 'other', label: 'Make another plan', detail: 'Change who drives or when.', effect: { type: 'editor', partId: p.id } },
          );
          areas.push(`${owner}’s drive`);
        } else continue;
        affected.push({ id: `ride:${p.id}`, kind: 'ride', partId: p.id, question, facts,
          current: { ownerId: p.ownerId, title: p.title, detail: at ? `Planned departure: ${short(at)}` : p.cue }, options: opts });
        if (!body.some((b) => b.includes('transportation'))) body.push(`${owner}’s transportation plan needs adjusting.`);
      }
      // Other agreements that day that the new time newly runs into (dinner help, a cleaning zone…).
      const people = new Set([...o.event.member_ids, ...pending.filter((p) => p.need === 'ride').map((p) => p.ownerId ?? '')]);
      const within = (t: number, a: number, b: number) => t >= a - 30 && t <= b;
      for (const p of agreedParts(s).filter((p) => !p.eventLink && !p.done && p.ownerId && people.has(p.ownerId) && partDate(s, monday, p) === o.date)) {
        const t = cueTime(p.cue);
        if (!t || !within(min(t), min(start), min(end)) || (o.date === was.date && within(min(t), min(oldStart), min(oldEnd)))) continue;
        const who = names[p.ownerId!] ?? 'Someone';
        const facts = [`${who} will be at ${lowerFirst(o.event.title)} from ${short(start)} to ${short(end)}.`];
        const current = { ownerId: p.ownerId, title: p.title, detail: p.cue };
        if (p.cleaningTask) {
          const zone = weeklySchedule.find((z) => z.day === p.cleaningTask!.zoneDay)?.zone ?? 'Cleaning';
          const nextDay = weekday(o.date) + 1;
          const opts: ResolutionOption[] = [];
          if (nextDay <= 6) opts.push({ id: 'move', label: `Move this week’s ${zone} to ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextDay]}`, effect: { type: 'move-cleaning', zoneDay: p.cleaningTask.zoneDay, to: nextDay } });
          opts.push({ id: 'after', label: `${who} does it after practice`, effect: { type: 'note' } }, { id: 'skip', label: 'Skip it this week', detail: 'The agreement stays as it is.', effect: { type: 'note' } });
          affected.push({ id: `clean:${p.id}`, kind: 'cleaning', partId: p.id, question: `When will “${p.title}” happen?`, facts, current, options: opts });
          areas.push(`${who}’s cleaning zone`);
        } else {
          const dinner = p.need === 'dinner' || /dinner/i.test(p.title);
          affected.push({ id: `part:${p.id}`, kind: dinner ? 'dinner' : 'part', partId: p.id, question: dinner ? 'Who’ll help with dinner tonight?' : `What happens with “${p.title}”?`, facts, current,
            options: [
              { id: 'out', label: `${who} sits this one out tonight`, detail: 'The agreement stays as it is.', effect: { type: 'note' } },
              { id: 'someone', label: 'Someone else helps tonight', detail: 'You choose who; they still agree.', effect: { type: 'propose', part: { id: `p-v19-${p.id}-${o.date}`, origin: 'prepared', title: `${p.title} tonight`, ownerId: null, finishLine: p.finishLine, onDate: o.date, need: p.need, status: 'suggested', why: `${who} will be at ${lowerFirst(o.event.title)}.` } } },
              { id: 'topic', label: 'Bring it up at the meeting', effect: { type: 'topic' } },
            ] });
          areas.push(dinner ? 'dinner preparation' : `“${p.title}”`);
        }
      }
      const dir = delta < 0 ? 'earlier' : 'later';
      if (affected.length >= 2) {
        title = `${dayName(o.date)} needs a little reshuffling.`;
        body.length = 0;
        body.push(`${cap(dir)} ${lowerFirst(o.event.title)} affects ${list(areas)}.`);
      } else if (o.date === was.date) {
        title = deltaWords(delta) ? `${sTitle} starts ${deltaWords(delta)} ${dir}.` : `${sTitle} starts at ${short(start)} instead of ${short(oldStart)}.`;
        if (!body.length) body.push(affected.length ? '' : 'Nothing on your plan depends on it.');
      } else {
        title = `${sTitle} moved to ${dayName(o.date)}.`;
        if (!body.length) body.push(pending.length ? `${list(pending.map((p) => `“${p.title}”`))} moves with it.` : 'Nothing on your plan depends on it.');
      }
    }
    const kidsTransport = affected.some((a) => a.kind === 'ride');
    const members = [...new Set([...owners, ...(o?.event.member_ids ?? [])])];
    const i = base({
      key: `chg:${key}`, type: 'exception', eventLink: link, date, partIds: evParts.map((p) => p.id), members, confidence: 1,
      urgency: d <= 0 ? 1 : d === 1 ? 0.8 : 0.5, consequence: affected.length ? 0.9 : 0.3, adultTask: true, viewer: c.viewer, expiresOn: date,
      evidence: [o
        ? `When you last met, ${was.title} was ${dayName(was.date)} at ${was.start ? short(was.start) : 'all day'}. Its calendar now says ${dayName(o.date)} at ${o.event.start_time ? short(o.event.start_time) : 'all day'}.`
        : `${was.title} on ${dayName(was.date)} is no longer in its calendar.`, ...affected.map((a) => `Affects: ${a.current?.title} (${names[a.current?.ownerId ?? ''] ?? 'someone'}).`)],
      source: 'calendar', eyebrow: '', title, body: body.filter(Boolean).join(' '),
      attention: o ? (o.date === was.date ? `Now at ${short(o.event.start_time!)}.` : `Moved to ${dayName(o.date)}.`) : 'Cancelled in its calendar.',
      action: 'review-plan', fp: `${key}|${o?.date}|${o?.event.start_time}|${affected.map((a) => a.id).join(',')}`,
    });
    out.push(smart(i, {
      category: 'changed', flow: affected.length ? 'resolve' : 'week', actionLabel: affected.length >= 2 ? 'Review what’s affected' : affected.length ? 'Adjust the plan' : 'Review our week',
      urgent: affected.length > 0 && d <= 1, earliestUseful: today, latestUseful: date, affected, reassurance, pattern: `chg:${link}`,
      // Everyone can help with a child's transport; otherwise it's mostly the owners'.
      actionable: kidsTransport || owners.includes(c.viewer) || !owners.length,
    }));
  }
  return out;
}

// ------------------------------------------------------------------ needs (V18), with preparation windows

function needs(c: Ctx): SmartInsight[] {
  const { inp, names, intel } = c;
  const fb = intel.feedback ?? [];
  const out: SmartInsight[] = [];
  for (const i of needsWork(inp, names, { days: 13, maxDue: 13 })) {
    const date = i.date!;
    const kind = i.kind!;
    // Needs this family handles on its own stay quiet unless they're due today and nobody has them.
    const poss = i.possibilities.filter((p) => !independentAt(p.need, fb) || daysBetween(inp.today, addDays(date, -(PLAYBOOKS[kind].find((n) => n.id === p.need)?.leadDays ?? 0))) <= 0);
    if (!poss.length) {
      // Quietly remembered: the family handles this on its own, so nothing is said unless it's due today and unplanned.
      out.push(smart(i, { category: 'heads-up', flow: 'needs', actionLabel: 'Make a plan', destination: 'remembered', routeWhy: 'You handle this on your own.', pattern: `need:${kind}:${i.possibilities[0]?.need}` }));
      continue;
    }
    const timing = poss.map((p) => {
      const due = addDays(date, -(PLAYBOOKS[kind].find((n) => n.id === p.need)?.leadDays ?? 0));
      return { due, earliest: addDays(due, -windowFor(p.need, fb, intel.assistance)) };
    });
    const latest = timing.map((t) => t.due).sort()[0];
    const earliest = timing.map((t) => t.earliest).sort()[0];
    const loop = poss.some((p) => p.state === 'discussed');
    const evTitle = sharedTitle(inp, i.eventLink!, date) ?? 'This activity';
    // "Lily’s birthday party next Saturday" / "Next Saturday’s soccer game": never an ambiguous weekday.
    const what = date > addDays(inp.monday, 6)
      ? (/[’']s\b/.test(evTitle) ? `${evTitle} next ${dayName(date)}` : `Next ${dayName(date)}’s ${lowerFirst(evTitle)}`)
      : possessive(date, inp.today, evTitle);
    let title = i.title;
    let body = i.body;
    const transport = poss.find((p) => p.state === 'discussed' && (p.need === 'ride' || p.need === 'pickup'));
    if (transport) {
      title = `Who’s ${transport.need === 'ride' ? 'driving to' : 'picking up after'} ${lowerFirst(what)}?`;
      body = 'You talked about it, and nobody has agreed to it yet.';
    } else if (poss.length >= 3) {
      title = `${what} needs a few things.`;
      body = [`${cap(list(poss.map((p) => (p.label === 'RSVP' ? 'an RSVP' : p.label.toLowerCase()))))}.`, ...poss.map((p) => p.ownerWhy).filter(Boolean)].join(' ');
    }
    const inWeek = date <= addDays(inp.monday, 6);
    const labels = poss.map((p) => (p.label === 'RSVP' ? 'RSVP' : p.label.replace(/^An? /, '').toLowerCase()));
    const attention = `${cap(list(labels))} still need${labels.length > 1 ? '' : 's'} a plan.`;
    out.push(smart({ ...i, title, body, attention, possibilities: poss }, {
      category: loop ? 'loose-end' : inWeek ? 'heads-up' : 'looking-ahead', flow: 'needs', meetingKind: 'prep',
      actionLabel: i.action === 'finish-plan' ? 'Finish the plan' : 'Make a plan',
      urgent: daysBetween(inp.today, latest) <= 1, earliestUseful: earliest, latestUseful: latest, pattern: `need:${kind}:${poss[0].need}`,
      actionable: true,
    }));
  }
  return out;
}

function sharedTitle(inp: TodayInput, link: string, date: string) {
  return occurrences(eventsFor(inp.s, inp.monday), date, date).find((o) => linkOf(o.event) === link)?.event.title;
}

/**
 * An agreed preparation that takes some doing (a gift, an RSVP, an outfit) is near its useful deadline and isn't
 * marked done: a gentle heads-up to the person who owns it, nobody else. Daily habits (a bag, a lunch) never get this.
 */
const SLOW = new Set(['gift', 'rsvp', 'outfit', 'card']);
function dueSoon(c: Ctx): SmartInsight[] {
  const { inp, names, viewer } = c;
  const { s, today } = inp;
  const range = occurrences(eventsFor(s, inp.monday), today, addDays(today, 7)).filter((o) => isShared(o.event));
  return agreedParts(s).filter((p) => p.eventLink && p.need && SLOW.has(p.need) && !p.done).flatMap((p) => {
    const o = range.find((x) => linkOf(x.event) === p.eventLink);
    if (!o) return [];
    const due = addDays(o.date, p.offsetDays ?? 0);
    const left = daysBetween(today, due);
    if (left < 0 || left > 1) return [];
    const i = base({
      key: `due:${p.id}:${due}`, type: 'invisible-work', eventLink: p.eventLink, date: o.date, partIds: [p.id], members: p.ownerId ? [p.ownerId] : [], confidence: 0.9,
      urgency: left === 0 ? 0.8 : 0.6, consequence: 0.6, adultTask: true, viewer, expiresOn: due,
      evidence: [`You agreed “${p.title}” is ${names[p.ownerId ?? ''] ?? 'someone'}’s, done ${left === 0 ? 'today' : 'by tomorrow'}. It isn’t marked done yet.`], source: 'rules', eyebrow: '',
      title: `“${p.title}” is ${left === 0 ? 'due today' : 'due tomorrow'}.`, body: `For ${lowerFirst(o.event.title)} on ${dayName(o.date)}. It isn’t marked done yet.`,
      attention: `${cap(p.need!)} not marked done yet.`, action: 'finish-plan', fp: `${p.id}|${due}|${p.done}`,
    });
    return [smart(i, { category: 'heads-up', flow: 'part', actionLabel: 'Take a look', urgent: left === 0, earliestUseful: addDays(due, -1), latestUseful: due, pattern: `due:${p.need}`,
      // Only the owner can do something about it; everyone else is spared.
      actionable: p.ownerId === viewer, privateTo: p.ownerId ?? undefined })];
  });
}

// ------------------------------------------------------------------ B. someone needs backup

function backup(c: Ctx): SmartInsight[] {
  const { inp, names, adults, viewer, intel } = c;
  const { s, monday, today } = inp;
  const out: SmartInsight[] = [];
  const reports = (intel.reports ?? []).filter((r) => r.date === today && r.kind === 'work-late');
  for (const a of adults) {
    const mine = agreedParts(s).filter((p) => p.ownerId === a.id && !p.done && partDate(s, monday, p) === today && cueTime(p.cue));
    if (!mine.length) continue;
    // A known commitment: this adult's own (possibly private) calendar. Only ever shown to them.
    const own = weekOccurrences(s, monday).filter((o) => o.date === today && o.event.member_ids.includes(a.id) && o.event.start_time && o.event.end_time && !ROUTINE.test(o.event.title));
    const report = reports.find((r) => (r.memberId ?? r.by) === a.id);
    for (const p of mine) {
      const t = min(cueTime(p.cue)!);
      const clash = own.find((o) => min(o.event.start_time!) <= t + 30 && min(o.event.end_time!) > t);
      if (!clash && !report) continue;
      const privateEvent = clash && !isShared(clash.event);
      const me = viewer === a.id;
      const others = adults.filter((x) => x.id !== a.id);
      const label = /dinner/i.test(p.title) ? 'dinner' : lowerFirst(p.title);
      const opts: ResolutionOption[] = [];
      for (const b of others) {
        const offer = viewer === b.id;
        opts.push({ id: `ask-${b.id}`, label: offer ? `I’ll take ${label} tonight` : `Ask ${b.firstName} to take ${label} tonight`, detail: offer ? undefined : `${b.firstName} still decides.`,
          effect: { type: 'propose', part: { id: `p-v19-backup-${p.id}-${today}`, origin: 'prepared', title: `${p.title} tonight`, ownerId: b.id, finishLine: p.finishLine, onDate: today,
            need: p.need, cue: p.cue, askedBy: a.id, status: 'suggested', why: `${a.firstName} asked for backup tonight.` } } });
      }
      if (/dinner/i.test(p.title)) opts.push({ id: 'simple', label: 'Keep dinner simple tonight', detail: 'Leftovers, something easy.', effect: { type: 'note' } });
      opts.push({ id: 'later', label: `Start ${label} after ${clash ? short(clash.event.end_time!) : 'work'}`, effect: { type: 'note' } });
      const why = clash
        ? (me ? `Your ${privateEvent ? 'work meeting' : lowerFirst(clash.event.title)} runs through ${label} preparation.` : `${a.firstName}’s ${lowerFirst(clash.event.title)} runs through ${label} preparation.`)
        : (me ? 'You said work is running late.' : `${a.firstName} said work is running late.`);
      const i = base({
        key: `backup:${p.id}:${today}`, type: 'open-loop', partIds: [p.id], members: [a.id], confidence: clash ? 0.95 : 0.9, urgency: 0.9, consequence: 0.75,
        adultTask: true, viewer, expiresOn: today, evidence: [clash ? `${me || !privateEvent ? clash.event.title : 'A private calendar event'} ${short(clash.event.start_time!)}–${short(clash.event.end_time!)} overlaps “${p.title}” (${p.cue}).` : `Reported today: work is running late.`],
        source: 'calendar', eyebrow: '', title: me ? 'You could use some backup tonight.' : `${a.firstName} could use some backup tonight.`,
        body: `${why} ${me ? 'Could someone else take the lead tonight?' : 'Could you take the lead?'}`, attention: 'Could use backup tonight.', action: 'review-plan',
        fp: `${p.id}|${today}|${clash?.event.id ?? 'report'}|${p.cue}`,
      });
      out.push(smart(i, {
        category: 'helping', flow: 'resolve', actionLabel: 'Share the load', urgent: true, earliestUseful: today, latestUseful: today, partLink: p.id, pattern: `backup:${p.need ?? 'part'}`,
        privateTo: privateEvent ? a.id : undefined, actionable: true,
        affected: [{ id: `backup:${p.id}`, kind: 'backup', partId: p.id, question: `Who could take the lead on ${label} tonight?`, facts: [why],
          current: { ownerId: p.ownerId, title: p.title, detail: p.cue }, options: opts }],
      }));
    }
  }
  return out;
}

/** A handoff someone asked of the viewer ("Ana asked if you can take dinner tonight"): theirs to agree to. */
function asked(c: Ctx): SmartInsight[] {
  const { inp, names, viewer } = c;
  return inp.s.parts.filter((p) => p.askedBy && p.ownerId === viewer && (p.status === 'suggested' || p.status === 'kept') && p.onDate === inp.today).map((p) => smart(base({
    key: `asked:${p.id}`, type: 'open-loop', partIds: [p.id], members: [viewer], confidence: 1, urgency: 0.9, consequence: 0.7, adultTask: true, viewer, expiresOn: p.onDate!,
    evidence: [`${names[p.askedBy!]} asked from Today.`], source: 'rules', eyebrow: '', title: `${names[p.askedBy!]} asked if you can take ${/dinner/i.test(p.title) ? 'dinner' : lowerFirst(p.title)} tonight.`,
    body: 'Agree if it works, or change it.', attention: 'Waiting for your answer.', action: 'finish-plan', fp: `${p.id}|${p.status}`,
  }), { category: 'loose-end', flow: 'part', actionLabel: 'Answer', urgent: true, earliestUseful: inp.today, latestUseful: p.onDate!, partLink: p.id, pattern: 'asked' }));
}

// ------------------------------------------------------------------ C. "Something changed?" → keep today simple

function simplify(c: Ctx): SmartInsight[] {
  const { inp, names, adults, viewer, intel } = c;
  const { s, monday, today } = inp;
  const reports = (intel.reports ?? []).filter((r) => r.date === today && r.kind !== 'work-late');
  if (!reports.length) return [];
  const r = reports[reports.length - 1];
  const who = r.memberId ? names[r.memberId] : null;
  const affected: Affected[] = [];
  const ideas: string[] = [];
  const wd = weekday(today);
  // Flexible: today's cleaning zone. Essential: school and activities stay; only the family can call those off.
  for (const z of sessionsOn(s, monday, wd)) {
    const zone = weeklySchedule.find((x) => x.day === z);
    if (!zone) continue;
    const to = Math.min(wd + 2, 6);
    affected.push({ id: `clean:${z}`, kind: 'cleaning', zoneDay: z, question: `${zone.zone} today?`, facts: [`It’s on today’s cleaning plan (${zone.minutes}).`],
      options: [
        { id: 'move', label: `Move it to ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][to]}`, effect: { type: 'move-cleaning', zoneDay: z, to } },
        { id: 'keep', label: 'Keep it', effect: { type: 'note' } },
      ] });
    ideas.push(`postponing the ${zone.zone.replace(/ Reset$/, '').toLowerCase()} zone`);
  }
  const today_ = agreedParts(s).filter((p) => !p.done && partDate(s, monday, p) === today);
  const needBackup = r.memberId ? today_.filter((p) => p.ownerId === r.memberId && !/dinner/i.test(p.title)) : [];
  for (const p of needBackup) {
    const others = adults.filter((a) => a.id !== p.ownerId);
    affected.push({ id: `backup:${p.id}`, kind: 'backup', partId: p.id, question: `Who could cover “${p.title}”?`, facts: [`${who} is sick today.`], current: { ownerId: p.ownerId, title: p.title, detail: p.cue },
      options: [...others.map((b) => ({ id: `ask-${b.id}`, label: viewer === b.id ? 'I’ll cover it today' : `Ask ${b.firstName} to cover it today`,
        effect: { type: 'propose' as const, part: { id: `p-v19-cover-${p.id}-${today}`, origin: 'prepared' as const, title: `${p.title} (today)`, ownerId: b.id, finishLine: p.finishLine, onDate: today, status: 'suggested' as const, askedBy: r.by } } })),
        { id: 'skip', label: 'It can wait this week', effect: { type: 'note' } }] });
    ideas.push(`arranging backup for ${lowerFirst(p.title)}`);
  }
  const dinner = today_.find((p) => /dinner/i.test(p.title));
  if (dinner) {
    affected.push({ id: `dinner:${dinner.id}`, kind: 'dinner', partId: dinner.id, question: 'Dinner tonight?', facts: [`${names[dinner.ownerId ?? ''] ?? 'Someone'} has dinner tonight.`],
      current: { ownerId: dinner.ownerId, title: dinner.title, detail: dinner.cue },
      options: [{ id: 'easy', label: 'Keep dinner easy tonight', detail: 'Leftovers, something simple.', effect: { type: 'note' } }, { id: 'keep', label: 'Keep the plan', effect: { type: 'note' } }] });
    ideas.push('keeping dinner easy');
  }
  if (!affected.length) return [];
  const sickActivity = r.kind === 'sick' && r.memberId ? sharedOccurrences(s, monday).find((o) => o.date === today && o.event.member_ids.includes(r.memberId!) && !ROUTINE.test(o.event.title)) : null;
  const reason = { sick: `${who ?? 'Someone'} is sick.`, behind: 'You’re running behind.', lighter: 'You asked for a lighter day.', other: r.note ? `You said: “${r.note.slice(0, 80)}”` : 'Something changed.' }[r.kind as 'sick' | 'behind' | 'lighter' | 'other'];
  const i = base({
    key: `simplify:${today}`, type: 'open-loop', partIds: affected.map((a) => a.partId).filter((x): x is string => Boolean(x)), members: [], confidence: 1, urgency: 0.95, consequence: 0.7,
    adultTask: true, viewer, expiresOn: today, evidence: [`Reported today: ${reason}`, 'Only flexible things are suggested; activities stay as their calendars say.'], source: 'rules', eyebrow: '',
    title: 'Keep today simple.', body: `Consider ${list(ideas)}.${sickActivity ? ` ${sickActivity.event.title} is still on the calendar if ${who} needs to miss it.` : ''}`,
    attention: '', action: 'review-plan', fp: `${today}|${reports.map((x) => x.kind + (x.memberId ?? '')).join(',')}|${affected.map((a) => a.id).join(',')}`,
  });
  return [smart(i, { category: 'helping', flow: 'resolve', actionLabel: 'Simplify today', urgent: true, earliestUseful: today, latestUseful: today, affected, pattern: 'simplify',
    reassurance: ['School and activities stay on the calendar.'] })];
}

// ------------------------------------------------------------------ D. recurring friction (completion history)

function friction(c: Ctx): SmartInsight[] {
  const { inp, names, intel, viewer } = c;
  const history = intel.history ?? [];
  const out: SmartInsight[] = [];
  for (const p of agreedParts(inp.s).filter((p) => p.weekday !== undefined)) {
    const h = history.filter((x) => x.partId === p.id).sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
    if (h.length < 3 || !h.every((x) => x.late || x.moved)) continue;
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.weekday!];
    const prev = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][p.weekday!];
    const morning = /morning|before school/i.test(p.cue ?? '') || /pack|prep|backpack/i.test(p.title);
    const prep = /pack|prep|backpack|lay out/i.test(p.title);
    const i = base({
      key: `friction:${p.id}`, type: 'open-loop', partIds: [p.id], members: p.ownerId ? [p.ownerId] : [], confidence: 0.85, urgency: 0.15, consequence: 0.4, adultTask: false, viewer,
      expiresOn: addDays(inp.monday, 13), venue: 'meeting',
      evidence: h.map((x) => `${x.date}: ${x.moved ? 'moved' : 'finished late'}`).concat('From the family’s own completion history. Late isn’t a judgment; it may just be the wrong time.'),
      source: 'records', eyebrow: '', title: `${day} ${morning ? 'mornings' : 'evenings'} keep getting tight.`,
      body: `“${p.title}” has been moved or finished late three ${day}s in a row.${prep ? ` Would ${prev} evening work better?` : ' Is there a better time?'}`,
      attention: '', action: 'bring-up', fp: `${p.id}|${h.map((x) => x.date).join(',')}`,
    });
    void names;
    out.push(smart(i, { category: 'noticed', flow: 'topic', actionLabel: 'Bring it up Sunday', destination: 'meeting', meetingKind: 'routine', routeWhy: 'Recurring friction is for the family to talk over, not an interruption.', pattern: `friction:${p.id}` }));
  }
  return out;
}

// ------------------------------------------------------------------ G. growing ownership (family check-ins, never checkboxes)

function ownership(c: Ctx): SmartInsight[] {
  const { inp, names, viewer } = c;
  const out: SmartInsight[] = [];
  for (const r of inp.s.records.filter((r) => r.status !== 'dismissed' && r.status !== 'paused')) {
    const checks = r.history.filter((h) => h.decision === 'check-in');
    let n = 0;
    for (let k = checks.length - 1; k >= 0 && checks[k].signal === 'ownership' && checks[k].value === 'strong'; k--) n++;
    if (n < 3) continue;
    const who = names[r.memberId] ?? 'Someone';
    const i = base({
      key: `own:${r.id}:${checks[checks.length - 1].decidedAt.slice(0, 10)}`, type: 'development', partIds: r.agreementId ? [r.agreementId] : [], members: [r.memberId], confidence: 0.9,
      urgency: 0.15, consequence: 0.5, adultTask: false, viewer, expiresOn: addDays(inp.monday, 13), venue: 'meeting',
      evidence: [`${n} family check-ins in a row said ${who} owns “${r.title}”: remembers and starts it without a reminder.`, 'Ticking a box never counts as ownership; only your check-ins do.'],
      source: 'records', eyebrow: '', title: 'One less thing to remember.',
      body: `${who} has handled “${r.title}” without reminders for the past ${WEEKS[n] ?? n} weeks, according to your family check-ins.`, attention: '', action: 'bring-up', fp: `${r.id}|${n}`,
    });
    out.push(smart(i, { category: 'celebrating', flow: 'topic', actionLabel: 'Celebrate together', destination: 'meeting', meetingKind: 'development', routeWhy: 'Growing ownership is for the family to notice together.', pattern: `own:${r.id}` }));
  }
  return out;
}

// ------------------------------------------------------------------ E. undated intentions (the family's own ideas)

function intentions(c: Ctx): SmartInsight[] {
  const { inp, names, viewer } = c;
  const { s, monday, today } = inp;
  const meeting = nextMeeting(inp);
  const out: SmartInsight[] = [];
  const ideas = s.parts.filter((p) => p.origin === 'idea' && (p.status === 'suggested' || p.status === 'kept') && !p.eventLink && p.weekday === undefined && !p.onDate && p.ownerId);
  if (!ideas.length) return out;
  const range = occurrences(eventsFor(s, monday), today, addDays(today, 9)).filter((o) => isShared(o.event));
  for (const p of ideas) {
    // The first weekend morning (8–12) with nothing on the shared calendar for this person. Unscheduled isn't
    // necessarily available: it's offered as a possibility, never booked.
    const day = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => addDays(today, n)).find((d) => [0, 6].includes(weekday(d))
      && !range.some((o) => o.date === d && (!o.event.start_time || (o.event.start_time < '12:00' && (o.event.end_time ?? '23:59') > '08:00')) && (o.event.member_ids.includes(p.ownerId!) || !o.event.member_ids.length)));
    if (!day) continue;
    const by = names[p.ideaBy ?? p.ownerId!] ?? 'Someone';
    const beforeMeeting = !meeting || day < meeting.date;
    const i = base({
      key: `intent:${p.id}:${day}`, type: 'open-loop', partIds: [p.id], members: [p.ownerId!], confidence: 0.8, urgency: 0.4, consequence: 0.5, adultTask: true, viewer, expiresOn: day,
      evidence: [`${by} suggested it as an idea${p.discussed ? ' and the family kept it to talk over' : ''}.`, `${dayName(day)} morning has nothing on the shared calendar for ${names[p.ownerId!]}.`],
      source: 'rules', eyebrow: '', title: `${dayName(day)} might be a good day for this.`,
      body: `${by} mentioned wanting to ${lowerFirst(p.title)}. ${dayName(day)} morning has nothing scheduled.`, attention: '', action: 'review-plan', fp: `${p.id}|${day}`,
    });
    out.push(smart(i, {
      category: 'opportunity', flow: 'resolve', actionLabel: 'Consider it', destination: beforeMeeting ? 'today' : 'meeting', meetingKind: 'intention', earliestUseful: addDays(day, -3), latestUseful: day,
      routeWhy: beforeMeeting ? 'The open morning comes before the next meeting.' : 'The next meeting comes first.', pattern: `intent:${p.id}`,
      affected: [{ id: `intent:${p.id}`, kind: 'intention', partId: p.id, question: `Try it ${dayName(day)} morning?`, facts: ['Only if it suits everyone. Nothing is booked unless you choose to.'],
        options: [
          { id: 'plan', label: `Plan it for ${dayName(day)} at 9 AM`, effect: { type: 'add-event', event: { id: `e-v19-${p.id}`, title: p.title, starts_on: day, start_time: '09:00', end_time: '10:00', member_ids: [p.ownerId!], timezone: 'America/Chicago', revision: 0, source: 'manual' } } },
          { id: 'later', label: 'Not this week', effect: { type: 'later', until: addDays(day, 1) } },
          { id: 'topic', label: 'Bring it up at the meeting', effect: { type: 'topic' } },
        ] }],
    }));
  }
  return out;
}

// ------------------------------------------------------------------ F. seasonal transitions (only from the family's calendar)

const SEASON = /\b(break|vacation|holidays?|no school|first day of school|last day of school|season (starts|begins))\b/i;
function seasons(c: Ctx): SmartInsight[] {
  const { inp, viewer } = c;
  const { s, monday, today } = inp;
  const seen = new Set<string>();
  return occurrences(eventsFor(s, monday), addDays(today, 7), addDays(today, 35)).filter((o) => isShared(o.event) && SEASON.test(o.event.title) && !o.continued).flatMap((o) => {
    if (seen.has(o.event.id)) return [];
    seen.add(o.event.id);
    const days = daysBetween(today, o.date);
    const weeks = Math.max(1, Math.round(days / 7));
    const school = /break|no school|school/i.test(o.event.title);
    const i = base({
      key: `season:${o.event.id}:${o.date}`, type: 'capacity', date: o.date, partIds: [], members: [], confidence: 0.9, urgency: 0.2, consequence: 0.6, adultTask: true, viewer, expiresOn: o.date,
      evidence: [`${o.event.title} is on your calendar for ${o.date}.`, 'Childcare and plans usually need a couple of weeks.'], source: 'calendar', eyebrow: '',
      title: `${o.event.title} is about ${WEEKS[weeks] ?? weeks} week${weeks === 1 ? '' : 's'} away.`,
      body: school ? 'This might be a good week to talk about childcare, plans and how your usual routines will change.' : 'A good time to talk about plans and how your usual routines will change.',
      attention: '', action: 'bring-up', fp: `${o.event.id}|${o.date}`,
    });
    return [smart(i, { category: 'further-ahead', flow: 'topic', actionLabel: 'Add to our next meeting', destination: 'meeting', meetingKind: 'season',
      earliestUseful: addDays(o.date, -21), latestUseful: addDays(o.date, -7), routeWhy: 'The meeting before the planning window is the right time.', pattern: `season:${o.event.title}` })];
  });
}

// ------------------------------------------------------------------ V18 detectors, routed

function reused(c: Ctx): SmartInsight[] {
  const { inp, names } = c;
  const loops = looseLoops(inp, names).map((i) => smart(i, { category: 'loose-end', flow: 'topic', actionLabel: 'Bring it up Sunday', destination: 'meeting', meetingKind: 'loop', routeWhy: 'Not tied to a date.' }));
  const cap_ = capacity(inp).map((i) => smart(i, { category: 'heads-up', flow: 'week', actionLabel: 'Review our week', urgent: false, earliestUseful: inp.today, latestUseful: i.expiresOn }));
  const devs = development(inp, names).map((i) => smart(i, { category: 'celebrating', flow: 'topic', actionLabel: 'Bring it up Sunday', destination: 'meeting', meetingKind: 'development', routeWhy: 'Readiness for more is for the family to decide together.' }));
  return [...loops, ...cap_, ...devs];
}

// ------------------------------------------------------------------ Today

export interface TodayV19 {
  headline: string;
  sub?: string;
  card: SmartInsight | null;
  /** eventLink → quiet line (an unresolved issue that stays reachable without a card). */
  attention: Record<string, { text: string; key: string }>;
  /** partId → quiet line (backup on a part row). */
  partAttention: Record<string, { text: string; key: string }>;
  agenda: SmartInsight[];
  remembered: { insight: SmartInsight; why: string }[];
  suppressed: { insight: SmartInsight; gate: Gate }[];
  /** Every insight, after routing (tests and the doc's trace). */
  all: SmartInsight[];
}

export function evaluate(inp: TodayInput): SmartInsight[] {
  const intel = inp.s.intel ?? emptyIntel('m-ana');
  const names = Object.fromEntries(inp.people.map((p) => [p.id, p.firstName]));
  const c: Ctx = { inp, names, adults: inp.people.filter((p) => p.kind === 'adult'), viewer: intel.viewer, intel };
  const changed = changes(c);
  const changedEvents = new Set(changed.map((i) => `${i.eventLink}|${i.date}`));
  // One insight per event occurrence: a change absorbs that event's needs.
  const need = needs(c).filter((i) => !changedEvents.has(`${i.eventLink}|${i.date}`));
  const intents = intentions(c);
  const intentParts = new Set(intents.flatMap((i) => i.partIds));
  // An idea the family kept is one thing, not two: the opportunity replaces the "talked about, not agreed" loop.
  const rest = reused(c).filter((i) => !(i.type === 'open-loop' && i.partIds.some((id) => intentParts.has(id))));
  const due = dueSoon(c).filter((i) => !changedEvents.has(`${i.eventLink}|${i.date}`));
  return [...changed, ...simplify(c), ...backup(c), ...asked(c), ...due, ...need, ...rest, ...friction(c), ...ownership(c), ...intents, ...seasons(c)];
}

export function buildTodayV19(inp: TodayInput): TodayV19 {
  const { s, today } = inp;
  const intel = s.intel ?? emptyIntel('m-ana');
  const feedback: Feedback[] = intel.feedback ?? [];
  const meeting = nextMeeting(inp);
  const r: RouteInput = { today, viewer: intel.viewer, meetingDate: meeting?.date ?? null, feedback, shown: intel.shown ?? {} };
  const all = evaluate(inp);
  const suppressed: TodayV19['suppressed'] = [];
  const remembered: TodayV19['remembered'] = [];
  const todayItems: SmartInsight[] = [];
  const meetingItems: SmartInsight[] = [];
  const attention: TodayV19['attention'] = {};
  const partAttention: TodayV19['partAttention'] = {};
  const chosen = new Set(feedback.filter((f) => f.kind === 'topic').map((f) => f.key));
  for (const i of all) {
    const gate = feedbackGate(i, r, intel.talked ?? {});
    if (gate) { suppressed.push({ insight: i, gate }); continue; }
    const d: { destination: Destination; why: string } = chosen.has(i.key) ? { destination: 'meeting', why: 'The family chose to bring it up.' } : destinationFor(i, r);
    i.destination = d.destination;
    i.routeWhy = d.why;
    if (d.destination === 'remembered') { remembered.push({ insight: i, why: d.why }); continue; }
    if (d.destination === 'meeting') { meetingItems.push(i); continue; }
    // Today: reachable as a quiet line under its activity or part, whatever happens to the card.
    const line = i.attention || (i.category === 'helping' ? 'Could use backup today.' : '');
    if (line && i.eventLink && !attention[i.eventLink]) attention[i.eventLink] = { text: line, key: i.key };
    if (line && i.partLink && !partAttention[i.partLink]) partAttention[i.partLink] = { text: line, key: i.key };
    if (feedback.some((f) => f.key === i.key && f.kind === 'dismissed' && f.fingerprint === i.fingerprint)) { suppressed.push({ insight: i, gate: 'dismissed' }); continue; }
    todayItems.push(i);
  }
  const dismissedToday = feedback.some((f) => f.on === today && ['dismissed', 'never', 'not-relevant', 'later'].includes(f.kind));
  const { card, held } = pickCard(todayItems, r, dismissedToday);
  for (const [key, gate] of held) { const i = todayItems.find((x) => x.key === key)!; suppressed.push({ insight: i, gate }); }
  const { agenda, over } = agendaOf(meetingItems, chosen);
  for (const i of over) remembered.push({ insight: i, why: 'One of these per meeting is enough.' });
  const { headline, sub } = headlineV19(inp, card, todayItems.filter((i) => i.urgent));
  return { headline, sub, card, attention, partAttention, agenda, remembered, suppressed, all };
}

function headlineV19(inp: TodayInput, card: SmartInsight | null, urgent: SmartInsight[]): { headline: string; sub?: string } {
  const { s, monday, today } = inp;
  const todays = sharedOccurrences(s, monday).filter((o) => o.date === today && !ROUTINE.test(o.event.title));
  if (s.meeting.started) return { headline: 'Pick up where you left off.' };
  if (urgent.length >= 2) return { headline: 'A few things need attention.' };
  if (card && (card.category === 'changed' || card.key.startsWith('simplify:'))) return { headline: 'A change of plans.' };
  if (card?.type === 'capacity') return { headline: card.title.startsWith('Tomorrow') || card.urgency >= 0.6 ? 'Tomorrow’s a busy one.' : 'A full few days ahead.' };
  if (card?.category === 'helping') return { headline: 'A little backup will help.' };
  if (card && ['heads-up', 'loose-end', 'looking-ahead'].includes(card.category)) return { headline: 'A little preparation will help.' };
  if (card) return { headline: 'You’re on track.' };
  const mine = agreedParts(s).filter((p) => (p.eventLink || p.onDate) && partDate(s, monday, p) === today);
  if (mine.length && mine.every((p) => p.done)) return { headline: 'All set for today.' };
  if (!sharedOccurrences(s, monday).length && !agreedParts(s).length) return { headline: 'Here’s today.' };
  if (!todays.length) return { headline: 'A lighter day.', sub: 'Nothing on the shared calendar after school.' };
  return { headline: 'You’re on track.' };
}

// ------------------------------------------------------------------ What matters, ordered for today

export interface MatterRowV19 {
  link: string; occ: Occurrence; priority: boolean; group: 1 | 2 | 3 | 4 | 5;
  preps: { part: Part; date: string | null; done: boolean; doneYesterday: boolean }[];
  attention?: { text: string; key: string };
}

/**
 * 1 unresolved, time-sensitive · 2 today · 3 coming up and needing preparation · 4 other priorities · 5 earlier this
 * week (receded behind "Earlier this week (n)" unless something is still unresolved).
 */
export function matterRowsV19(inp: TodayInput, model: TodayV19): { rows: MatterRowV19[]; earlier: MatterRowV19[] } {
  const { s, monday, today } = inp;
  const shared = sharedOccurrences(s, monday);
  const rows: MatterRowV19[] = [];
  const add = (link: string, priority: boolean) => {
    if (rows.some((r) => r.link === link)) return;
    const occ = shared.find((o) => linkOf(o.event) === link && o.date >= today) ?? shared.find((o) => linkOf(o.event) === link);
    if (!occ) return;
    const preps = s.parts.filter((p) => p.eventLink === link && p.status !== 'skipped' && p.origin !== 'idea').map((p) => durable(p) ?? p).map((p) => {
      const date = partDate(s, monday, p);
      return { part: p, date, done: Boolean(p.done), doneYesterday: Boolean(p.done && date === addDays(today, -1)) };
    });
    const attention = model.attention[link];
    const urgentKey = attention && model.all.find((i) => i.key === attention.key)?.urgent;
    const needsPrep = preps.some((x) => !x.done) || Boolean(attention);
    const group: MatterRowV19['group'] = attention && urgentKey ? 1 : occ.date === today ? 2 : occ.date < today ? 5 : needsPrep ? 3 : 4;
    rows.push({ link, occ, priority, group, preps, attention });
  };
  for (const pr of currentPriorities(s)) if (pr.eventLink) add(pr.eventLink, true);
  for (const link of Object.keys(model.attention)) add(link, false);
  rows.sort((a, b) => a.group - b.group || a.occ.date.localeCompare(b.occ.date) || (a.occ.event.start_time ?? '').localeCompare(b.occ.event.start_time ?? ''));
  return { rows: rows.filter((r) => r.group !== 5), earlier: rows.filter((r) => r.group === 5) };
}

export { sessionDay };
export type { Category };
