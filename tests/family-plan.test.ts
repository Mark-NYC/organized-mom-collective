// The curated family plan (docs/ios/FAMILY_PLAN.md): chosen priorities, linked to their events, on Today and in the
// meeting; Everyone's part today kept short; "We have a plan." at the end; nothing automatic, nothing gamified.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOWN, currentPriorities, resolve, sameRef, weekOf, type Priority } from '../src/lib/app/priorities';
import { weekAhead } from '../src/lib/family-meeting-support';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';

const src = (p: string) => readFileSync(p, 'utf8');
const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({ id: 'e1', title: 'School presentation', starts_on: '2026-12-03', start_time: '09:00', end_time: '10:00', timezone: 'America/Chicago', recurrence: null, skip_dates: [], member_ids: [], owner_member_id: null, revision: 1, ...o });
const imported = (o: Partial<CalendarEvent> = {}) => ev({ id: 'ext:f:trip@family:2026-12-04', title: 'Family trip to the lake', starts_on: '2026-12-04', start_time: null, end_time: null,
  external: { feed_id: 'f', name: 'Family trips', visibility: 'household', mine: true, tentative: false, uid: 'trip@family', instance_key: '2026-12-04' }, ...o });
const pr = (o: Partial<Priority>): Priority => ({ id: Math.random().toString(36), week_of: '2026-11-30', kind: 'note', title: 'Calmer mornings', source: null, event_uid: null, instance_key: null, event_on: null, sort: 0, mine: true, ...o });
const tripP = pr({ kind: 'event', source: 'imported', event_uid: 'trip@family', instance_key: '2026-12-04', event_on: '2026-12-04', title: 'Family trip to the lake' });
const presP = pr({ kind: 'event', source: 'family', event_uid: 'e1', instance_key: '2026-12-03', event_on: '2026-12-03', title: 'School presentation' });

describe('priorities are deliberate, linked and honest', () => {
  it('weeks start on Monday', () => {
    expect(weekOf('2026-12-02')).toBe('2026-11-30');
    expect(weekOf('2026-11-30')).toBe('2026-11-30');
    expect(weekOf('2026-12-06')).toBe('2026-11-30');
  });
  it('the week ahead carries each event\'s link (family event + date, or imported UID + occurrence), so it can be highlighted', () => {
    const w = weekAhead([ev({ starts_on: '2026-12-01' }), imported({ starts_on: '2026-12-02', external: { ...imported().external!, instance_key: '2026-12-02' } })], '2026-12-01', new Date('2026-12-01T12:00:00'));
    const refs = w.days.flatMap((d) => d.items.map((i) => i.ref));
    expect(refs).toContainEqual({ source: 'family', event_uid: 'e1', instance_key: '2026-12-01' });
    expect(refs).toContainEqual({ source: 'imported', event_uid: 'trip@family', instance_key: '2026-12-02' });
    expect(sameRef(presP, { source: 'family', event_uid: 'e1', instance_key: '2026-12-03' })).toBe(true);
  });
  it('a priority shows its event as it is NOW: moved, renamed; cancelled says so instead of going stale', () => {
    expect(resolve(presP, [ev({ title: 'Science presentation', start_time: '10:00', end_time: '11:00' })])).toMatchObject({ title: 'Science presentation', date: '2026-12-03', gone: false });
    expect(resolve(tripP, [imported({ starts_on: '2026-12-05', title: 'Lake trip (moved)' })])).toMatchObject({ title: 'Lake trip (moved)', date: '2026-12-05', gone: false });
    expect(resolve(tripP, [])).toMatchObject({ title: 'Family trip to the lake', gone: true });
    expect(resolve(presP, [ev({ deleted: true } as Partial<CalendarEvent>)]).gone).toBe(true);
  });
  it('Today: this week\'s, in the family\'s order; passed events drop off; notes stay', () => {
    const r = currentPriorities([pr({ sort: 2 }), { ...tripP, sort: 1 }, { ...presP, sort: 0 }], [ev({}), imported()], '2026-12-04');
    expect(r.from).toBe('this-week');
    expect(r.list.map((x) => x.title)).toEqual(['Family trip to the lake', 'Calmer mornings']); // the presentation (Thursday) has passed
  });
  it('a missed meeting: last meeting\'s priorities, labeled as such, for two weeks; then nothing (no guilt, no backlog)', () => {
    const last = [pr({ week_of: '2026-11-30', title: 'Calmer mornings' })];
    expect(currentPriorities(last, [], '2026-12-08')).toMatchObject({ from: 'last-meeting' });
    expect(currentPriorities(last, [], '2026-12-29')).toEqual({ list: [], from: null });
    expect(currentPriorities([], [], '2026-12-08')).toEqual({ list: [], from: null });
  });
  it('about three: the app shows three', () => expect(SHOWN).toBe(3));
  it('privacy: an imported event the other adult can no longer see is hidden from them (never a stale title); the chooser still sees it', () => {
    const theirs = { ...tripP, mine: false };
    expect(currentPriorities([theirs], [], '2026-12-01').list).toEqual([]);
    expect(currentPriorities([tripP], [], '2026-12-01').list.map((r) => [r.title, r.gone])).toEqual([['Family trip to the lake', true]]);
    // A family event that was deleted is the household's own: both adults see that it's gone.
    expect(currentPriorities([{ ...presP, mine: false }], [], '2026-12-01').list.map((r) => r.gone)).toEqual([true]);
  });
});

