/**
 * V21 preview (docs/ios/V21_PREVIEW.md): an unlinked, noindex review build at /preview/organized-family-v21.
 * The V20 app with the V21 refinements, on a fictional household, in this browser only (localStorage
 * omc:v21-preview:v1). It never reads or writes /app data.
 *
 * Reviewer tools sit OUTSIDE the phone frame and are not product UI: whose phone you're looking at (Meg or Mark: both
 * read and write one shared household state, as two real devices would through the household document), the sixteen
 * scenarios, "Reset demo", and the widget state a future native widget would read (a concept, not a widget).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildFamilyMeeting } from '../../lib/club/family-meeting';
import { localToday } from '../../lib/calendar/recurrence';
import { monthTints } from '../../lib/club/month-tints';
import { mondayOf, type V16State } from '../../lib/v16/model';
import { answer, intelOf } from '../../lib/v21/model';
import { buildTodayV21, widgetFor } from '../../lib/v21/today';
import { MEG, SCENARIOS_V21, TOGETHER, colorsV21, demoTodayV21, householdV21, profileV21, seedV21, type ScenarioV21 } from '../../lib/v21/household';
import Cleaning from '../v16/Cleaning';
import Meeting, { CheckIn, PlanSummary } from '../v16/Meeting';
import Plans from '../v16/Plans';
import { Account, Resources, withMonthParts } from '../v16/V16App';
import { Art, TAB_OF, type Ctx, type Route } from '../v16/shared';
import { enginePeople } from '../v18/TodayV18';
import TodayV21 from './TodayV21';

const KEY = 'omc:v21-preview:v1';
const ROUTES: Route[] = ['today', 'plans', 'cleaning', 'resources', 'account', 'meeting', 'check-in', 'plan'];
const readRoute = (): Route => { const r = location.hash.replace(/^#\/?/, '') as Route; return ROUTES.includes(r) ? r : 'today'; };

function load(monday: string): V16State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as V16State & { savedMonday?: string }; if (s.v === 1 && s.savedMonday === monday && s.intel) return s; }
  } catch { /* fresh */ }
  return seedV21('week', monday);
}

