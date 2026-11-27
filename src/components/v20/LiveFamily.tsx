/**
 * Organized Family in production (/app and /app/family/meeting; docs/ios/V20_LAUNCH.md, docs/ios/V21_PREVIEW.md): the
 * approved V21 Today (src/components/v21/TodayV21.tsx) and the Family Meeting with V21's "Since last time", on the
 * signed-in household's REAL data. V21's requests, event choices, remembered decisions, per-date completion and routine
 * cards live in the household intelligence document; agreements they create go through the agreements store.
 *
 * Reads: the household and its people (member colors), this adult's member id, agreements (offline-first outbox),
 * the family calendar and the connected calendars this adult may see, event responsibilities, priorities, development
 * records (Club), the meeting checkpoint, cleaning marks and rhythm, and the household's intelligence state.
 * Writes: whatever a V20 interaction changed, through those same stores (src/lib/v20/live.ts → writesFor).
 * Notifications: the locked rules (src/lib/v20/notify.ts) decide; this device queues them (the database dedupes per
 * household) and Web Push delivers them. A tapped "I've got it" is applied here as the signed-in adult.
 *
 * No demo controls, no fictional family, no demo clock, no simulated interpreter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToday } from '../../lib/hooks';
import { accountRpc, getSession } from '../../lib/account';
import { useCalendar } from '../../lib/calendar/client';
import { feedsApi, useExternalCalendars } from '../../lib/calendar/feeds';
import { localToday, weekStart, type CalendarEvent } from '../../lib/calendar/recurrence';
import { newEventId } from '../../lib/calendar/store';
import { useEventTasks } from '../../lib/calendar/event-tasks';
import { usePriorities } from '../../lib/app/priorities';
import { readProgress, recordFinished, recordStep, type MeetingProgress } from '../../lib/app/meeting-progress';
import { useSharedMeetingProgress } from '../../lib/app/shared-meeting-progress';
import { useFamily } from '../../lib/family-meeting-client';
import { newAgreementId, type AgreementRow } from '../../lib/agreements/store';
import { useDevelopment, useMeetingAccess } from '../../lib/family-development/client';
import { recordScope } from '../../lib/family-development/meeting-plan';
import { buildFamilyMeeting } from '../../lib/club/family-meeting';
import { householdAccess, type HouseholdAccess } from '../../lib/household/api';
import { CLEANING_SYNC_EVENT } from '../../lib/cleaning-sync/client';
import { cleaningChecks, decodeRhythm, rhythmChanges, toggleCleaningCheck, type Settings } from '../../lib/cleaning-sync/rhythm';
import { linkOf, type V16State } from '../../lib/v16/model';
import { useHouseholdIntel, type SharedIntel } from '../../lib/v20/intel-sync';
import { liveState, preparedParts, writesFor, type Write } from '../../lib/v20/live';
import { gotIt, markSent, notTonight, outbox, type PushNote } from '../../lib/v20/notify';
import { queueNotifications, readNotification, tappedFromUrl } from '../../lib/v20/push';
import TodayV21 from '../v21/TodayV21';
import Meeting, { CheckIn, PlanSummary } from '../v16/Meeting';
import { Assistance, Noticed, Notifications, withMonthParts } from '../v16/V16App';
import { disablePush, enablePush, pushEnabled, pushSupport } from '../../lib/v20/push';
import { enginePeople } from '../v18/TodayV18';
import type { Ctx, Route } from '../v16/shared';

type Page = 'today' | 'meeting' | 'settings';
const HREF: Partial<Record<Route, string>> = { today: '/app', plans: '/app/family-calendar', cleaning: '/app/cleaning', resources: '/app/family', account: '/app/account' };
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Cleaning rhythm (one-week moves, mode) and the checkmarks, as the Cleaning tab keeps them. */
function useCleaning(scope: string | null, monday: string) {
  const key = `omc:household:rhythm:${scope ?? 'local'}`;
  const [settings, setSettings] = useState<Settings>(() => { try { return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}; } catch { return {}; } });
  const [checks, setChecks] = useState(() => cleaningChecks(monday));
  const refresh = useCallback(() => setChecks(cleaningChecks(monday)), [monday]);
  const remember = useCallback((v: Settings) => { setSettings(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* this visit */ } }, [key]);
  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(CLEANING_SYNC_EVENT, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(CLEANING_SYNC_EVENT, refresh); };
  }, [refresh]);
  useEffect(() => {
    if (!scope) return;
    let on = true;
    const load = () => accountRpc<Settings>('family_cleaning_rhythm', { p_household: scope }).then((v) => { if (on) remember(v); }).catch(() => undefined);
    void load();
    window.addEventListener('focus', load);
    return () => { on = false; window.removeEventListener('focus', load); };
  }, [scope, remember]);
  const rhythm = decodeRhythm(settings, checks);
  const toggle = (k: string) => { toggleCleaningCheck(k); refresh(); };
  const save = async (patch: Partial<V16State['cleaning']>) => {
    let next = { ...settings };
    for (const [field, value] of Object.entries(rhythmChanges(rhythm, patch))) {
      if (scope) next = await accountRpc<Settings>('family_cleaning_rhythm', { p_household: scope, p_setting: field, p_value: value, p_expected: settings[field] ?? null });
      else if (value === null) delete next[field]; else next[field] = value;
    }
    remember(next);
  };
  return { rhythm, toggle, save };
}