describe('the priority rule: three is normal, five is the most, in words', async () => {
  const { priorityRule, reviewItems } = await import('../src/components/ourweek/MeetingPlan');
  it('0–2: room, nothing to say; 3–4: room, a gentle note; 5: no room, how to make some', () => {
    expect(priorityRule(0)).toEqual({ canAdd: true, note: null });
    expect(priorityRule(2)).toEqual({ canAdd: true, note: null });
    expect(priorityRule(3)).toEqual({ canAdd: true, note: 'Three is usually plenty. A busy week can hold up to five.' });
    expect(priorityRule(4).canAdd).toBe(true);
    expect(priorityRule(5)).toEqual({ canAdd: false, note: 'That’s 5, the most for one week. Remove one to choose another.' });
  });
  it('no disabled Highlight buttons: a chosen one can always be removed, a new one appears only while there is room', () => {
    const plan = src('src/components/ourweek/MeetingPlan.tsx');
    expect(plan).toMatch(/\{priorities\?\.available && \(picked \|\| rule\.canAdd\) && \(/);
    expect(plan).not.toMatch(/disabled=\{busy !== null \|\| \(!picked/);
  });
  it('the week review shows each event once (a daily event is one line), so a family isn\'t scrolling dozens', () => {
    const days = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
    const school = ev({ id: 'school', title: 'School', starts_on: '2026-11-30', recurrence: { freq: 'daily' } as CalendarEvent['recurrence'] });
    const w = weekAhead([school, ev({})], '2026-11-30', new Date('2026-11-30T06:00:00'));
    const items = reviewItems(w);
    expect(items.map((x) => [x.item.title, x.more])).toEqual([['School', 6], ['School presentation', 0]]);
    void days;
  });
});

describe('sign-out: the household\'s fetched copies leave the device', () => {
  it('priorities, event responsibilities and imported calendar events are cleared at sign-out', () => {
    const acc = src('src/lib/account.ts');
    expect(acc).toMatch(/for \(const k of HOUSEHOLD_CACHES\) rawRemove\(k\);/);
    for (const k of ['omc:priorities:v1', 'omc:calendar:event-tasks:v1', 'omc:calendar:feeds:v1:mine', 'omc:calendar:feeds:v1:household']) expect(acc).toContain(`'${k}'`);
    // …and each cache is tied to its household, so a different household on the same device never reads it.
    expect(src('src/lib/app/priorities.ts')).toMatch(/return c && c\.scope === scope \? c\.items : null;/);
  });
});

describe('the meeting fits the plan into its four parts', () => {
  const m = src('src/components/ourweek/WeeklyMeeting.tsx');
  const plan = src('src/components/ourweek/MeetingPlan.tsx');
  it('Our Focus: look ahead and highlight (the family chooses; nothing is automatic)', () => {
    expect(m).toMatch(/\{p\.title === 'Our Focus' && <WeekReview /);
    expect(plan).toMatch(/priorities\.highlight\(item\.ref, weekStart\)/);
    expect(plan).not.toMatch(/useEffect\([^)]*highlight/); // never highlights on its own
  });
  it('only calendars shared with the household are offered (never private ones)', () => {
    expect(m).toMatch(/useExternalCalendars\(scope && cal\.signedIn \? scope : null, 'household'\)/);
  });
  it('Everyone\'s Part: getting ready is optional, through the existing event responsibilities (no new task system)', () => {
    expect(m).toMatch(/<GettingReady current=\{plan\}/);
    expect(plan).toMatch(/<EventResponsibilities e=\{ext\} tasks=\{tasks\}/);
    expect(plan).not.toMatch(/accountRpc|insert into/);
  });
  it('the four approved parts are unchanged', () => {
    expect(src('src/data/club/meeting-guide.ts')).toMatch(/Our Focus[\s\S]*Let’s Talk[\s\S]*Everyone’s Part[\s\S]*Let’s Practice/);
  });
  it('"We have a plan.": getting-ready parts sit under their priority; then what was agreed in THIS meeting (nothing repeated)', () => {
    expect(plan).toMatch(/data-plan-prep/);
    expect(plan).toMatch(/const fresh = newIds && newIds\.size/);
    expect(m).toMatch(/<PlanSummary current=\{plan\} agreed=\{agreed\} newIds=\{newIds\}/);
  });
  it('"We have a plan.": priorities and who owns what, printable; no badges, scores, streaks or confetti', () => {
    expect(plan).toMatch(/We have a plan\./);
    expect(plan).toMatch(/window\.print\(\)/);
    expect(plan + m).not.toMatch(/confetti|badge|streak|points|score/i);
  });
});

describe('Today: a curated plan, not a household list', () => {
  const t = src('src/components/app/TodayDashboard.tsx');
  it('focus, priorities, everyone\'s part today, then the tools, in that order', () => {
    const order = ['<FocusPanel', '<OurPriorities', '<Responsibilities', 'data-today-shortcuts', '<NextMeeting'].map((x) => t.indexOf(x));
    expect(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1]))).toBe(true);
  });
  it('one standing part per person, about six rows; the full list one tap away', () => {
    expect(t).toMatch(/const standing = kidsFirst\.slice\(0, Math\.max\(3, 6 - todays\.length\)\);/);
    expect(t).toMatch(/const x = p\.parts\[p\.parts\.length - 1\];/);
    expect(t).toMatch(/href="\/app\/family\/responsibilities" className="of-tile-action mt-3" data-all-parts/);
  });
  it('priorities show only once the database has them; before a first meeting or after a missed one, a plain line', () => {
    expect(t).toMatch(/prio\.available && <OurPriorities/);
    expect(t).toMatch(/In your first Family Meeting, choose up to three/);
    expect(t).not.toMatch(/you missed|overdue|streak/i);
  });
});
