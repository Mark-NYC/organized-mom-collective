/**
 * The approved parent-facing MAWL language (owner decision 2026-11-20, PR 515) and the Launch confirmation.
 * Stored values stay model · assist · watch · launch; only what parents read changes.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HAND_OVER_LABEL, LAUNCH_CONFIRMATION, MAWL_LABEL, WATCH_DISTINCTION, advanceLabel, stepBackLabel } from '../src/lib/family-development/language';
import { MAWL_STAGES } from '../src/lib/family-development/framework';
import { applyDecision } from '../src/lib/family-development/records';
import { buildDevelopmentPlan, type CheckInStep } from '../src/lib/family-development/engine';
import type { DevelopmentRecord } from '../src/lib/family-development/records';

const src = (p: string) => readFileSync(p, 'utf8');
const COACH = src('src/components/family/DevelopmentCoach.tsx');

describe('approved MAWL language', () => {
  it('uses exactly the approved terms for the four stages, over unchanged stored values', () => {
    expect(MAWL_STAGES).toEqual(['model', 'assist', 'watch', 'launch']);
    expect(MAWL_LABEL).toEqual({
      model: 'I’ll show them how',
      assist: 'We’ll do it together',
      watch: 'They’ll do it, I’ll coach',
      launch: 'Ready to take full responsibility',
    });
  });

  it('names the Watch → Launch move "Hand over responsibility", a parent action', () => {
    expect(HAND_OVER_LABEL).toBe('Hand over responsibility');
    expect(advanceLabel('watch')).toBe('Hand over responsibility');
    // Two-tab redesign: actions in plain words, never a stage name.
    expect(advanceLabel('model')).toBe('Ready to do it together');
    expect(advanceLabel('assist')).toBe('Ready to try it while you coach');
    expect(advanceLabel('launch')).toBeNull();
  });

  it('keeps moving backward possible from every stage after Model, including after Launch', () => {
    expect(stepBackLabel('launch')).toBe('Coach them again');
    expect(stepBackLabel('watch')).toBe('Practice together again');
    expect(stepBackLabel('assist')).toBe('Show them again');
    expect(stepBackLabel('model')).toBeNull();
    expect(applyDecision({ stage: 'launch', status: 'launched' }, { decision: 'step-back' })).toEqual({ stage: 'watch', status: 'active' });
  });

  it('confirms Launch with the approved words, only from a saved Launch', () => {
    expect(LAUNCH_CONFIRMATION).toBe('Great! This is now their responsibility. You can always step back and practice together again if needed.');
    // The confirmation is returned only inside the success callback, and only when the saved record is launched.
    expect(COACH).toMatch(/case 'advance': return r\.record\.status === 'launched' \? LAUNCH_CONFIRMATION : /);
    const run = COACH.slice(COACH.indexOf('const run = async'), COACH.indexOf('return { busy, error, done, result, run };'));
    expect(run).toMatch(/if \(r\.ok\) setDone\(ok\(r\)\);/); // ok(...) runs only on a confirmed save
  });

  it('separates doing it independently from taking full responsibility', () => {
    expect(WATCH_DISTINCTION).toMatch(/Doing it on their own is progress/);
    expect(WATCH_DISTINCTION).toMatch(/separate choice/);
    expect(COACH).toMatch(/stage === 'watch' && <p [^>]*data-development-watch-distinction>\{WATCH_DISTINCTION\}/);
    // A strong check-in never launches.
    expect(applyDecision({ stage: 'watch', status: 'active' }, { decision: 'check-in', check: { signal: 'consistency', value: 'strong' } })).toEqual({ stage: 'watch', status: 'active' });
    const follow = src('src/components/family/FollowThrough.tsx');
    expect(follow).not.toMatch(/owns? it now/);
    expect(follow).toMatch(/did it on their own\. That’s real progress/);
  });

  it('Watch can last as long as the family wants: the hint never pushes, and Launch stays a choice', () => {
    const rec: DevelopmentRecord = { id: 'r', memberId: 'c', skillId: 'school-bag', title: 'Pack my backpack', stage: 'watch', status: 'active', cue: 'After dinner', variationsPracticed: 3, category: 'school-prep', agreementId: 'a', agreementLive: true, libraryVersion: 1, revision: 9, history: [], lastCheckInOn: '2026-11-10', lastSignal: 'consistency', lastValue: 'strong' };
    const household = { id: 'h', preferences: {}, profileVersion: 1, members: [{ id: 'c', firstName: 'Noah', kind: 'child' as const, role: 'child' as const, birthYear: 2015, birthMonth: 1 }] };
    const s = buildDevelopmentPlan({ household, records: [rec], today: '2026-11-20' }).people[0].step as CheckInStep;
    expect(s.hint).toMatch(/“Hand over responsibility” is your decision to make\. There’s no rush\./);
    expect(s.decisions).toEqual(expect.arrayContaining(['stay', 'advance', 'step-back']));
    expect(s.record.stage).toBe('watch');
  });

  it('after Launch, coaching speaks to the handed-over responsibility, not the decision still to come', () => {
    const rec: DevelopmentRecord = { id: 'r', memberId: 'c', skillId: 'room', title: 'Reset my bedroom', stage: 'launch', status: 'launched', variationsPracticed: 0, category: 'cleaning', agreementId: 'a', agreementLive: true, libraryVersion: 1, revision: 4, history: [], lastCheckInOn: '2026-10-01' };
    const household = { id: 'h', preferences: {}, profileVersion: 1, members: [{ id: 'c', firstName: 'Maya', kind: 'child' as const, role: 'child' as const, birthYear: 2015, birthMonth: 1 }] };
    const s = buildDevelopmentPlan({ household, records: [rec], today: '2026-11-20' }).people[0].step as CheckInStep;
    expect(s.coaching).toMatch(/^It’s their responsibility now\./);
    expect(s.coaching).not.toMatch(/decides when/);
    expect(s.decisions).toContain('step-back');
    expect(s.decisions).not.toContain('advance');
  });

  it('no screen uses the old stage wording', () => {
    const files = ['src/components/family/DevelopmentCoach.tsx', 'src/lib/family-development/engine.ts', 'src/components/ourweek/WeeklyMeeting.tsx', 'src/components/family/FollowThrough.tsx'];
    for (const f of files) {
      expect(src(f), f).not.toMatch(/We’ve decided|it’s theirs|Theirs now|Showing how|Doing it together|Practicing, you nearby|They do it, we watch|We’ll show them first|It’s already theirs|Make it easier/);
    }
  });
});