export default function V21App() {
  const monday = useMemo(() => mondayOf(localToday()), []);
  const [s, setS] = useState<V16State | null>(null);
  const [route, setRoute] = useState<Route>('today');
  useEffect(() => { setS(load(monday)); setRoute(readRoute()); }, [monday]);
  useEffect(() => { const on = () => setRoute(readRoute()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  useEffect(() => { if (s) try { localStorage.setItem(KEY, JSON.stringify({ ...s, savedMonday: monday })); } catch { /* private mode */ } }, [s, monday]);
  useEffect(() => {
    const t = monthTints(new Date().getMonth()), r = document.documentElement.style;
    r.setProperty('--of-month', t.base); r.setProperty('--of-month-wash', t.weeks[0]); r.setProperty('--of-month-accent', t.accent);
  }, []);
  const set = useCallback((f: (s: V16State) => V16State) => setS((prev) => (prev ? f(prev) : prev)), []);
  const go = useCallback((r: Route) => { if (location.hash !== `#/${r}`) location.hash = `/${r}`; setRoute(r); document.querySelector('.v21-phone')?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); }, []);

  const household = useMemo(() => householdV21(), []);
  const profile = useMemo(() => profileV21(), []);
  const today = s ? demoTodayV21(monday, intelOf(s).demoDay ?? 5) : demoTodayV21(monday);
  const club = useMemo(() => (s?.club ? buildFamilyMeeting({ household, profile, month: today.slice(0, 7) }) : null), [s?.club, household, profile, today]);
  useEffect(() => { if (s) { const next = withMonthParts(s, club); if (next.length !== s.parts.length || next.some((p, i) => p !== s.parts[i])) set((x) => ({ ...x, parts: withMonthParts(x, club) })); } }, [club, s?.parts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <div className="v16 v21-stage" aria-busy="true" />;
  const people = household.members.filter((m) => !m.archived);
  const names: Record<string, string> = { ...Object.fromEntries(people.map((m) => [m.id, m.firstName])), [TOGETHER]: 'Together' };
  const ctx: Ctx = { look: 'v17', gen: 21, s, set, today, monday, household, colors: colorsV21(household), names, people,
    kids: new Set(people.filter((m) => m.kind === 'child').map((m) => m.id)), club, go };
  const viewer = intelOf(s).viewer;
  const tab = TAB_OF[route];
  const openMeeting = () => {
    if (s.meeting.started) return go('meeting');
    if (s.meeting.finishedOn === today) return go('plan');
    return go('meeting');
  };
  const reseed = (id: ScenarioV21) => { set(() => seedV21(id, monday)); go('today'); };
  const scenario = (intelOf(s).scenario ?? 'week') as ScenarioV21;
  return (
    <div className="v21-stage" data-v21-stage>
      <div className="v21-review" aria-label="Preview controls (not part of the app)" data-review>
        <div className="v21-viewers" role="group" aria-label="Whose phone">
          {people.filter((m) => m.kind === 'adult').map((m) => (
            <button key={m.id} type="button" aria-pressed={viewer === m.id} onClick={() => set((x) => ({ ...x, intel: { ...x.intel!, viewer: m.id } }))} data-viewer={m.id}>{m.firstName}</button>
          ))}
        </div>
        <label className="v21-scenario"><span className="sr-only">Scenario</span>
          <select value={scenario} onChange={(e) => reseed(e.target.value as ScenarioV21)} data-scenario-select>
            {SCENARIOS_V21.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className={`v16 family-brand v17 v18 v21 v21-phone`} data-look="v21" data-theme="brown" data-v16 data-route={route} data-scenario={scenario}>
        <header className="v16-header">
          <div className="v16-header-inner">
            <button type="button" className="v21-wordmark" onClick={() => go('today')} aria-label="Organized Family, Today">organized<em>family.</em></button>
            <button type="button" className="v21-avatar" aria-label="Account and settings" onClick={() => go('account')} data-account>{names[viewer]?.charAt(0) ?? '·'}</button>
          </div>
        </header>
        <main className="v16-main" id="main">
          <div className="v16-route" key={`${scenario}:${route === 'meeting' ? `meeting-${s.meeting.step}` : route}`}>
            {route === 'today' && <TodayV21 ctx={ctx} />}
            {route === 'plans' && <Plans ctx={ctx} />}
            {route === 'cleaning' && <Cleaning ctx={ctx} />}
            {route === 'resources' && <Resources ctx={ctx} />}
            {route === 'account' && <Account ctx={ctx} />}
            {route === 'meeting' && <Meeting ctx={ctx} />}
            {route === 'check-in' && <CheckIn ctx={ctx} />}
            {route === 'plan' && <PlanSummary ctx={ctx} />}
          </div>
        </main>
        <nav className="v16-tabbar v21-tabbar" aria-label="App navigation">
          <ul>
            <li><button type="button" aria-current={tab === 'today' ? 'page' : undefined} onClick={() => go('today')} data-tab="today"><Art name="house" />Today</button></li>
            <li><button type="button" aria-current={tab === 'meeting' ? 'page' : undefined} onClick={openMeeting} data-tab="meeting"><Art name="people" />Family Meeting</button></li>
          </ul>
        </nav>
      </div>

      <WidgetConcept ctx={ctx} />
      <button type="button" className="v21-reset" onClick={() => reseed(scenario)} data-reset>Reset demo</button>
    </div>
  );
}

/**
 * The state a future native Home Screen widget would read (src/lib/v21/today.ts widgetFor), for each adult. A review
 * aid ONLY: there is no widget in the website or the PWA. The buttons call the same answer() a native AppIntent would.
 */
function WidgetConcept({ ctx }: { ctx: Ctx }) {
  const people = useMemo(() => enginePeople(ctx), [ctx.people, ctx.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const adults = ctx.people.filter((m) => m.kind === 'adult');
  return (
    <section className="v21-widgets" aria-label="Widget state, concept (not a widget)" data-widget-concept>
      <p className="v21-widgets-tag">Native Home Screen widget · concept, not built · what each adult’s widget would show</p>
      <div className="v21-widgets-row">
        {adults.map((a) => {
          const s = { ...ctx.s, intel: { ...ctx.s.intel!, viewer: a.id } };
          const w = widgetFor(buildTodayV21({ s, monday: ctx.monday, today: ctx.today, people }));
          return (
            <div key={a.id} className="v21-widget" data-widget={a.id} data-widget-kind={w.kind}>
              <p className="v21-widget-who">{a.firstName}</p>
              <div className="v21-widget-card">
                <p className="v21-widget-app"><span>ORGANIZED FAMILY</span>{w.more > 0 && <span className="v21-widget-more" data-widget-more>+{w.more}</span>}</p>
                <p className="v21-widget-title">{w.title}</p>
                <p className="v21-widget-detail">{w.detail}</p>
                {w.actions.length > 0 && w.requestId && (
                  <div className="v21-widget-actions">
                    <button type="button" onClick={() => ctx.set((x) => answer(x, w.requestId!, a.id, 'accept', ctx.today).state)} data-widget-action="got-it">I’ve got it</button>
                    <button type="button" className="is-outline" onClick={() => ctx.set((x) => answer(x, w.requestId!, a.id, 'decline', ctx.today).state)} data-widget-action="not-this-time">Not this time</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


