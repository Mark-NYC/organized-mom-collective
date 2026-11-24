/**
 * Today (/app): "we follow through together" (two-tab redesign, docs/ios/TWO_TAB_REDESIGN.md). The same on the
 * website and in the iPhone app. In order:
 *
 *   Our family focus      what the family chose to work on (its own focus), or this month's prepared topic for a Club
 *                         family (labeled as the month's, never as agreed), or an invitation to a first meeting.
 *   Today's responsibilities  the primary content: today's trackable responsibilities on calendar events (with a
 *                         checkbox, shared with the event and the other phone), then each person's standing
 *                         agreements (no checkbox: an agreement has no done state, so none is invented).
 *   Plans · Cleaning · Resources  shortcuts to the family calendar, the cleaning companion, and the family's own page
 *                         (members, who does what, sharing, the Club and its months). Not tabs.
 *   Next Family Meeting   only a meeting really on the family's calendar; otherwise Start / Continue, honestly.
 *
 * Real data only: no sample responsibilities, no made-up dates. No development stages or coaching here.
 */
import { useEffect, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { isDemo, useCalendar } from '../../lib/calendar/client';
import { localToday, occurrences, timeLabel } from '../../lib/calendar/recurrence';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { upcomingTasks, useEventTasks, type EventTasks, type TodayTask } from '../../lib/calendar/event-tasks';
import { agreementsByPerson, monthOf, type PersonAgreements } from '../../lib/family-meeting-support';
import { useFamily } from '../../lib/family-meeting-client';
import { choreChoices } from '../../data/chore-recommendations';
import { growthIdeas, existingRoles } from '../../lib/app/onboarding-bridge';
import type { FamilyProfile } from '../../lib/club/family-profile';
import type { ResponsibilityCategory } from '../../data/club/family-profile';
import { planFor } from '../../lib/schedule';
import { dailyEssentials } from '../../data/cleaning';
import { dateKey } from '../../lib/dates';
import { keys, readList } from '../../lib/storage';
import { PRIORITIES } from '../../data/club/family-profile';
import { MEETING_GUIDE } from '../../data/club/meeting-guide';
import { visibleFeatures } from '../../data/app/features';
import { routes } from '../../routes';
import { monthPage } from '../../data/club/month-pages';
import { useKeptClubMonths, useShowsClub } from './TodayOverview';
import { Avatar, Chevron, Icon } from './ui';
import { householdAccess } from '../../lib/household/api';
import { appShellBuild } from '../../lib/native/platform';
import { firstSteps, gettingStarted, inviteSkipped, nextStep, skipInvite, starterIdeas, type FirstStep } from '../../lib/app/first-steps';
import { dayWord, meetingState, nextScheduledMeeting, readProgress } from '../../lib/app/meeting-progress';
import { SHOWN, currentPriorities, usePriorities, type Resolved } from '../../lib/app/priorities';
import { tasksFor } from '../../lib/calendar/event-tasks';
import type { CalendarEvent } from '../../lib/calendar/recurrence';

const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const MEETING = '/app/family/meeting';

/** Today's cleaning reset progress, from the same checkmarks the cleaning companion keeps (HomeStatus's rule). */
function useCleaningProgress(today: Date) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('pageshow', refresh); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('pageshow', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const plan = planFor(today);
  const daily = new Set(readList(keys.daily(dateKey(today))));
  const zoneTasks = plan.kind === 'weekday' ? plan.focus.tasks : [];
  const zoneChecked = new Set(readList(keys.focus(dateKey(today))));
  const done = dailyEssentials.tasks.filter((t) => daily.has(t.id)).length + zoneTasks.filter((t) => zoneChecked.has(t.id)).length;
  return { done, total: dailyEssentials.tasks.length + zoneTasks.length };
}

export default function TodayDashboard() {
  const today = useToday();
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' ? cal.state.scope : null;
  const fam = useFamily(scope);
  const profile = fam.profile;
  const date = localToday(today);
  const live = cal.state.scope !== 'local' && cal.signedIn && !isDemo() ? cal.state.scope : null;
  // Her subscribed calendars too (private ones are hers to see); read-only.
  const ext = useExternalCalendars(live, 'mine');
  const own = Object.values(cal.state.events);
  const events = [...own, ...ext.events];
  // Responsibilities on imported events (staged rollout: hidden until it's on for the household).
  const eventTasks = useEventTasks(live);
  // Today's, plus any unfinished one whose event left the calendar this week (so it can be removed, never lost).
  const week = eventTasks.available ? upcomingTasks(eventTasks.tasks, ext.events, date, 7) : [];
  const todays = week.filter((x) => x.date === date || !x.event);
  const laterThisWeek = week.filter((x) => x.date > date && x.event && !x.task.done).length;
  const agreed = agreementsByPerson(cal.household, profile);
  const showsClub = useShowsClub() && visibleFeatures().some((f) => f.id === 'club');
  const kept = useKeptClubMonths();
  const cleaning = useCleaningProgress(today);
  const [shared, setShared] = useState(false);
  useEffect(() => {
    if (!cal.signedIn || isDemo()) return;
    void householdAccess().then((a) => setShared((a?.adults.length ?? 1) > 1), () => setShared(false));
  }, [cal.signedIn]);
  const progress = readProgress(scope);
  const agreedParts = new Set(agreed.flatMap((p) => p.parts.map((x) => x.id))).size;
  const [skipped, setSkipped] = useState(false);
  useEffect(() => setSkipped(inviteSkipped()), []);
  const steps = firstSteps({ household: cal.household, signedIn: cal.signedIn, shared, agreedParts, met: Boolean(progress?.completedAt),
    inviteSkipped: skipped, offerClub: !appShellBuild() && !showsClub });
  const starting = !isDemo() && !(cal.signedIn && !cal.household && cal.status === 'syncing') && gettingStarted(steps);

  const state = meetingState(progress, agreed.length > 0, today);
  const ownFocus = profile?.priority ? (profile.priority === 'other' ? profile.priorityNote?.trim() || null : PRIORITIES.find((p) => p.id === profile.priority)?.label ?? null) : null;
  const plansToday = occurrences(events, date, date).length;
  // This week's priorities, chosen in the Family Meeting (both adults; docs/ios/FAMILY_PLAN.md).
  const prio = usePriorities(live, date);
  const { list: current, from } = currentPriorities(prio.items, events, date);
  const [showAllPriorities, setShowAllPriorities] = useState(false);
  const visiblePriorities = showAllPriorities ? current : current.slice(0, SHOWN);
  // A task shown under its highlighted priority should not appear a second time
  // in Everyone's part today. Tasks on unhighlighted events still appear there.
  const nestedTaskIds = new Set(visiblePriorities.flatMap((r) => {
    if (r.gone || r.priority.source !== 'imported' || !eventTasks.available) return [];
    const event = ext.events.find((e) => e.external?.uid === r.priority.event_uid && e.external?.instance_key === r.priority.instance_key);
    return event ? tasksFor(eventTasks.tasks, event).map((t) => t.id) : [];
  }));
  const otherTasks = todays.filter((x) => !nestedTaskIds.has(x.task.id));
  // A brand-new family (nothing shared yet, nothing chosen yet) sees one thing: its first shared win.
  const firstWin = starting && nextStep(steps)?.id === 'share' && !current.length;

  return (
    <div className="space-y-4" data-today>
      {isDemo() && (
        <div className="family-note" data-today-demo><strong className="text-sm">Demo · Not a real family</strong><p className="mt-1 text-sm">A made-up family, to show how Today looks. Nothing here is shared or synced. <a href="/app" className="underline">Leave the demo</a>.</p></div>
      )}
      {starting && <StartHere steps={steps} cal={cal} profile={profile} save={fam.saveAgreement} month={monthOf(today)} onSkip={() => { skipInvite(); setSkipped(true); }} />}

      {/* A brand-new family sees one thing: its first shared win. The rest of Today fills in from there. */}
      {cal.household && !firstWin && <FocusPanel ownFocus={ownFocus} clubMonth={showsClub ? monthPage(today.getMonth() + 1).name : null} first={state === 'first'} />}

      {cal.household && !firstWin && prio.available && <OurPriorities current={current} from={from} first={state === 'first'} tasks={eventTasks} external={ext.events} household={cal.household} all={showAllPriorities} setAll={setShowAllPriorities} />}

      {cal.household && !firstWin && <Responsibilities todays={otherTasks} later={laterThisWeek} agreed={agreed} profile={profile} cal={cal} tasks={eventTasks} today={date} />}

      <nav aria-label="More for today" className="grid grid-cols-3 gap-2.5" data-today-shortcuts>
        <Shortcut href={routes.familyCalendar} icon="calendar" title="Plans" sub={plansToday ? `${plansToday} ${plansToday === 1 ? 'event' : 'events'} today` : 'Nothing today'} id="plans" />
        <Shortcut href="/app/cleaning" icon="check" title="Cleaning" sub={cleaning.done ? `${cleaning.done} of ${cleaning.total} done` : 'Today’s reset'} id="cleaning" />
        <Shortcut href="/app/family" icon="list" title="Resources" sub={showsClub || kept > 0 ? 'Guides & Club' : 'Family & guides'} id="resources" />
      </nav>

      {cal.household && <NextMeeting events={own} today={today} state={state} completedAt={progress?.completedAt ?? null} step={progress?.step ?? 0} />}

      {cal.signedIn && !isDemo() && (
        <p className="pt-2 text-center text-[0.85rem] text-warm-soft" data-feedback-quiet>
          Something confusing or not working? <a href="/app/feedback?from=/app" className="underline underline-offset-4">Tell us</a>
        </p>
      )}
    </div>
  );
}

type Cal = ReturnType<typeof useCalendar>;

/** Our family focus: the family's own, else this month's prepared topic (labeled as such), else a first-meeting invitation. */
function FocusPanel({ ownFocus, clubMonth, first }: { ownFocus: string | null; clubMonth: string | null; first: boolean }) {
  const [eyebrow, title] = ownFocus ? ['Our family focus', ownFocus]
    : clubMonth ? ['This month · prepared for your family', clubMonth]
    : first ? ['Your first Family Meeting', 'Ten minutes together to agree who does what.']
    : [null, null];
  if (!title) return null;
  return (
    <a href={MEETING} className="of-tile of-tile--month !py-4" data-today-focus={ownFocus ? 'family' : clubMonth ? 'club-month' : 'first'}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 border-l-2 border-[var(--of-month-accent)] pl-3">
          <p className="of-eyebrow">{eyebrow}</p>
          <p className="mt-1 font-serif text-[1.3rem] leading-snug text-warm-ink">{title}</p>
        </div>
        <Chevron />
      </div>
    </a>
  );
}

/**
 * Our priorities this week: the few things the family chose in its meeting (never automatic), each linked to its
 * event as it is now. Before a first meeting, or when a week goes by without one, it says so plainly, without guilt.
 */
function OurPriorities({ current, from, first, tasks, external, household, all, setAll }: { current: Resolved[]; from: 'this-week' | 'last-meeting' | null; first: boolean; tasks: EventTasks; external: CalendarEvent[]; household: Cal['household']; all: boolean; setAll: (value: boolean) => void }) {
  // Three is the normal view; a busy week's fourth and fifth are one tap away, in place (never hidden elsewhere).
  const [error, setError] = useState<string | null>(null);
  const shown = all ? current : current.slice(0, SHOWN);
  const when = (r: Resolved) => (r.date ? `${dayName(r.date)}${r.time ? ` · ${r.time}` : ''}` : 'This week');
  return (
    <section className="of-tile" aria-labelledby="priorities-h" data-today-priorities={from ?? 'none'}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="priorities-h" className="font-serif text-[1.35rem] leading-tight">Our priorities this week</h2>
        {from === 'last-meeting' && <span className="text-[0.8rem] text-warm-soft">From your last meeting</span>}
      </div>
      {shown.length ? (
        <ol className="of-rows mt-1">
          {shown.map((r, i) => {
            const ext = r.priority.source === 'imported' ? external.find((e) => e.external?.uid === r.priority.event_uid && e.external?.instance_key === r.priority.instance_key) : undefined;
            const parts = ext && tasks.available ? tasksFor(tasks.tasks, ext) : [];
            const person = (id: string | null) => household?.members.find((m) => m.id === id && !m.archived)?.firstName ?? 'Anyone';
            return (
              <li key={r.priority.id} className="border-b border-[var(--of-rule)] py-3 last:border-0" data-today-priority={r.title}>
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--of-month-wash)] font-serif text-[1rem] text-warm-ink">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-warm-ink">{r.title}</p>
                    <p className="mt-0.5 text-[0.82rem] text-warm-soft">{r.gone ? <span className="text-[#a33]">No longer on the calendar</span> : when(r)}</p>
                    {parts.length > 0 && (
                      <ul className="mt-2 space-y-1.5" aria-label={`Who is handling ${r.title}`} data-today-priority-parts>
                        {parts.map((t) => (
                          <li key={t.id} className="flex items-start gap-2 text-[0.88rem] leading-snug">
                            <button type="button" role="checkbox" aria-checked={t.done} aria-label={`${t.title}, ${person(t.member_id)}`}
                              onClick={async () => setError(await tasks.toggle(t.id))}
                              className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--of-rule-strong)] text-[0.8rem] text-warm-ink"
                              data-priority-part-toggle={t.id}>{t.done ? '✓' : '·'}</button>
                            <span className={t.done ? 'text-warm-soft line-through' : 'text-warm-ink'}>
                              <span className="font-medium">{person(t.member_id)}</span> · {t.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-2 text-[0.92rem] text-warm-soft" data-no-priorities>{first ? 'In your first Family Meeting, choose up to three things the whole family needs to know about or get ready for.' : 'Choose this week’s few in your next Family Meeting, whenever it suits you.'}</p>
      )}
      {error && <p className="mt-2 text-[0.85rem] text-[#a33]" role="alert">{error}</p>}
      {current.length > SHOWN && (
        <button type="button" className="mt-1 min-h-11 text-[0.85rem] text-warm-soft underline underline-offset-4" aria-expanded={all} onClick={() => setAll(!all)} data-priorities-more>
          {all ? 'Show the top three' : `Show ${current.length - SHOWN} more`}
        </button>
      )}
      <a href={MEETING} className="of-tile-action mt-3" data-priorities-meeting>{shown.length ? 'Change in the Family Meeting' : 'Open the Family Meeting'} <Chevron /></a>
    </section>
  );
}

/** "Amara", "Amara and Ben", "Amara, Ben and Cleo", "Amara, Ben and 4 more". */
export const names = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : xs.length <= 3 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : `${xs.slice(0, 2).join(', ')} and ${xs.length - 2} more`;

/**
 * Each person's most recent standing part, once, with people who agreed the very same part (same words, same "when")
 * on one row: six children who each pack their bag are one line, not six. Order kept (children first).
 */
export function standingRows(people: PersonAgreements[]): { part: PersonAgreements['parts'][number]; people: PersonAgreements[] }[] {
  const rows = new Map<string, { part: PersonAgreements['parts'][number]; people: PersonAgreements[] }>();
  for (const p of people) {
    const x = p.parts[p.parts.length - 1];
    if (!x) continue;
    const key = `${x.text.trim().toLowerCase()}|${(x.when ?? '').trim().toLowerCase()}`;
    const row = rows.get(key);
    if (row) row.people.push(p); else rows.set(key, { part: x, people: [p] });
  }
  return [...rows.values()];
}

/**
 * Today's responsibilities: what can be checked off today (responsibilities on today's calendar events), then each
 * person's standing agreements, once each. A family with none is invited to agree them in the Family Meeting.
 */
function Responsibilities({ todays, later, agreed, profile, cal, tasks, today }: { todays: TodayTask[]; later: number; agreed: PersonAgreements[]; profile: FamilyProfile | null; cal: Cal; tasks: EventTasks; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const member = (id: string | null) => (id ? cal.household?.members.find((m) => m.id === id && !m.archived) : undefined);
  const empty = !todays.length && !agreed.length;
  const known = existingRoles(profile).slice(0, 4);
  // A manageable list: today's trackable responsibilities, then one standing part per person, about six rows in all.
  // Children first: their parts are the ones the family is handing over. Adults' are in the full list too.
  const kidsFirst = [...agreed].sort((a, b) => Number(member(b.memberId)?.kind === 'child') - Number(member(a.memberId)?.kind === 'child'));
  const standing = standingRows(kidsFirst).slice(0, Math.max(3, 6 - todays.length));
  const total = new Set(agreed.flatMap((p) => p.parts.map((x) => x.id))).size;
  return (
    <section className="of-tile" aria-labelledby="today-resp-h" data-today-responsibilities data-everyones-part>
      <div className="flex items-center gap-2.5">
        <Icon name="family" size={22} />
        <h2 id="today-resp-h" className="font-serif text-[1.35rem] leading-tight">Everyone’s part today</h2>
      </div>
      {empty ? (
        <div className="mt-3" data-no-agreements>
          <p className="text-[0.95rem] text-warm-soft">Nothing agreed yet. In your Family Meeting, everyone takes one part, and it shows here for the whole family.</p>
          <a href={MEETING} className="of-btn of-btn--soft mt-4">Open the Family Meeting</a>
        </div>
      ) : (
        <>
          {todays.length > 0 && (
            <ul className="of-rows mt-1" aria-label="To do today" data-today-trackable>
              {todays.map((x) => {
                const m = member(x.task.member_id);
                const when = x.event?.start_time ? ` · ${timeLabel(x.event)}` : '';
                return (
                  <li key={x.task.id} className="of-row !gap-3" data-today-task={x.task.title} data-done={x.task.done ? '' : undefined}>
                    {m ? <Avatar name={m.firstName} color={cal.colors[m.id]} /> : <span aria-hidden="true" className="of-avatar" style={{ background: '#f1eee8', color: '#8c8579' }}>·</span>}
                    <span className="min-w-0 flex-1">
                      <span className="of-row-title block">{m?.firstName ?? 'Anyone'}</span>
                      <span className={`block text-[0.92rem] ${x.task.done ? 'text-warm-soft line-through' : 'text-warm-ink'}`}>{x.task.title}</span>
                      <span className="of-row-meta">{x.event ? x.event.title : x.task.event_title}{when}</span>
                      {!x.event && <span className="block text-[0.8rem] text-[#a33]" data-task-orphan>No longer on the calendar · <button type="button" className="underline underline-offset-2" onClick={async () => setError(await tasks.remove(x.task.id))} data-task-orphan-remove>Remove</button></span>}
                    </span>
                    <button type="button" role="checkbox" aria-checked={x.task.done} aria-label={`${x.task.title}${m ? `, ${m.firstName}` : ''}`}
                      onClick={async () => setError(await tasks.toggle(x.task.id))} className="grid size-11 shrink-0 place-items-center" data-task-done>
                      <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full border-2 text-[0.85rem] font-bold ${x.task.done ? 'border-[var(--of-sage-bar)] bg-[var(--of-sage-bar)] text-white' : 'border-[var(--of-rule-strong)] bg-white'}`}>{x.task.done ? '✓' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {standing.length > 0 && (
            <>
              {todays.length > 0 && <p className="of-eyebrow mt-4" data-agreed-heading>Our standing parts</p>}
              {/* One per person (the most recently agreed), never the whole household list: that's one tap away. */}
              <ul className="of-rows mt-1" aria-label="What we agreed" data-agreed-parts>
                {standing.map((row) => (
                  <li key={row.people.map((p) => p.memberId).join('|')} data-part-person={row.people.map((p) => p.name).join(', ')} data-part-people={row.people.length}>
                    <a href="/app/family/responsibilities" className="of-row !gap-3">
                      <span className="flex shrink-0 -space-x-3" aria-hidden="true">
                        {row.people.slice(0, 3).map((p) => <Avatar key={p.memberId} name={p.name} color={cal.colors[p.memberId]} />)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="of-row-title block">{names(row.people.map((p) => p.name))}</span>
                        <span className="block text-[0.92rem] text-warm-ink" data-agreement={row.part.id}>{row.part.text}</span>
                        {row.part.when && <span className="of-row-meta">{row.part.when}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {total > 0 && <a href="/app/family/responsibilities" className="of-tile-action mt-3" data-all-parts>All of everyone’s parts ({total}) <Chevron /></a>}
          {later > 0 && <a href={routes.familyCalendar} className="of-tile-action mt-3" data-today-later>{later} more this week <Chevron /></a>}
        </>
      )}
      {known.length > 0 && (
        <details className="mt-3 border-t border-[var(--of-rule)] pt-2" data-onboarding-existing>
          <summary className="min-h-11 cursor-pointer text-[0.85rem] text-warm-soft">Already part of your family's routine ({existingRoles(profile).length})</summary>
          <ul className="space-y-1.5 pb-2 text-[0.88rem] text-warm-soft">
            {known.map((r, i) => <li key={i}>{r.owners.map((id) => member(id)?.firstName).filter(Boolean).join(', ')} · {r.label}</li>)}
          </ul>
          <p className="text-[0.8rem] text-warm-soft">From your family setup. These are not new agreements.</p>
        </details>
      )}
      {error && <p role="alert" className="mt-2 text-[0.88rem] text-[#a33]">{error}</p>}
    </section>
  );
}

function Shortcut({ href, icon, title, sub, id }: { href: string; icon: 'calendar' | 'check' | 'list'; title: string; sub: string; id: string }) {
  return (
    <a href={href} className="of-tile min-w-0 !p-3" data-today-shortcut={id}>
      <div className="flex min-h-[80px] flex-col items-center justify-center text-center">
        <Icon name={icon} size={26} />
        <p className="mt-1.5 text-[0.95rem] font-semibold leading-tight text-warm-ink">{title}</p>
        <p className="mt-0.5 text-[0.78rem] leading-tight text-warm-soft">{sub}</p>
      </div>
    </a>
  );
}

/** The weekly rhythm: a meeting really on the calendar, or where the family is with it. Never a made-up time. */
function NextMeeting({ events, today, state, completedAt, step }: { events: Parameters<typeof nextScheduledMeeting>[0]; today: Date; state: ReturnType<typeof meetingState>; completedAt: string | null; step: number }) {
  const scheduled = nextScheduledMeeting(events, localToday(today), today);
  const title = state === 'in-progress' ? 'Continue your Family Meeting' : 'Next Family Meeting';
  const sub = state === 'in-progress' ? `Pick up at ${MEETING_GUIDE.parts[step]?.title ?? MEETING_GUIDE.parts[0].title}.`
    : scheduled ? `${scheduled.date === localToday(today) ? 'Today' : dayName(scheduled.date)}, ${new Date(`${scheduled.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}${scheduled.time ? ` · ${scheduled.time}` : ''}`
    : state === 'recent' && completedAt ? `You met ${['today', 'yesterday'].includes(dayWord(completedAt, today)) ? dayWord(completedAt, today) : `on ${dayWord(completedAt, today)}`}. Ten minutes, once a week.`
    : 'Ten minutes, once a week. Pick a time that works for everyone.';
  return (
    <a href={MEETING} className="of-tile" data-next-meeting={state} data-next-meeting-scheduled={scheduled ? scheduled.date : undefined}>
      <div className="flex items-center gap-4">
        <span className="of-icon-box of-icon-box--sage shrink-0"><Icon name="meeting" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[1.2rem] leading-snug text-warm-ink">{title}</p>
          <p className="text-[0.9rem] text-warm-soft">{sub}</p>
        </div>
        <Chevron />
      </div>
    </a>
  );
}

/**
 * A new family's first screen: what the app is for in one line, and ONE next step (src/lib/app/first-steps.ts). After
 * the household, the first shared win right here: one person, one responsibility, "We agreed" (about a minute; an
 * ordinary agreement, the same the Family Meeting saves). No calendar, invitation, Club or meeting needed first.
 */
function StartHere({ steps, cal, profile, save, month, onSkip }: { steps: FirstStep[]; cal: Cal; profile: FamilyProfile | null; save: ReturnType<typeof useFamily>['saveAgreement']; month: string; onSkip: () => void }) {
  const next = nextStep(steps);
  if (!next) return null;
  const own = steps.filter((s) => s.id !== 'club');
  const done = own.filter((s) => s.done).length;
  if (!cal.household) {
    return (
      <section className="of-tile of-tile--month of-span-all" style={{ order: -1 }} aria-labelledby="start-here-h" data-start-here="household">
        <p className="of-eyebrow">Start here · Free</p>
        <h2 id="start-here-h" className="of-tile-title of-tile-title--lg">One shared plan for your family’s week.</h2>
        <p className="of-tile-sub">A ten-minute weekly Family Meeting where everyone takes a part, and the plan on Today for the whole family, so it isn’t all on you.</p>
        <a href={next.href} className="of-btn mt-5" data-start-next={next.id}>Set up your family</a>
        <p className="mt-3 text-[0.85rem] text-warm-soft">About a minute: first names and ages. Kids don’t need accounts.</p>
      </section>
    );
  }
  if (next.id === 'share') return <FirstWin cal={cal} profile={profile} save={save} month={month} done={done} total={own.length} />;
  return (
    <section className="of-tile of-span-all" style={{ order: -1 }} aria-labelledby="start-here-h" data-start-here={next.id}>
      <p className="of-eyebrow">Getting started · {done} of {own.length} done</p>
      <h2 id="start-here-h" className="of-tile-title">{next.label}</h2>
      {next.id === 'meeting' && <p className="of-tile-sub">Everyone at the table: what matters this week, and who takes which part.</p>}
      <a href={next.href} className="of-btn mt-4" data-start-next={next.id}>{next.id === 'meeting' ? 'Open the Family Meeting' : 'Invite them'}</a>
      {next.id === 'adult' && <button type="button" className="ml-4 min-h-11 text-[0.9rem] underline underline-offset-4" onClick={onSkip} data-start-skip>Skip for now</button>}
    </section>
  );
}

/** The first shared win: who takes it, what it is (a few age-fit ideas, or their own words), "We agreed". */
function FirstWin({ cal, profile, save, month, done, total }: { cal: Cal; profile: FamilyProfile | null; save: ReturnType<typeof useFamily>['saveAgreement']; month: string; done: number; total: number }) {
  const people = (cal.household?.members ?? []).filter((m) => !m.archived && m.firstName.trim())
    .sort((a, b) => Number(b.kind === 'child') - Number(a.kind === 'child'));
  const [who, setWho] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ResponsibilityCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people.find((m) => m.id === who);
  const age = person?.kind === 'child' && person.birthYear ? new Date().getFullYear() - person.birthYear : null;
  const savedIdeas = person?.kind === 'child' ? growthIdeas(profile, person.id) : [];
  const ideas = person ? starterIdeas(age, choreChoices).filter((x) => !savedIdeas.some((idea) => idea.label === x)) : [];
  const known = existingRoles(profile).slice(0, 2);
  const submit = async () => {
    if (!who || !text.trim()) return;
    setBusy(true); setError(null);
    try { await save({ category, text, ownerIds: [who], month }); }
    catch { setError('Couldn’t save that. Try again in a moment.'); }
    setBusy(false);
  };
  return (
    <section className="of-tile of-tile--month of-span-all" style={{ order: -1 }} aria-labelledby="start-here-h" data-start-here="share">
      <p className="of-eyebrow">Getting started · {done} of {total} done · About a minute</p>
      <h2 id="start-here-h" className="of-tile-title of-tile-title--lg">Start with one thing your family can share.</h2>
      <p className="of-tile-sub">One job that’s on your mind right now. Ask who will own it, start to finish.</p>
      {known.length > 0 && <p className="mt-2 text-[0.85rem] text-warm-soft" data-first-win-existing>From your setup, we already know who's helping with {known.map((x) => x.label.toLowerCase()).join(' and ')}. Now agree on one part together.</p>}
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} data-first-win>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft" id="first-win-who">Who will own it?</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="first-win-who">
          {people.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={who === m.id} onClick={() => { setWho(m.id); setText(''); setCategory('other'); }} data-first-win-who={m.firstName}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 text-sm ${who === m.id ? 'border-warm-ink bg-[var(--of-sage)] font-semibold' : 'border-[var(--of-rule)] bg-white'}`}>
              <Avatar name={m.firstName} color={cal.colors[m.id]} size="sm" />{m.firstName}
            </button>
          ))}
        </div>
        {person && (
          <>
            <label className="mt-4 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-warm-soft">What will {person.firstName} own?
              <input value={text} maxLength={160} onChange={(e) => { setText(e.target.value); setCategory('other'); }} placeholder="Feed the dog before school" className="mt-1 block min-h-[44px] w-full rounded-[8px] border border-[var(--of-rule)] bg-white px-2 text-[0.95rem] normal-case tracking-normal text-warm-ink" data-first-win-text />
            </label>
            {savedIdeas.length > 0 && (
              <div className="mt-3" data-first-win-growth>
                <p className="mb-1 text-[0.78rem] text-warm-soft">You mentioned wanting to grow responsibility in:</p>
                <div className="flex flex-wrap gap-2">
                  {savedIdeas.slice(0, 3).map((x) => <button key={x.label} type="button" onClick={() => { setText(x.label); setCategory(x.category); }} className="min-h-[40px] rounded-full border border-[var(--of-sage-bar)] bg-[var(--of-sage)] px-3 text-[0.85rem]" data-growth-idea={x.label}>{x.label}</button>)}
                </div>
              </div>
            )}
            {ideas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Ideas">
                {ideas.map((x) => <button key={x} type="button" onClick={() => { setText(x); setCategory('other'); }} className="min-h-[40px] rounded-full border border-[var(--of-rule)] bg-white px-3 text-[0.85rem] text-warm-soft" data-first-win-idea={x}>{x}</button>)}
              </div>
            )}
            <button type="submit" className="of-btn mt-4" disabled={busy || !text.trim()} data-first-win-save>We agreed</button>
          </>
        )}
        {error && <p role="alert" className="mt-2 text-[0.88rem] text-[#a33]">{error}</p>}
      </form>
      <p className="mt-4 text-[0.85rem] text-warm-soft">It shows on Today for the whole family. Your first Family Meeting can come next.</p>
    </section>
  );
}
