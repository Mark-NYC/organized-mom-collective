/**
 * One Family Meeting (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §2, §7): the weekly page and the month's meeting page
 * draw the Club's content from the same engine call, and follow-through uses the Club's existing rules, weekly.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANSWER_PROGRESS, checkInDue, nextStep, weeklyCheckInDue } from '../src/lib/club/family-plan';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';

const src = (p: string) => readFileSync(p, 'utf8');

describe('one meeting system', () => {
  it('the weekly page and the monthly page both build the meeting with buildFamilyMeeting({ household, profile, month })', () => {
    expect(src('src/components/ourweek/WeeklyMeeting.tsx')).toMatch(/buildFamilyMeeting\(\{ household: cal\.household, profile: fam\.profile, month \}\)/);
    expect(src('src/lib/club/plan/meeting.ts')).toMatch(/buildFamilyMeeting\(\{ household: family\.household, profile: shown\(\), month \}\)/);
  });
  it('keeps the four approved parts, in order', () => {
    expect(MEETING_GUIDE.parts.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
    expect(MEETING_GUIDE.parts.map((p) => p.minutes)).toEqual([2, 3, 3, 2]);
  });
  it('a suggestion agreed on the weekly page keeps the same source key the monthly page saves', () => {
    expect(src('src/components/ourweek/WeeklyMeeting.tsx')).toMatch(/suggestionKey\(r\)/);
  });
});

describe('follow-through, weekly', () => {
  const since = '2026-11-01';
  it('asks from the second week, once a week', () => {
    expect(weeklyCheckInDue({ since, progress: 'practicing' }, '2026-11-07')).toBe(false);
    expect(weeklyCheckInDue({ since, progress: 'practicing' }, '2026-11-08')).toBe(true);
    expect(weeklyCheckInDue({ since, progress: 'improving', lastCheckedOn: '2026-11-08' }, '2026-11-14')).toBe(false);
    expect(weeklyCheckInDue({ since, progress: 'struggling', lastCheckedOn: '2026-11-08' }, '2026-11-15')).toBe(true);
  });
  it('stops once they do it on their own', () => {
    expect(weeklyCheckInDue({ since, progress: 'independent', lastCheckedOn: '2026-11-08' }, '2026-12-20')).toBe(false);
  });
  it('leaves the six-week rule for any other caller', () => {
    expect(checkInDue({ status: 'accepted', since, progress: 'practicing' }, '2026-11-20')).toBe(false);
    expect(checkInDue({ status: 'accepted', since, progress: 'practicing' }, '2026-12-13')).toBe(true);
  });
  it('maps answers the way the database function does', () => {
    expect(ANSWER_PROGRESS).toEqual({ 'on-own': 'independent', reminders: 'improving', struggling: 'struggling' });
    const sql = src('supabase/migrations/20261204000000_agreement_follow_through.sql');
    expect(sql).toMatch(/'on-own' then 'independent' when 'reminders' then 'improving' when 'struggling' then 'struggling'/);
  });
  it('struggling gets one adjustment for the obstacle, success adds nothing', () => {
    expect(nextStep({ answer: 'struggling', barrier: 'forgets' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: 'trigger' });
    expect(nextStep({ answer: 'on-own' })).toEqual({ kind: 'celebrate', progress: 'independent' });
  });
});
