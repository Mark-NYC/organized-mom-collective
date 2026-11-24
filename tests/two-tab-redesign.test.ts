// Two-tab redesign (docs/ios/TWO_TAB_REDESIGN.md): navigation, meeting state, Today's honesty rules, invisible MAWL.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PRIMARY_TABS, tabFor } from '../src/data/app/tabs';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { dayWord, meetingState, nextScheduledMeeting, readProgress, recordFinished, recordStep, startOver, type MeetingProgress } from '../src/lib/app/meeting-progress';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';

const src = (p: string) => readFileSync(p, 'utf8');

describe('navigation: Today | Family Meeting', () => {
  it('two primary tabs, the meeting opening the meeting itself', () => {
    expect(PRIMARY_TABS.map((t) => [t.label, t.href])).toEqual([['Today', '/app'], ['Family Meeting', '/app/family/meeting']]);
  });
  it('every other screen belongs to Today (nothing is a dead end), the meeting to its tab', () => {
    expect(tabFor('/app/family/meeting')).toBe('/app/family/meeting');
    for (const p of ['/app', '/app/family-calendar', '/app/cleaning', '/app/week', '/app/family', '/app/family/responsibilities', '/app/family/setup', '/app/club', '/app/club/november', '/app/account', '/club/family']) {
      expect(tabFor(p)).toBe('/app');
    }
  });
  it('the tab bar and the wide-screen header use the same rule; the printed calendar keeps its own tabs', () => {
    expect(src('src/components/AppTabBar.astro')).toMatch(/return tabFor\(club \? '\/app\/club' : path\) === href;/);
    expect(src('src/components/AppTabBar.astro')).toMatch(/href: '\/app\/calendar\/week', label: 'Week'/);
    expect(src('src/components/Nav.astro')).toMatch(/const tabActive = \(href: string\) => tabFor\(club \? '\/app\/club' : path\) === href;/);
  });
  it('secondary screens stay reachable from Today: Plans, Cleaning, Resources (family, sharing, Club), This Week', () => {
    const today = src('src/components/app/TodayDashboard.tsx');
    expect(today).toMatch(/<Shortcut href=\{routes\.familyCalendar\} icon="calendar" title="Plans"/);
    expect(today).toMatch(/<Shortcut href="\/app\/cleaning" icon="check" title="Cleaning"/);
    expect(today).toMatch(/<Shortcut href="\/app\/family" icon="list" title="Resources"/);
    expect(src('src/pages/app/index.astro')).toMatch(/href="\/app\/family-calendar"[^>]*data-this-week/);
    const hub = src('src/components/family/FamilyHub.tsx');
    for (const attr of ['data-family-members', 'data-family-responsibilities-card', 'data-family-sharing-card', 'data-family-club-card', 'data-family-club-kept', 'data-open-meeting']) expect(hub).toContain(attr);
  });
});

describe('meeting state: honest, never guilt', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });
  const at = (iso: string) => new Date(iso);

  it('first: nothing agreed and never met here; ready once anything is agreed (no record is invented)', () => {
    expect(meetingState(null, false)).toBe('first');
    expect(meetingState(null, true)).toBe('ready');
  });
  it('in progress only from a recorded, unfinished meeting in the last three days: Continue resumes the step', () => {
    recordStep('h1', 0, at('2026-11-22T18:00:00Z'));
    const p = recordStep('h1', 2, at('2026-11-22T18:05:00Z'));
    expect(p.step).toBe(2);
    expect(meetingState(readProgress('h1'), true, at('2026-11-23T09:00:00Z'))).toBe('in-progress');
    // Four days later: starts fresh, no backlog and no mention of the gap.
    expect(meetingState(readProgress('h1'), true, at('2026-11-27T09:00:00Z'))).toBe('ready');
    expect(recordStep('h1', 0, at('2026-11-27T09:00:00Z')).startedAt).toBe('2026-11-27T09:00:00.000Z');
  });
  it('"recent" only after Finish meeting was tapped, for six days; weeks away is just "ready"', () => {
    recordStep('h1', 3, at('2026-11-22T18:08:00Z'));
    recordFinished('h1', at('2026-11-22T18:10:00Z'));
    expect(meetingState(readProgress('h1'), true, at('2026-11-25T09:00:00Z'))).toBe('recent');
    expect(meetingState(readProgress('h1'), true, at('2026-12-20T09:00:00Z'))).toBe('ready');
  });
  it('Start over forgets an unfinished meeting, never a finished one; households are kept apart', () => {
    recordStep('h1', 1);
    startOver('h1');
    expect(readProgress('h1')).toBeNull();
    recordFinished('h2');
    startOver('h2');
    expect(readProgress('h2')?.completedAt).toBeTruthy();
    expect(readProgress('h3')).toBeNull();
  });
  it('the words never count missed weeks', () => {
    const files = ['src/components/ourweek/WeeklyMeeting.tsx', 'src/components/app/TodayDashboard.tsx', 'src/lib/app/meeting-progress.ts'].map(src).join('\n');
    expect(files).not.toMatch(/weeks? since|missed|streak|overdue|behind on/i);
    expect(dayWord('2026-11-22T18:00:00Z', at('2026-11-22T20:00:00Z'))).toBe('today');
  });
});

