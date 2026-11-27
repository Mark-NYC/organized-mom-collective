/**
 * V16 experiment shell (docs/ios/V16_EXPERIMENT.md): an unlinked, noindex preview at /preview/organized-family-v16.
 * Two primary destinations, Today and Family Meeting (bottom tabs on phones and tablets, the header on wide screens,
 * as src/data/app/tabs.ts does for /app); Plans, Cleaning, Resources and Account one tap away. Hash routes, so the
 * browser's Back works through every screen.
 *
 * Runs on the fictional Rivera household (src/lib/v16/demo.ts) in this browser only (localStorage key
 * omc:v16-preview:v1). It never reads or writes the real app's data, account, calendar or cleaning progress.
 * The striped bar at the top is a reviewer control, not product UI.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildFamilyMeeting } from '../../lib/club/family-meeting';
import { localToday } from '../../lib/calendar/recurrence';
import { monthTints } from '../../lib/club/month-tints';
import { Icon } from '../app/ui';
import { colorsFor, demoHousehold, demoProfile } from '../../lib/v16/demo';
import { STORAGE_KEY, agreedParts, mondayOf, seed, type Part, type V16State } from '../../lib/v16/model';
import Cleaning from './Cleaning';
import Meeting, { CheckIn, PlanSummary } from './Meeting';
import Plans from './Plans';
import Today from './Today';
import TodayV18 from '../v18/TodayV18';
import TodayV19 from '../v19/TodayV19';
import { SCENARIOS_V19, seedV19, type ScenarioV19 } from '../../lib/v19/scenarios';
import { undoFeedback } from '../../lib/v19/resolve';
import { SCENARIOS_V20, seedV20, type ScenarioV20 } from '../../lib/v20/scenarios';
import { prefsFor, type NotifyPrefs } from '../../lib/v20/notify';
import Phones, { useOutbox } from '../v20/Phones';
import { SCENARIOS, demoToday, seedScenario, type ScenarioId } from '../../lib/v18/scenarios';
import { allMemory, forget } from '../../lib/v18/memory';
import { memoryLine, snapshot } from '../../lib/v18/engine';
import { Art, Illo, Person, TAB_OF, type Ctx, type Look, type Route } from './shared';

const ROUTES: Route[] = ['today', 'plans', 'cleaning', 'resources', 'account', 'meeting', 'check-in', 'plan'];
const readRoute = (): Route => { const r = location.hash.replace(/^#\/?/, '') as Route; return ROUTES.includes(r) ? r : 'today'; };

function load(today: string, key: string, gen: 0 | 18 | 19 | 20): V16State {
  try {
    const raw = localStorage.getItem(key);
    if (raw) { const s = JSON.parse(raw) as V16State & { savedMonday?: string }; if (s.v === 1 && s.savedMonday === mondayOf(today) && (!gen || s.intel)) return s; }
  } catch { /* fresh */ }
  if (gen === 20) return seedV20('n-help', { club: true, monday: mondayOf(today) });
  if (gen === 19) return seedV19('change', { club: true, monday: mondayOf(today) });
  return gen === 18 ? seedScenario('field-trip', { club: true, monday: mondayOf(today) }) : seed('first', { club: true, adults: 'two', today });
}

/** The Club month's own suggestions, as proposals (never agreements), one per person who has nothing prepared. */
export function withMonthParts(s: V16State, club: ReturnType<typeof buildFamilyMeeting> | null): Part[] {
  // A month suggestion the family acted on (kept, changed, skipped, agreed) stays as they left it.
  const kept = s.parts.filter((p) => p.origin !== 'month' || p.status !== 'suggested');
  if (!club) return kept;
  const busy = new Set(kept.filter((p) => p.status !== 'skipped').map((p) => p.ownerId));
  const extra: Part[] = [];
  for (const person of club.parts.people) {
    const r = person.suggested[0];
    if (!r || busy.has(person.memberId) || extra.length >= 2) continue;
    const id = `p-month-${r.sourceId ?? person.memberId}`;
    if (kept.some((p) => p.id === id)) continue;
    extra.push({ id, origin: 'month', title: r.description, ownerId: person.memberId, finishLine: r.finished, cue: r.when, status: 'suggested',
      why: `From this month’s Club kit: ${club.theme.toLowerCase()}. ${r.connection}` });
  }
  return [...kept, ...extra];
}

