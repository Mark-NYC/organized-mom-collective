/**
 * Everyone's Part on a phone (PR 515 mobile UX): per child, who is learning what, how to help and ONE obvious action;
 * stage changes behind one disclosure, only the valid ones for the child's actual stage; rare actions as quiet text.
 * Server-rendered from the real components and engine.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DevelopmentNextSteps } from '../src/components/family/DevelopmentCoach';
import { buildDevelopmentPlan } from '../src/lib/family-development/engine';
import type { DevelopmentRecord } from '../src/lib/family-development/records';
import type { MawlStage } from '../src/lib/family-development/framework';
import { coachLine, keepLabel, MAWL_LABEL, practiceBackLabel, STAGE_SHORT, suggestCoachLine } from '../src/lib/family-development/language';

const household = { id: 'h', preferences: {}, profileVersion: 1, members: [
  { id: 'a', firstName: 'Ana', kind: 'adult' as const, role: 'parent' as const, isAccountHolder: true },
  { id: 'maya', firstName: 'Maya', kind: 'child' as const, role: 'child' as const, birthYear: 2015, birthMonth: 1 },
  { id: 'leo', firstName: 'Leo', kind: 'child' as const, role: 'child' as const, birthYear: 2019, birthMonth: 1 },
] };
const rec = (stage: MawlStage, extra: Partial<DevelopmentRecord> = {}): DevelopmentRecord => ({
  id: `r-${stage}`, memberId: 'maya', skillId: 'room', title: 'Reset my bedroom', stage, status: stage === 'launch' ? 'launched' : 'active',
  cue: 'Before weekend time', variationsPracticed: 0, category: 'cleaning', agreementId: 'a1', agreementLive: true, libraryVersion: 1,
  revision: 3, history: [], lastCheckInOn: stage === 'launch' ? '2026-10-01' : '2026-11-10', ...extra,
});
const render = (records: DevelopmentRecord[]) => {
  const plan = buildDevelopmentPlan({ household, records, today: '2026-11-20' });
  return renderToStaticMarkup(createElement(DevelopmentNextSteps, { plan, live: new Map(records.map((r) => [r.id, r])), decide: async () => ({ ok: false as const, error: 'offline' as const }), colors: {} }))
    .replace(/(data-[a-z-]+)="true"/g, "$1").replace(/<!-- -->/g, ''); // bare data attributes and React's text separators
};
const card = (html: string, attr: string) => {
  const i = html.indexOf(attr);
  return i < 0 ? '' : html.slice(i, html.indexOf('</li>', i));
};
const decisions = (html: string) => [...html.matchAll(/data-development-decision="([a-z-]+)"/g)].map((m) => m[1]);

describe('active responsibility card, every stage', () => {
  const cases: [MawlStage, string[], string | null, string | null][] = [
    ['model', ['stay', 'advance', 'pause'], 'Ready to do it together', null],
    ['assist', ['stay', 'step-back', 'advance', 'pause'], 'Ready to try it while you coach', 'Show them again'],
    ['watch', ['stay', 'step-back', 'advance', 'pause'], 'Hand over responsibility', 'Practice together again'],
    ['launch', ['stay', 'step-back', 'pause'], null, 'Coach them again'],
  ];
  for (const [stage, expected, forward, back] of cases) {
    it(`${stage}: one primary action, only valid stage moves, quiet text actions`, () => {
      const c = card(render([rec(stage)]), 'data-development-next="room"');
      // Two-tab redesign: the stage is invisible (no pill, no stage name), the valid moves are unchanged.
      expect(c).not.toContain('data-development-stage-pill');
      expect(c).not.toContain(`>${STAGE_SHORT[stage]}<`);
      for (const name of Object.values(MAWL_LABEL)) expect(c).not.toContain(`“${name}”`);
      expect(c).toContain(coachLine(stage, 'Maya').replace(/’/g, '’'));
      expect(c).toContain(`data-development-decision="stay">${keepLabel(stage)}<`);
      expect(decisions(c)).toEqual(expected);
      // Exactly one filled primary button on the card.
      expect(c.match(/class="of-btn !min-h/g)?.length ?? 0).toBe(1);
      if (forward) expect(c).toContain(forward); else expect(c).not.toContain('data-development-decision="advance"');
      if (back) { expect(c).toContain(back); expect(practiceBackLabel(stage)).toBe(back); } else expect(c).not.toContain('data-development-decision="step-back"');
      // The moves live behind one disclosure; Edit routine and Pause are text actions.
      expect(c).toMatch(/<details[^>]*data-development-change[^>]*><summary[^>]*>.*Change how we’re practicing<\/summary>/);
      expect(c).toMatch(/data-development-edit>Edit routine</);
      expect(c).toMatch(/data-development-decision="pause">Pause this responsibility</);
      // Never launched by default, and the confirmation never shows before a save.
      expect(c).not.toContain('Great! This is now their responsibility');
    });
  }
  it('Watch keeps the distinction next to Hand over responsibility, and the coaching never guesses pronouns', () => {
    const c = card(render([rec('watch')]), 'data-development-next="room"');
    expect(c).toMatch(/data-development-watch-distinction>Doing it on their own is progress\./);
    expect(c).toMatch(/aria-label="Hand over responsibility to Maya: Reset my bedroom"/);
    expect(c).not.toMatch(/\b(she|her|he|his|him)\b/i);
    expect(c).not.toMatch(/reset my bedroom while/i); // never conjugates the child's first-person title
  });
  it('a removed agreement gets one primary action and a quiet alternative', () => {
    const c = card(render([rec('watch', { agreementLive: false })]), 'data-development-next="room"');
    expect(decisions(c)).toEqual(['restore', 'pause']);
    expect(c.match(/class="of-btn !min-h/g)?.length).toBe(1);
  });
});

describe('suggested skill card', () => {
  const html = render([]);
  const leo = card(html, 'data-development-person="Leo"');
  it('leads with the suggested action: label, title, short coaching, cue, Add to our plan', () => {
    expect(leo).toMatch(/Suggested next skill/);
    expect(leo).toContain(suggestCoachLine('Leo'));
    expect(leo).toMatch(/data-development-summary><span[^>]*>When:<\/span> [A-Z]/);
    expect(leo).toMatch(/aria-label="Add to our plan: Leo, [^"]+"[^>]*data-development-agree>Add to our plan</);
    expect(leo.match(/class="of-btn !min-h/g)?.length).toBe(1);
    expect(leo).toMatch(/data-development-not-now>Not now</);
  });
  it('keeps every choice under Customize, starting at Model by default', () => {
    const custom = leo.slice(leo.indexOf('data-development-adjust'));
    expect(custom).toMatch(/Customize<\/summary>/);
    for (const s of ['model', 'assist', 'watch', 'launch']) expect(custom).toContain(`data-development-stage="${s}"`);
    expect(custom).toMatch(/aria-checked="true"[^>]*data-development-stage="model"/);
    expect(custom).toMatch(/data-development-cue/);
    expect(custom).toMatch(/data-development-cue-input/);
    expect(custom).toMatch(/data-development-finish/);
    expect(custom).toMatch(/data-development-dismiss>Don’t suggest again</);
  });
  it('shows no nested bordered card per child, just a divided list', () => {
    expect(html).toMatch(/<ul class="mt-1"><li class="border-b/);
    expect(html).not.toMatch(/rounded-\[9px\] border border-\[var\(--of-rule\)\] px-3 py-3/);
  });
});

describe('the rest of Everyone\'s Part and the navigation', () => {
  const meeting = readFileSync('src/components/ourweek/WeeklyMeeting.tsx', 'utf8');
  const css = readFileSync('src/styles/family-app-brand.css', 'utf8');
  it('collapses existing agreements (with a count) and the manual form, open by default only without next steps', () => {
    expect(meeting).toMatch(/<details[^>]*open=\{!hasNextSteps\} data-agreed-section>/);
    expect(meeting).toMatch(/What we’ve already agreed\{agreedCount > 0 &&/);
    expect(meeting).toMatch(/<details[^>]*open=\{!hasNextSteps\} data-add-agreement-section>/);
    expect(meeting).toMatch(/Add another responsibility/);
    expect(meeting).toMatch(/href="\/app\/family\/responsibilities"[^>]*data-agreed-edit/); // still editable
    // The manual form keeps its fields and save.
    for (const hook of ['data-agreement-new', 'data-owner-chip', 'RESPONSIBILITY_CATEGORIES.map', 'data-save-new-agreement']) expect(meeting).toContain(hook);
  });
  it('keeps the four parts in a compact row and Back/Next above the tab bar and safe area', () => {
    expect(meeting).toMatch(/data-meeting-step=\{i\}>\s*\{part\.title\}/);
    expect(meeting).toMatch(/sticky bottom-\[calc\(65px\+env\(safe-area-inset-bottom\)\)\][^"]*lg:static[^"]*" data-meeting-step-actions/);
    expect(css).toMatch(/\[data-weekly-meeting\]:has\(input:focus,select:focus,textarea:focus\) \[data-meeting-step-actions\]\{position:static\}/);
  });
});
