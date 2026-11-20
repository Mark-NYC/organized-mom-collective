/**
 * Guards around the development layer's integration (docs/product/FAMILY_DEVELOPMENT_ENGINE.md): the free/paid
 * boundary, the database and app agreeing on the same rules, and the monthly resources staying untouched.
 * Behavior of the engine itself: tests/family-development-engine.test.ts. Database behavior (authorization,
 * isolation, history): supabase/tests/family-development.sql.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_DECISIONS } from '../src/lib/family-development/records';
import { MAWL_STAGES } from '../src/lib/family-development/framework';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';

const src = (p: string) => readFileSync(p, 'utf8');
const SQL = src('supabase/migrations/20261207000000_family_development_records.sql');
const MEETING = src('src/components/ourweek/WeeklyMeeting.tsx');
const COACH = src('src/components/family/DevelopmentCoach.tsx');
const DEV_FILES = [
  'src/lib/family-development/engine.ts', 'src/lib/family-development/records.ts', 'src/lib/family-development/client.ts',
  'src/components/family/DevelopmentCoach.tsx',
];

describe('free and Club boundary', () => {
  it('the meeting loads development records only for a Club household and builds the plan only then', () => {
    expect(MEETING).toMatch(/useDevelopment\(club && Boolean\(cal\.household\)\)/);
    expect(MEETING).toMatch(/if \(devPlan \|\| !club \|\| !dev\.loaded \|\| !dev\.records/);
    // Every development element is behind the plan.
    for (const c of ['DevelopmentCheckIns', 'DevelopmentNextSteps', 'DevelopmentPractice']) {
      expect(MEETING).toMatch(new RegExp(`\\{devPlan && <${c} `));
    }
  });
  it('the database checks Club access on every write, through the household (either adult), and never on reads', () => {
    const decide = SQL.slice(SQL.indexOf('create function public.household_development_decide'));
    expect(decide).toMatch(/if not public\.club_has_access\(public\.household_billing_user\(uid\)\) then raise exception 'club_required'/);
    const read = SQL.slice(SQL.indexOf('create function public.household_development()'), SQL.indexOf('create function public.household_development_decide'));
    expect(read).not.toMatch(/club_has_access/);
  });
  it('keeps the four approved parts and their timing', () => {
    expect(MEETING_GUIDE.parts.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
    expect(MEETING_GUIDE.parts.map((p) => p.minutes)).toEqual([2, 3, 3, 2]);
  });
  it('one next step per person: a child with a development step gets no month suggestion as well', () => {
    expect(MEETING).toMatch(/p\.suggested\.length && !devStepFor\.has\(p\.memberId\)/);
    expect(MEETING).toMatch(/skipSkillAgreements/);
  });
});

describe('the database and the app apply the same rules', () => {
  it('same decisions and stages', () => {
    const decisions = /decision text not null check \(decision in \(([^)]*)\)\)/s.exec(SQL)![1].match(/'([a-z-]+)'/g)!.map((s) => s.slice(1, -1));
    expect(decisions.sort()).toEqual([...DEVELOPMENT_DECISIONS].sort());
    const stages = /stage text check \(stage in \(([^)]*)\)\)/.exec(SQL)![1].match(/'([a-z]+)'/g)!.map((s) => s.slice(1, -1));
    expect(stages).toEqual([...MAWL_STAGES]);
  });
  it('nothing advances on its own: no triggers, schedules or defaults that move a stage', () => {
    expect(SQL).not.toMatch(/create trigger|cron\.|pg_cron|create extension/i);
    expect(SQL).not.toMatch(/stage text[^,\n]*default/);
    expect(SQL).toMatch(/nxt\.stage := stages\[idx \+ 1\]/); // exactly one stage, only in 'advance'
    expect(SQL.match(/stages\[idx \+ 1\]/g)).toHaveLength(1);
  });
  it('is additive: no existing table, function or policy is altered', () => {
    expect(SQL).not.toMatch(/alter table public\.(club_|household_adults|household_agreement)/);
    expect(SQL).not.toMatch(/create or replace function/);
    expect(SQL).not.toMatch(/drop /i);
  });
  it('history is append-only for families', () => {
    expect(SQL).toMatch(/revoke all on public\.household_development, public\.household_development_events from public, anon, authenticated/);
    expect(SQL).toMatch(/grant select on public\.household_development, public\.household_development_events to authenticated/);
  });
});

describe('existing products are untouched', () => {
  it('the development layer never imports monthly kits, generators, print, billing or calendar sync', () => {
    for (const f of DEV_FILES) {
      const imports = [...src(f).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${f} imports ${i}`).not.toMatch(/club\/kits|club\/engines|personalize|meeting-guide\/generate|print|membership|billing|checkout|stripe|calendar\/google|calendar\/feeds|responsibility-cards/);
      }
    }
  });
  it('coaching copy never defaults to rewards or payment for chores', () => {
    for (const f of DEV_FILES) expect(src(f)).not.toMatch(/reward|allowance|treat|screen time|sticker|prize/i);
  });
  it('says "We agreed" only for the family\'s explicit choice and offers Not now / Not for us', () => {
    expect(COACH).toMatch(/data-development-agree>We agreed</);
    expect(COACH).toMatch(/data-development-not-now>Not now</);
    expect(COACH).toMatch(/data-development-dismiss>Not for us</);
    expect(COACH).toMatch(/Nothing moves forward on its own/);
  });
});

describe('the meeting UI renders the plan (server render)', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DevelopmentCheckIns, DevelopmentNextSteps, DevelopmentPractice } = await import('../src/components/family/DevelopmentCoach');
  const { buildDevelopmentPlan } = await import('../src/lib/family-development/engine');
  const household = { id: 'h', preferences: {}, profileVersion: 1, members: [
    { id: 'a', firstName: 'Ana', kind: 'adult' as const, role: 'parent' as const, isAccountHolder: true },
    { id: 'm', firstName: 'Mia', kind: 'child' as const, role: 'child' as const, birthYear: 2019, birthMonth: 1 },
    { id: 'n', firstName: 'Noah', kind: 'child' as const, role: 'child' as const, birthYear: 2015, birthMonth: 1 },
  ] };
  const watch = { id: 'r1', memberId: 'n', skillId: 'school-bag', title: 'Pack my backpack', stage: 'watch' as const, status: 'active' as const, cue: 'After dinner', variationsPracticed: 0, libraryVersion: 1, revision: 3, history: [], lastCheckInOn: '2026-11-10', lastSignal: 'consistency' as const, lastValue: 'strong' as const };
  const plan = buildDevelopmentPlan({ household, profile: null, records: [watch], today: '2026-11-20' });
  const props = { plan, live: new Map([[watch.id, watch]]), decide: async () => ({ ok: false as const, error: 'offline' as const }), colors: {} };

  it('Let\'s Talk asks the Watch question with the family\'s cue, and the new-circumstance toggle', () => {
    const html = renderToStaticMarkup(createElement(DevelopmentCheckIns, props));
    expect(html).toMatch(/data-development-check-in="school-bag"/);
    expect(html).toMatch(/after dinner/);
    expect(html).toMatch(/different kind of day/);
    expect(html).not.toMatch(/Mia/); // Mia has no record: nothing to check in on
  });
  it('Everyone\'s Part shows one step per child: coaching for Noah, one idea for Mia with the three choices', () => {
    const html = renderToStaticMarkup(createElement(DevelopmentNextSteps, { ...props, onAgree: async () => undefined }));
    expect(html.match(/data-development-person=/g)).toHaveLength(2);
    expect(html).toMatch(/data-development-next="school-bag"/);
    expect(html).toMatch(/It’s theirs now/); // offered as the family's choice, never applied
    expect(html).toMatch(/data-development-suggest=/);
    expect(html).toMatch(/We’ll show them first/);
  });
  it('Let\'s Practice offers the new idea\'s Model step', () => {
    expect(renderToStaticMarkup(createElement(DevelopmentPractice, props))).toMatch(/Practice it now/);
  });
  it('renders nothing for an empty or unavailable plan', () => {
    const empty = buildDevelopmentPlan({ household, records: null, today: '2026-11-20' });
    expect(renderToStaticMarkup(createElement(DevelopmentNextSteps, { ...props, plan: empty, onAgree: async () => undefined }))).toBe('');
    expect(renderToStaticMarkup(createElement(DevelopmentCheckIns, { ...props, plan: empty }))).toBe('');
  });
});