describe('the next meeting is only ever a real one', () => {
  const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({ id: Math.random().toString(36), title: 'Family Meeting', starts_on: '2026-11-29', start_time: '18:30', end_time: '18:45', timezone: 'America/Chicago', recurrence: null, skip_dates: [], member_ids: [], owner_member_id: null, revision: 1, ...o });
  it('from an event the family named "Family Meeting", in the next two weeks', () => {
    expect(nextScheduledMeeting([ev({})], '2026-11-23', at())).toMatchObject({ date: '2026-11-29' });
    expect(nextScheduledMeeting([ev({ starts_on: '2026-11-22', recurrence: { freq: 'weekly', by_day: [0] } })], '2026-11-23', at())?.date).toBe('2026-11-29');
  });
  it('nothing on the calendar: no date or time is made up', () => {
    expect(nextScheduledMeeting([ev({ title: 'Soccer practice' })], '2026-11-23', at())).toBeNull();
    expect(nextScheduledMeeting([ev({ starts_on: '2027-01-10' })], '2026-11-23', at())).toBeNull();
    expect(nextScheduledMeeting([], '2026-11-23', at())).toBeNull();
  });
  function at() { return new Date('2026-11-23T12:00:00'); }
});

describe('Family Meeting landing', () => {
  const m = src('src/components/ourweek/WeeklyMeeting.tsx');
  it('the four approved parts, exact names and order, unchanged', () => {
    expect(MEETING_GUIDE.parts.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
    expect(m).toMatch(/MEETING_GUIDE\.parts\.map\(\(part, i\) => \{/);
  });
  it('one prominent Start; Continue only from recorded progress; Finish records it and returns to Today', () => {
    expect(m).toMatch(/>Start Our Family Meeting<\/button>/);
    expect(m).toMatch(/\{state === 'in-progress' \? \(/);
    // Finish records it, then shows "We have a plan." (the family plan), with a way to Today.
    expect(m).toMatch(/onClick=\{\(\) => \{ track\('meeting_completed'\); setProgress\(recordFinished\(scope\)\); setPlanDone\(true\);/);
    expect(src('src/components/ourweek/MeetingPlan.tsx')).toMatch(/href="\/app" className="of-btn[^"]*" data-plan-today/);
  });
  it('the family\'s own focus is called theirs; a Club month is labeled as the month\'s, never as agreed', () => {
    expect(m).toMatch(/data-meeting-landing-focus="family"/);
    expect(m).toMatch(/This month · prepared for your family<\/p>[\s\S]*data-meeting-landing-focus|data-meeting-landing-focus="club-month"[\s\S]*This month · prepared for your family/);
    expect(src('src/components/app/TodayDashboard.tsx')).toMatch(/clubMonth \? \['This month · prepared for your family', clubMonth\]/);
  });
  it('no competing Club promotion on the landing', () => {
    const landing = m.slice(m.indexOf('if (!inMeeting) {'), m.indexOf('  return (\n    <div className="mx-auto max-w-3xl space-y-5" data-weekly-meeting data-meeting-kind'));
    expect(landing).not.toMatch(/\/app\/club|Club Home|\bjoin\b|subscribe|upgrade/i);
  });
  it('the development conversation is in Everyone\'s Part, not Let\'s Talk', () => {
    const talk = m.slice(m.indexOf("{p.title === 'Let’s Talk' && ("), m.indexOf("{p.title === 'Everyone’s Part' && ("));
    expect(talk).not.toMatch(/Development/);
    expect(m).toMatch(/\{devPlan && <DevelopmentConversation /);
  });
});

describe('Today: real data, and MAWL invisible', () => {
  const t = src('src/components/app/TodayDashboard.tsx');
  it('agreements have no invented completion: checkboxes only on trackable event responsibilities', () => {
    const agreedList = t.slice(t.indexOf('data-agreed-parts'), t.indexOf('data-all-parts'));
    expect(agreedList).not.toMatch(/role="checkbox"|data-task-done/);
    const trackable = t.slice(t.indexOf('data-today-trackable'), t.indexOf('data-agreed-parts'));
    expect(trackable).toMatch(/role="checkbox" aria-checked=\{x\.task\.done\}/);
  });
  it('no development stages, coaching or MAWL on Today', () => {
    expect(t).not.toMatch(/family-development|MAWL|\bstage\b|stage-pill|DevelopmentCoach|coachLine/i);
  });
  it('no stage names render anywhere in the meeting coach', () => {
    const coach = src('src/components/family/DevelopmentCoach.tsx');
    expect(coach).not.toMatch(/StagePill|STAGE_SHORT\[|MAWL_LABEL\[/);
  });
});