/**
 * `intelligent` = V18 (docs/ios/V18_TODAY_INTELLIGENCE.md): the V17 preview with the intelligent Today. Its own demo
 * state, and "today" pinned to Thursday of this week so the preview's scenarios always land on the same day.
 */
export default function V16App({ look = 'v16', intelligent = false }: { look?: Look; intelligent?: boolean | 'v19' | 'v20' }) {
  // V16, V17, V18 and V19 keep separate demo state, so they can be compared side by side.
  const gen: 0 | 18 | 19 | 20 = intelligent === 'v20' ? 20 : intelligent === 'v19' ? 19 : intelligent ? 18 : 0;
  const storageKey = gen ? `${STORAGE_KEY}:v${gen}` : look === 'v17' ? `${STORAGE_KEY}:v17` : STORAGE_KEY;
  const today = useMemo(() => (intelligent ? demoToday(mondayOf(localToday())) : localToday()), [intelligent]);
  const monday = mondayOf(today);
  const [s, setS] = useState<V16State | null>(null);
  const [route, setRoute] = useState<Route>('today');
  // V17 primary color, switchable in the preview controls (forest green or the calendar brown). Device-only, a review aid.
  const [theme, setTheme] = useState<Theme>('brown');
  useEffect(() => { try { if (localStorage.getItem(THEME_KEY) === 'forest') setTheme('forest'); } catch { /* default */ } }, []);
  const chooseTheme = (t: Theme) => { setTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ } };
  useEffect(() => { setS(load(today, storageKey, gen)); setRoute(readRoute()); }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => setRoute(readRoute());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (s) try { localStorage.setItem(storageKey, JSON.stringify({ ...s, savedMonday: monday })); } catch { /* private mode */ } }, [s, monday]);
  // This month's approved calendar color, as AppLayout sets it for /app.
  useEffect(() => {
    const t = monthTints(new Date().getMonth()), r = document.documentElement.style;
    r.setProperty('--of-month', t.base); r.setProperty('--of-month-wash', t.weeks[0]); r.setProperty('--of-month-accent', t.accent);
  }, []);

  const set = useCallback((f: (s: V16State) => V16State) => setS((prev) => (prev ? f(prev) : prev)), []);
  const go = useCallback((r: Route) => { if (location.hash !== `#/${r}`) location.hash = `/${r}`; setRoute(r); window.scrollTo({ top: 0 }); }, []);

  const household = useMemo(() => demoHousehold(s?.adults ?? 'two'), [s?.adults]);
  const profile = useMemo(() => demoProfile(), []);
  const club = useMemo(() => (s?.club ? buildFamilyMeeting({ household, profile, month: today.slice(0, 7) }) : null), [s?.club, household, profile, today]);
  // Keep the Club month's proposals in step with entitlement (agreed ones stay: an agreement is the family's).
  useEffect(() => { if (s) { const next = withMonthParts(s, club); if (next.length !== s.parts.length || next.some((p, i) => p !== s.parts[i])) set((x) => ({ ...x, parts: withMonthParts(x, club) })); } }, [club, s?.parts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // V18: finishing a meeting (or a check-in) is the new "what we planned": changes are measured against it from then on.
  const planned = s?.meeting.finishedOn ?? '';
  useEffect(() => {
    if (!s?.intel || !planned || (s.intel.baseline && s.intel.baseline.taken >= planned)) return;
    set((x) => (x.intel ? { ...x, intel: { ...x.intel, baseline: snapshot(x, monday, planned) } } : x));
  }, [planned]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <div className="v16" aria-busy="true" />;
  const people = household.members.filter((m) => !m.archived);
  const ctx: Ctx = {
    look, gen: gen || undefined, s, set, today, monday, household, colors: colorsFor(household), names: Object.fromEntries(people.map((m) => [m.id, m.firstName])),
    people, kids: new Set(people.filter((m) => m.kind === 'child').map((m) => m.id)), club, go,
  };
  const tab = TAB_OF[route];
  const openMeetingTab = () => {
    if (s.meeting.started) return go('meeting');
    if (s.scenario === 'week4' && !s.meeting.checkInDone) return go('check-in');
    if (s.meeting.finishedOn === today || s.meeting.checkInDone) return go('plan');
    return go('meeting');
  };
  const tabs = [
    { id: 'today' as const, label: 'Today', icon: 'home' as const, on: () => go('today') },
    { id: 'meeting' as const, label: 'Family Meeting', icon: 'meeting' as const, on: openMeetingTab },
  ];
  return (
    <div className={`v16 family-brand${look === 'v17' ? ' v17' : ''}${intelligent ? ' v18' : ''}`} data-look={gen ? `v${gen}` : look} data-theme={look === 'v17' ? theme : undefined} data-v16 data-route={route} data-scenario={s.scenario}>
      {gen === 19 || gen === 20 ? <DemoBarV19 ctx={ctx} theme={{ value: theme, set: chooseTheme }} /> : intelligent ? <DemoBarV18 ctx={ctx} theme={{ value: theme, set: chooseTheme }} /> : <DemoBar ctx={ctx} theme={look === 'v17' ? { value: theme, set: chooseTheme } : null} />}
      <header className="v16-header">
        <div className="v16-header-inner">
          <button type="button" className="v16-wordmark" onClick={() => go('today')} aria-label="Organized Family, Today">organized<em>family.</em></button>
          <nav className="v16-topnav" aria-label="Organized Family">
            {tabs.map((t) => <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={t.on}>{look === 'v17' ? <Art name={t.id === 'today' ? 'house' : 'people'} size="sm" /> : <Icon name={t.icon} size={19} />}{t.label}</button>)}
          </nav>
          <button type="button" className="v16-iconbtn" aria-label="Account and settings" onClick={() => go('account')} data-account>{look === 'v17' ? <Art name="person" size="sm" /> : <Icon name="person" />}</button>
        </div>
      </header>
      <main className="v16-main" id="main">
        {/* Keyed by screen (and meeting part) so each one enters with a short transition in V17. */}
        <div className="v16-route" key={route === 'meeting' ? `meeting-${s.meeting.step}` : route}>
        {route === 'today' && (gen === 19 || gen === 20 ? <TodayV19 ctx={ctx} /> : intelligent ? <TodayV18 ctx={ctx} /> : <Today ctx={ctx} />)}
        {route === 'plans' && <Plans ctx={ctx} />}
        {route === 'cleaning' && <Cleaning ctx={ctx} />}
        {route === 'resources' && <Resources ctx={ctx} />}
        {route === 'account' && <Account ctx={ctx} />}
        {route === 'meeting' && <Meeting ctx={ctx} />}
        {route === 'check-in' && <CheckIn ctx={ctx} />}
        {route === 'plan' && <PlanSummary ctx={ctx} />}
        </div>
      </main>
      <nav className="v16-tabbar" aria-label="App navigation">
        <ul>{tabs.map((t) => <li key={t.id}><button type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={t.on} data-tab={t.id}>{look === 'v17' ? <Art name={t.id === 'today' ? 'house' : 'people'} /> : <Icon name={t.icon} size={22} />}{t.label}</button></li>)}</ul>
      </nav>
    </div>
  );
}

type Theme = 'forest' | 'brown';
const THEME_KEY = 'omc:v17-theme';

function DemoBar({ ctx, theme }: { ctx: Ctx; theme: { value: Theme; set: (t: Theme) => void } | null }) {
  const s = ctx.s;
  const reseed = (patch: Partial<Pick<V16State, 'scenario' | 'club' | 'adults'>>) => {
    const next = { scenario: s.scenario, club: s.club, adults: s.adults, ...patch };
    ctx.set(() => seed(next.scenario, { club: next.club, adults: next.adults, today: ctx.today }));
    ctx.go('today');
  };
  return (
    <details className="v16-demo" aria-label="Preview controls (not part of the app)" data-demo-bar>
      <summary className="v16-demo-inner cursor-pointer list-none"><span className="v16-demo-tag">Preview controls · not in the app</span>
        <span className="text-[0.74rem]">{s.scenario === 'first' ? 'First week' : 'Week four'} · {s.club ? 'Club' : 'Free'} · {s.adults === 'two' ? 'Two adults' : 'One adult'}{s.soccer !== 'as-planned' ? ` · soccer ${s.soccer}` : ''}{s.online ? '' : ' · offline'}{theme ? ` · ${theme.value === 'brown' ? 'Brown' : 'Forest green'}` : ''}</span>
        <span className="ml-auto text-[0.74rem] underline">Change</span></summary>
      <div className="v16-demo-inner">
        {theme && <label>Primary color <select value={theme.value} onChange={(e) => theme.set(e.target.value as Theme)} data-demo-theme>
          <option value="brown">Calendar brown</option><option value="forest">Forest green</option></select></label>}
        <label>Scenario <select value={s.scenario} onChange={(e) => reseed({ scenario: e.target.value as V16State['scenario'] })} data-demo-scenario>
          <option value="first">First week</option><option value="week4">Week four</option></select></label>
        <label>Plan <select value={s.club ? 'club' : 'free'} onChange={(e) => ctx.set((x) => ({ ...x, club: e.target.value === 'club' }))} data-demo-plan>
          <option value="club">Club member</option><option value="free">Free</option></select></label>
        <label>Adults <select value={s.adults} onChange={(e) => reseed({ adults: e.target.value as V16State['adults'] })} data-demo-adults>
          <option value="two">Two (Ana, Luis)</option><option value="one">One (Ana)</option></select></label>
        <label>Soccer this week <select value={s.soccer} onChange={(e) => ctx.set((x) => ({ ...x, soccer: e.target.value as V16State['soccer'] }))} data-demo-soccer>
          <option value="as-planned">As planned</option><option value="moved">Moved to Friday</option><option value="cancelled">Cancelled</option></select></label>
        <label><input type="checkbox" checked={!s.online} onChange={(e) => ctx.set((x) => ({ ...x, online: !e.target.checked, parts: e.target.checked ? x.parts : x.parts.map((p) => ({ ...p, pending: false })) }))} data-demo-offline /> Offline</label>
        <button type="button" onClick={() => reseed({})} data-demo-reset>Reset</button>
      </div>
    </details>
  );
}

/** V19 reviewer controls: SIMULATED demonstration facts for Today. Not product UI, never in the app. */
function DemoBarV19({ ctx, theme }: { ctx: Ctx; theme: { value: Theme; set: (t: Theme) => void } }) {
  const s = ctx.s;
  const intel = s.intel!;
  const v20 = ctx.gen === 20;
  const list = v20 ? SCENARIOS_V20 : SCENARIOS_V19;
  const scenario = (intel.scenario ?? (v20 ? 'n-help' : 'change')) as ScenarioV19;
  const reseed = (id: string) => { ctx.set(() => (v20 ? seedV20(id as ScenarioV20, { club: s.club, monday: ctx.monday }) : seedV19(id as ScenarioV19, { club: s.club, monday: ctx.monday }))); ctx.go('today'); };
  const pushes = v20 ? <PushCount ctx={ctx} /> : null;
  const setIntel = (patch: Partial<typeof intel>) => ctx.set((x) => ({ ...x, intel: { ...x.intel!, ...patch } }));
  return (
    <details className="v16-demo" aria-label="Preview controls (not part of the app)" data-demo-bar>
      <summary className="v16-demo-inner cursor-pointer list-none"><span className="v16-demo-tag">Preview controls · simulated data</span>
        <span className="text-[0.74rem]">{list.find(([id]) => id === scenario)?.[1]}{pushes} · viewing as {ctx.names[intel.viewer] ?? 'Ana'}{intel.aiAvailable ? '' : ' · interpreter down'} · demo day Thursday</span>
        <span className="ml-auto text-[0.74rem] underline">Change</span></summary>
      <div className="v16-demo-inner">
        <label>Scenario <select value={scenario} onChange={(e) => reseed(e.target.value)} data-demo-v19>
          {list.map(([id, label], n) => <option key={id} value={id}>{n + 1}. {label}</option>)}</select></label>
        {v20 && <label>Time <select value={intel.clock ?? '14:30'} onChange={(e) => setIntel({ clock: e.target.value })} data-demo-clock>
          {['07:30', '13:30', '14:30', '18:00', '21:45'].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
        <label>Viewing as <select value={intel.viewer} onChange={(e) => setIntel({ viewer: e.target.value })} data-demo-viewer>
          {ctx.people.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}</select></label>
        <label><input type="checkbox" checked={intel.aiAvailable} onChange={(e) => setIntel({ aiAvailable: e.target.checked })} data-demo-ai /> Interpreter available (simulated)</label>
        <label>Primary color <select value={theme.value} onChange={(e) => theme.set(e.target.value as Theme)} data-demo-theme>
          <option value="brown">Calendar brown</option><option value="forest">Forest green</option></select></label>
        <label><input type="checkbox" checked={!s.online} onChange={(e) => ctx.set((x) => ({ ...x, online: !e.target.checked, parts: e.target.checked ? x.parts : x.parts.map((p) => ({ ...p, pending: false })) }))} data-demo-offline /> Offline</label>
        <button type="button" onClick={() => reseed(scenario)} data-demo-reset>Reset</button>
      </div>
      {v20 && <div className="v16-demo-inner !block"><p className="v16-demo-tag mb-2">Simulated push · both phones share one household plan</p><Phones ctx={ctx} /></div>}
    </details>
  );
}

function PushCount({ ctx }: { ctx: Ctx }) {
  const { notes } = useOutbox(ctx);
  const n = notes.filter((x) => x.status === 'deliver' || x.status === 'sent' || x.status === 'quiet').length;
  return <>{` · ${n} push${n === 1 ? '' : 'es'}`}</>;
}

/** V18 reviewer controls: SIMULATED demonstration states for Today. Not product UI, never in the app. */
function DemoBarV18({ ctx, theme }: { ctx: Ctx; theme: { value: Theme; set: (t: Theme) => void } }) {
  const s = ctx.s;
  const intel = s.intel!;
  const scenario = (intel.scenario ?? 'field-trip') as ScenarioId;
  const reseed = (id: ScenarioId) => { ctx.set(() => seedScenario(id, { club: s.club, monday: ctx.monday })); ctx.go('today'); };
  const setIntel = (patch: Partial<typeof intel>) => ctx.set((x) => ({ ...x, intel: { ...x.intel!, ...patch } }));
  return (
    <details className="v16-demo" aria-label="Preview controls (not part of the app)" data-demo-bar>
      <summary className="v16-demo-inner cursor-pointer list-none"><span className="v16-demo-tag">Preview controls · simulated data</span>
        <span className="text-[0.74rem]">{SCENARIOS.find(([id]) => id === scenario)?.[1]} · viewing as {ctx.names[intel.viewer] ?? 'Ana'}{intel.aiAvailable ? '' : ' · interpreter down'} · demo day Thursday</span>
        <span className="ml-auto text-[0.74rem] underline">Change</span></summary>
      <div className="v16-demo-inner">
        <label>Today scenario <select value={scenario} onChange={(e) => reseed(e.target.value as ScenarioId)} data-demo-v18>
          {SCENARIOS.map(([id, label], n) => <option key={id} value={id}>{n + 1}. {label}</option>)}</select></label>
        <label>Viewing as <select value={intel.viewer} onChange={(e) => setIntel({ viewer: e.target.value })} data-demo-viewer>
          {ctx.people.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}</select></label>
        <label><input type="checkbox" checked={intel.aiAvailable} onChange={(e) => setIntel({ aiAvailable: e.target.checked })} data-demo-ai /> Interpreter available (simulated)</label>
        <label>Primary color <select value={theme.value} onChange={(e) => theme.set(e.target.value as Theme)} data-demo-theme>
          <option value="brown">Calendar brown</option><option value="forest">Forest green</option></select></label>
        <label>Plan <select value={s.club ? 'club' : 'free'} onChange={(e) => ctx.set((x) => ({ ...x, club: e.target.value === 'club' }))} data-demo-plan>
          <option value="club">Club member</option><option value="free">Free</option></select></label>
        <label><input type="checkbox" checked={!s.online} onChange={(e) => ctx.set((x) => ({ ...x, online: !e.target.checked, parts: e.target.checked ? x.parts : x.parts.map((p) => ({ ...p, pending: false })) }))} data-demo-offline /> Offline</label>
        <button type="button" onClick={() => reseed(scenario)} data-demo-reset>Reset</button>
      </div>
    </details>
  );
}

function Resources({ ctx }: { ctx: Ctx }) {
  const month = ctx.today.slice(5, 7);
  return (
    <section data-screen="resources">
      <h1 className="v16-h1 pt-2">Resources</h1>
      <p className="v16-lede">Your family, who does what, and {ctx.club ? 'this month’s Club kit' : 'guides'}.</p>
      {ctx.club && (
        <div className="v16-card v16-card--month" data-club-month>
          {ctx.look === 'v17' && <Illo name="book-stack" size="lg" />}
          <p className="v16-eyebrow !text-[color:var(--of-month-accent)]">This month · Family Meeting Club</p>
          <p className="v16-card-title mt-1">{ctx.club.resourceTitle}</p>
          <p className="mt-1 text-[0.9rem]">{ctx.club.focus.challenge}</p>
          <p className="v16-meta mt-2">The month’s printables and tools open in the current app: <a className="underline" href={`/app/club/${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][+month - 1]}`}>this month’s Club page</a>.</p>
        </div>
      )}
      <div className="v16-section">
        <h2 className="v16-h3">Our family</h2>
        <ul className="v16-rows">{ctx.people.map((m) => (
          <li key={m.id} className="v16-row"><Person ctx={ctx} id={m.id} size="md" /><span className="v16-row-main"><span className="v16-row-title block">{m.firstName}</span><span className="v16-meta">{m.kind === 'adult' ? 'Adult' : 'Child'} · {ctx.colors[m.id]?.label} on every calendar and printable</span></span></li>
        ))}</ul>
        <p className="v16-meta mt-2">Colors are saved per person and never change with the month.</p>
      </div>
      <div className="v16-section">
        <h2 className="v16-h3">Who does what</h2>
        <ul className="v16-rows">{agreedParts(ctx.s).map((p) => (
          <li key={p.id} className="v16-row"><Person ctx={ctx} id={p.ownerId} /><span className="v16-row-main">{ctx.names[p.ownerId!]} · {p.title}</span></li>
        ))}{!agreedParts(ctx.s).length && <li className="v16-meta py-3">Nothing agreed yet.</li>}</ul>
      </div>
      <p className="v16-meta mt-6">In the current app this is <a className="underline" href="/app/family">Family &amp; resources</a> (sharing, setup and the Club’s months).</p>
      <button type="button" className="of-btn of-btn--soft of-btn--block mt-5" onClick={() => ctx.go('today')}>Back to Today</button>
    </section>
  );
}

function Account({ ctx }: { ctx: Ctx }) {
  const adults = ctx.people.filter((m) => m.kind === 'adult');
  return (
    <section data-screen="account">
      <h1 className="v16-h1 pt-2">Account</h1>
      <p className="v16-lede">Signed in as Ana (sample). {adults.length > 1 ? `${adults.map((a) => a.firstName).join(' and ')} share this family’s plan as equals.` : 'One adult runs this family’s plan; nothing waits on a second account.'}</p>
      <ul className="v16-rows mt-4">
        <li className="v16-row">{ctx.look === 'v17' && <Art name="people" tile="blue" />}<span className="v16-row-main">Family plan</span><span className="v16-meta">{ctx.s.club ? 'Family Meeting Club' : 'Free'}</span></li>
        <li className="v16-row">{ctx.look === 'v17' && <Art name="sync" tile="sage" />}<span className="v16-row-main">Sync</span><span className="v16-meta">{ctx.s.online ? 'Up to date' : 'Offline · changes wait on this phone'}</span></li>
      </ul>
      {ctx.gen === 20 && <Notifications ctx={ctx} />}
      {(ctx.gen === 19 || ctx.gen === 20) && <Assistance ctx={ctx} />}
      {ctx.s.intel && <Noticed ctx={ctx} />}
      <p className="v16-meta mt-4">Preview only. The real account, sharing, billing and sign-in are at <a className="underline" href="/app/account">/app/account</a>; nothing here changes them.</p>
      <button type="button" className="of-btn of-btn--soft of-btn--block mt-5" onClick={() => ctx.go('today')}>Back to Today</button>
    </section>
  );
}

/** V18 household memory, always correctable: what the family told us, and what the app noticed (never assumed). */
export function Noticed({ ctx }: { ctx: Ctx }) {
  const mem = allMemory(ctx.s.intel!.memory);
  return (
    <div className="v16-section" data-noticed>
      <h2 className="v16-h3">What we’ve learned about your family</h2>
      {!mem.length && <p className="v16-meta mt-1">Nothing yet. Patterns show up only after they’ve happened a few times.</p>}
      <ul className="v16-rows">{mem.map((m) => (
        <li key={m.id} className="v16-row" data-memory={m.kind}>
          <span className="v16-row-main"><span className="block">{memoryLine(m, ctx.names)}</span><span className="v16-meta">{m.kind === 'confirmed' ? 'You told us' : 'Noticed, not confirmed'} · {m.eventKind.replace('-', ' ')}</span></span>
          <button type="button" className="v16-link" onClick={() => ctx.set((s) => ({ ...s, intel: { ...s.intel!, memory: forget(s.intel!.memory, m.id, ctx.today) } }))} data-forget>Forget</button>
        </li>
      ))}</ul>
    </div>
  );
}

/** V19: how much Today brings up, in the family's own words. One simple choice; the rest is learned and correctable. */
export function Assistance({ ctx }: { ctx: Ctx }) {
  const intel = ctx.s.intel!;
  const never = (intel.feedback ?? []).filter((f) => f.kind === 'never' || f.kind === 'not-relevant');
  return (
    <div className="v16-section" data-assistance>
      <h2 className="v16-h3">Heads-ups on Today</h2>
      <label className="v16-field mt-2">How much should Today bring up?
        <select className="v16-input" value={intel.assistance ?? 'standard'} onChange={(e) => ctx.set((s) => ({ ...s, intel: { ...s.intel!, assistance: e.target.value as 'fewer' | 'standard' | 'more' } }))} data-assistance-select>
          <option value="fewer">Only when something changes</option>
          <option value="standard">The usual</option>
          <option value="more">Help us get ahead earlier</option>
        </select>
      </label>
      {never.length > 0 && <ul className="v16-rows mt-2">{never.map((f) => (
        <li key={`${f.key}${f.kind}`} className="v16-row" data-never={f.pattern}>
          <span className="v16-row-main"><span className="block">{f.kind === 'never' ? 'Don’t suggest' : 'Not relevant'}: {f.pattern.split(':').slice(1).join(' ').replace(/-/g, ' ')}</span><span className="v16-meta">Since {f.on}</span></span>
          <button type="button" className="v16-link" onClick={() => ctx.set((s) => undoFeedback(s, f))} data-undo>Undo</button>
        </li>
      ))}</ul>}
    </div>
  );
}

/**
 * V20: notification settings, per adult, in Account (no new screen). Three purposes on by default, the Family Meeting
 * reminder off by default, quiet hours. There is no setting for chore or cleaning reminders because there are none.
 */
export function Notifications({ ctx }: { ctx: Ctx }) {
  const viewer = ctx.s.intel!.viewer;
  const p = prefsFor(ctx.s, viewer);
  const set = (patch: Partial<NotifyPrefs>) => ctx.set((s) => ({ ...s, intel: { ...s.intel!, notifyPrefs: { ...(s.intel!.notifyPrefs ?? {}), [viewer]: { ...(s.intel!.notifyPrefs?.[viewer] ?? {}), ...patch } } } }));
  const rows: [keyof NotifyPrefs, string, string][] = [
    ['needsYou', 'Someone needs you', 'A request for a hand, or something that needs an owner.'],
    ['changed', 'Something important changed', 'A conflict in your plan today, or a shared agreement someone updated.'],
    ['handled', 'Something you were carrying is handled', 'When someone takes what you asked for.'],
    ['meeting', 'Family Meeting reminder', 'An hour before your meeting.'],
  ];
  return (
    <div className="v16-section" data-notifications>
      <h2 className="v16-h3">Notifications</h2>
      <p className="v16-meta mt-1">Only when it matters. Never chore or cleaning reminders.</p>
      <ul className="v16-rows mt-2">{rows.map(([k, label, hint]) => (
        <li key={k} className="v16-row">
          <label className="v16-row-main flex items-center justify-between gap-3">
            <span><span className="block">{label}</span><span className="v16-meta">{hint}</span></span>
            <input type="checkbox" className="v20-switch" checked={Boolean(p[k])} onChange={(e) => set({ [k]: e.target.checked })} data-notify={k} />
          </label>
        </li>
      ))}</ul>
      <label className="v16-field mt-3">Quiet hours
        <select className="v16-input" value={`${p.quietStart}-${p.quietEnd}`} onChange={(e) => { const [quietStart, quietEnd] = e.target.value.split('-'); set({ quietStart, quietEnd }); }} data-quiet>
          <option value="21:00-07:00">9 PM – 7 AM</option><option value="22:00-06:30">10 PM – 6:30 AM</option><option value="20:00-07:30">8 PM – 7:30 AM</option>
        </select>
      </label>
    </div>
  );
}