export default function LiveFamily({ page }: { page: Page }) {
  const now = useToday();
  const today = localToday(now);
  const monday = weekStart(today, 1);
  const cal = useCalendar();
  const scope = cal.state.scope !== 'local' && cal.signedIn ? cal.state.scope : null;
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [access, setAccess] = useState<HouseholdAccess | null>(null);
  useEffect(() => { void getSession().then((s) => setSignedIn(Boolean(s))).catch(() => setSignedIn(false)); }, []);
  useEffect(() => { if (scope) void householdAccess().then(setAccess).catch(() => undefined); }, [scope]);

  const fam = useFamily(scope);
  const ext = useExternalCalendars(scope, 'mine');
  // Calendar links this adult added are refreshed when they open the app (at most every 6 hours, once a visit), through
  // the same signed-in call as "Refresh" in Plans: no stale school calendar, no shared server secret.
  const refreshed = useRef(false);
  useEffect(() => {
    if (!scope || refreshed.current || !ext.feeds.length) return;
    refreshed.current = true;
    const stale = ext.feeds.filter((f) => f.mine && f.kind === 'ical' && f.status !== 'disconnected'
      && (!f.last_success_at || Date.now() - Date.parse(f.last_success_at) > 6 * 3600_000));
    void (async () => { for (const f of stale) await feedsApi.refresh(f.id).catch(() => undefined); if (stale.length) await ext.reload(); })();
  }, [scope, ext.feeds]); // eslint-disable-line react-hooks/exhaustive-deps
  const tasks = useEventTasks(scope);
  const prios = usePriorities(scope, today);
  const meetingAccess = useMeetingAccess();
  const club = meetingAccess.club;
  const dev = useDevelopment(recordScope({ userId: meetingAccess.userId, householdId: scope, club }));
  const [progress, setProgress] = useState<MeetingProgress | null>(() => readProgress(scope));
  useEffect(() => setProgress(readProgress(scope)), [scope]);
  const onProgress = useCallback((p: MeetingProgress | null) => setProgress(p), []);
  useSharedMeetingProgress(scope, onProgress);
  const cleaning = useCleaning(scope, monday);
  const intel = useHouseholdIntel(scope, today);
  const [session, setSession] = useState<Pick<V16State, 'practice' | 'wall'> & { talkIndex: number }>({ practice: {}, wall: { format: 'weekly', plan: null }, talkIndex: 0 });
  const [route, setRoute] = useState<Route | 'settings'>(page);

  const household = cal.household;
  const people = useMemo(() => (household?.members ?? []).filter((m) => !m.archived), [household]);
  const agreements = useMemo((): AgreementRow[] => (fam.profile?.responsibilities ?? []).filter((r) => r.status === 'confirmed' && r.id && r.agreement).map((r) => ({
    id: r.id!, category: r.category, owner_ids: r.ownerIds, text: r.agreement!.text, finished: r.agreement!.finished ?? null, when: r.agreement!.when ?? null,
    month: r.agreement!.month ?? null, source: r.agreement!.source ?? null, revision: 1, confirmed_at: r.agreement!.agreedAt ?? null,
  })), [fam.profile]);
  const events = useMemo(() => [...Object.values(cal.state.events).filter((e) => !e.deleted), ...ext.events], [cal.state.events, ext.events]);
  const viewer = access?.myMemberId ?? null;
  const monthClub = useMemo(() => (club && household ? buildFamilyMeeting({ household, profile: fam.profile, month: today.slice(0, 7) }) : null), [club, household, fam.profile, today]);

  const derived = useMemo(() => {
    if (!household) return null;
    const s = liveState({
      today, viewer, adults: access?.adults.length ?? 1, agreements, events, tasks: tasks.tasks, tasksAvailable: tasks.available, priorities: prios.items,
      records: dev.records ?? [], meeting: progress, cleaning: cleaning.rhythm, intel: intel.state, club, online: typeof navigator === 'undefined' || navigator.onLine, session,
    });
    const withMonth = { ...s, parts: withMonthParts(s, monthClub) };
    if (page !== 'meeting') return withMonth;
    // In the meeting: this week's real activities' preparation, as suggestions (V18 playbooks, never assumed).
    const persons = people.map((m) => ({ id: m.id, firstName: m.firstName, kind: m.kind === 'adult' ? 'adult' as const : 'child' as const, age: m.birthYear ? Number(today.slice(0, 4)) - m.birthYear : undefined }));
    return { ...withMonth, parts: [...withMonth.parts, ...preparedParts(withMonth, monday, today, persons)] };
  }, [household, today, viewer, access, agreements, events, tasks.tasks, tasks.available, prios.items, dev.records, progress, cleaning.rhythm, intel.state, club, session, monthClub, page, people, monday]);

  // Chained changes in one interaction compose on the latest state, not a stale render.
  const latest = useRef<V16State | null>(null);
  latest.current = derived;
  const eventOf = useCallback((link: string): CalendarEvent | null => events.find((e) => linkOf(e) === link) ?? null, [events]);

  const run = useCallback((w: Write) => {
    switch (w.kind) {
      case 'agreement-save': {
        const id = w.id ?? newAgreementId();
        void fam.saveAgreement({ id, category: w.category, text: w.text, ownerIds: w.ownerIds, finished: w.finished, when: w.when, source: w.source });
        if (Object.keys(w.meta).length || w.replaces) intel.update((st) => {
          const partMeta = { ...(st.partMeta ?? {}) };
          if (Object.keys(w.meta).length) partMeta[id] = { ...(partMeta[id] ?? {}), ...w.meta };
          const pendingParts = { ...(st.pendingParts ?? {}) };
          if (w.replaces) delete pendingParts[w.replaces];
          return { ...st, partMeta, pendingParts };
        });
        break;
      }
      case 'task-save':
        void tasks.save({ id: w.id, event: w.event, title: w.title, member_id: w.memberId });
        if (w.replaces) intel.update((st) => { const pendingParts = { ...(st.pendingParts ?? {}) }; delete pendingParts[w.replaces!]; return { ...st, pendingParts }; });
        break;
      case 'task-done': void tasks.toggle(w.id); break;
      case 'priority-add': void (w.ref ? prios.highlight(w.ref, monday) : prios.addNote(w.note ?? '', monday)); break;
      case 'priority-remove': void prios.remove(w.id); break;
      case 'development': {
        const ev = w.after.history[w.after.history.length - 1];
        if (!ev) break;
        void dev.decide(w.before ?? { id: w.after.id, memberId: w.after.memberId, skillId: w.after.skillId, title: w.after.title }, {
          decision: ev.decision, stage: w.after.stage ?? undefined, title: w.after.title, cue: w.after.cue, finish: w.after.finishLine,
          check: ev.signal && ev.value ? { signal: ev.signal, value: ev.value, variation: ev.variationPracticed } : undefined, category: w.after.category,
          agreementId: w.after.agreementId,
        }).then((r) => { if (r.ok && r.agreement) fam.adoptAgreement(r.agreement as AgreementRow); });
        break;
      }
      case 'meeting-step': setProgress(recordStep(scope, w.step)); break;
      case 'meeting-finished': setProgress(recordFinished(scope)); break;
      case 'cleaning-check': cleaning.toggle(w.key); break;
      case 'cleaning-rhythm': void cleaning.save(w.patch).catch(() => undefined); break;
      case 'event-save': cal.save({ ...w.event, id: /^[0-9a-f-]{36}$/i.test(w.event.id) ? w.event.id : newEventId(), revision: 0 }); break;
      case 'intel': intel.update(w.update); break;
    }
  }, [fam, intel, tasks, prios, dev, scope, cleaning, cal, monday]);

  const set = useCallback((f: (s: V16State) => V16State) => {
    const prev = latest.current;
    if (!prev) return;
    const next = f(prev);
    if (next === prev) return;
    // Meeting-session choices stay on this device.
    if (next.practice !== prev.practice || next.wall !== prev.wall || next.meeting.talkIndex !== prev.meeting.talkIndex) {
      setSession({ practice: next.practice, wall: next.wall, talkIndex: next.meeting.talkIndex });
    }
    for (const w of writesFor(prev, next, eventOf, { tasksAvailable: tasks.available, today })) run(w);
    latest.current = next;
  }, [eventOf, run, tasks.available, today]);

  const go = useCallback((r: Route) => {
    if (r === 'meeting' && page === 'today') { location.assign('/app/family/meeting'); return; }
    if (page === 'meeting' && (r === 'meeting' || r === 'check-in' || r === 'plan')) { setRoute(r); window.scrollTo({ top: 0 }); return; }
    if (r === 'check-in' || r === 'plan') { location.assign(`/app/family/meeting#/${r}`); return; }
    location.assign(HREF[r] ?? '/app');
  }, [page]);

  const ctx: Ctx | null = useMemo(() => (derived && household ? {
    look: 'v17', gen: 21, s: derived, set, today, monday, household, colors: cal.colors,
    names: Object.fromEntries(people.map((m) => [m.id, m.firstName])), people, kids: new Set(people.filter((m) => m.kind === 'child').map((m) => m.id)), club: monthClub, go,
  } : null), [derived, household, set, today, monday, cal.colors, people, monthClub, go]);

  // The Family Meeting tab opens where the family is: Continue, the week-four check-in, the plan, or a new meeting.
  const opened = useRef(false);
  useEffect(() => {
    if (page !== 'meeting' || !derived || opened.current) return;
    opened.current = true;
    const hash = location.hash.replace(/^#\/?/, '');
    const m = derived.meeting;
    setRoute(hash === 'check-in' || hash === 'plan' ? hash : m.started ? 'meeting' : derived.scenario === 'week4' && !m.checkInDone ? 'check-in' : m.finishedOn === today ? 'plan' : 'meeting');
  }, [page, derived, today]);

  useNotifications(ctx, scope, intel.update, intel.loaded && intel.status !== 'loading');

  if (signedIn === false) return page === 'settings' ? null : <SignedOut />;
  if (signedIn && cal.status === 'no-household') return page === 'settings' ? null : <NoFamily />;
  if (!ctx) return <div aria-busy="true" className={page === 'settings' ? 'h-24' : 'h-96'} data-live-loading />;
  if (page === 'settings') return <div data-live-v20 data-route="settings"><Notifications ctx={ctx} /><PushDevice /><Assistance ctx={ctx} /><Noticed ctx={ctx} /></div>;
  return (
    <div data-live-v20 data-route={route} data-intel={intel.status}>
      {route === 'today' && <TodayV21 ctx={ctx} />}
      {route === 'meeting' && <Meeting ctx={ctx} />}
      {route === 'check-in' && <CheckIn ctx={ctx} />}
      {route === 'plan' && <PlanSummary ctx={ctx} />}
    </div>
  );
}

/**
 * Notifications: this device runs the locked rules on the shared plan and queues the result (the database keeps one
 * per household and key, so both phones computing it send it once), then records what it queued. A notification
 * tapped on this phone ("I've got it", "Not this time") is applied here, as the signed-in adult.
 */
function useNotifications(ctx: Ctx | null, scope: string | null, update: (f: (s: SharedIntel) => SharedIntel) => void, loaded: boolean) {
  const people = useMemo(() => (ctx ? enginePeople(ctx) : []), [ctx?.people, ctx?.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo((): PushNote[] => (ctx && scope && ctx.s.intel?.viewer ? outbox({ s: ctx.s, monday: ctx.monday, today: ctx.today, people, now: nowHHMM() }) : []), [ctx?.s, scope, people]); // eslint-disable-line react-hooks/exhaustive-deps
  const due = notes.filter((n) => n.status === 'deliver' || n.status === 'quiet' || n.status === 'held' || n.status === 'scheduled');
  const keys = due.map((n) => n.key).join('|');
  useEffect(() => {
    if (!scope || !due.length || !ctx) return;
    let on = true;
    void queueNotifications(scope, due).then(() => {
      if (!on) return;
      const sent = markSent(ctx.s, due, ctx.today, nowHHMM()).intel?.sent ?? {};
      update((st) => ({ ...st, sent: { ...(st.sent ?? {}), ...Object.fromEntries(due.map((n) => [n.key, sent[n.key]]).filter(([, v]) => v)) } }));
    }).catch(() => undefined);
    return () => { on = false; };
  }, [keys, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read the tapped notification from the address once, and apply it only once the household's shared state has loaded
  // (before that, the request it answers isn't known on this device yet).
  const tappedRef = useRef<ReturnType<typeof tappedFromUrl> | undefined>(undefined);
  if (tappedRef.current === undefined && typeof location !== 'undefined') tappedRef.current = tappedFromUrl();
  const handled = useRef(false);
  useEffect(() => {
    if (!ctx || !loaded || handled.current) return;
    const tapped = tappedRef.current;
    handled.current = true;
    if (!tapped) return;
    void readNotification(tapped.id).then((n) => {
      if (!n || (tapped.action !== 'got-it' && tapped.action !== 'not-tonight')) return;
      const note: PushNote = { key: tapped.id, to: n.to, purpose: n.purpose, kind: n.kind, title: n.title, body: n.body, actions: [], urgent: true,
        partId: n.data.partId ?? undefined, requestId: n.data.requestId ?? undefined, insightKey: n.data.insightKey ?? undefined, insightFp: n.data.insightFp ?? undefined, status: 'sent', at: { date: ctx.today, time: nowHHMM() }, why: '' };
      ctx.set((s) => (tapped.action === 'got-it' ? gotIt(s, note, { today: ctx.today, people }) : notTonight(s, note)));
    }).catch(() => undefined);
  }, [ctx, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** This device: Web Push on or off for the signed-in adult. Asked only when they choose it, never on launch. */
function PushDevice() {
  const support = pushSupport();
  const [on, setOn] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { void pushEnabled().then(setOn).catch(() => setOn(false)); }, []);
  const toggle = async () => {
    setNote('');
    if (on) { await disablePush(); setOn(false); return; }
    const r = await enablePush();
    setOn(r === 'on');
    if (r === 'denied') setNote('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
    if (r === 'unsupported' || r === 'error') setNote('This browser can’t receive notifications right now.');
  };
  return (
    <div className="v16-section" data-push-device>
      <h2 className="v16-h3">This device</h2>
      {support === 'install-first' ? <p className="v16-meta mt-1" data-push-install>On iPhone, add Organized Family to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.</p>
        : support === 'unsupported' ? <p className="v16-meta mt-1">This browser can’t receive notifications.</p>
        : support === 'denied' && !on ? <p className="v16-meta mt-1">Notifications are blocked for this site in your browser settings.</p>
        : <label className="v16-row-main mt-2 flex items-center justify-between gap-3"><span><span className="block">Send notifications to this device</span><span className="v16-meta">Only the ones turned on above.</span></span>
          <input type="checkbox" className="v20-switch" checked={Boolean(on)} disabled={on === null} onChange={() => void toggle()} data-push-toggle /></label>}
      {note && <p className="v16-meta mt-2" role="status">{note}</p>}
    </div>
  );
}

function NoFamily() {
  return (
    <section data-screen="today" data-no-family className="pt-2">
      <p className="v16-kicker">Organized Family</p>
      <h1 className="v16-h1">Let’s set up your family.</h1>
      <p className="v18-sub">Add who’s in your family, then plan your first week together.</p>
      <a className="of-btn of-btn--block mt-6" href="/app/family/setup" data-setup>Set up our family</a>
    </section>
  );
}

function SignedOut() {
  return (
    <section data-screen="today" data-signed-out className="pt-2">
      <p className="v16-kicker">Organized Family</p>
      <h1 className="v16-h1">Your family’s plan, together.</h1>
      <p className="v18-sub">Sign in to see today, your Family Meeting and everyone’s part.</p>
      <a className="of-btn of-btn--block mt-6" href={`/app/sign-in?next=${encodeURIComponent(location.pathname)}`} data-sign-in>Sign in</a>
    </section>
  );
}
