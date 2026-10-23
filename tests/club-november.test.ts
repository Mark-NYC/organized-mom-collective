/**
 * The November kit, Our Family, Our Team, as a coach: one letter, one action (three paths to circle), one guide (the
 * Family Rhythm & Ownership Guide) that meets the family where it is and ends in one plan. September's kit is a bonus,
 * linked, never copied. The first November design (the Family Ownership Builder) is kept, unregistered.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { kitBySlug, kitProblems, kits, schedulable } from '../src/data/club/kits';
import { kit as november } from '../src/data/club/kits/2026-11-family-ownership';
import { kit as september } from '../src/data/club/kits/2027-09-a-week-everyone-can-see';
import { ownershipBuilder } from '../src/data/club/libraries/family-ownership-builder';
import { sampleById } from '../src/data/club/samples';
import {
  back, buildPlan, classifyOther, coachingFor, currentScreen, emptyGuide, leadCandidates, meetingRoles, pathOf, planKey, planText, readGuide, screensFor,
  defineFor, type GuideState,
} from '../src/data/rhythm-guide';
import { planMembers, type Household } from '../src/lib/club/profile';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const household = (id: string) => sampleById(id)!.household;
const members = (h: Household) => planMembers(h, november.month);
const walk = (...steps: Partial<GuideState>[]) => steps.reduce<GuideState>((s, p) => ({ ...s, ...p }), emptyGuide());
const plan = (s: GuideState, h: Household = household('rivera')) => buildPlan(s, members(h), november.items, h.preferences);
const empty: Household = { id: 'none', preferences: {}, profileVersion: 1, members: [{ id: 'me', firstName: 'Sam', kind: 'adult', role: 'parent', isAccountHolder: true }] };
const idOf = (h: Household, name: string) => members(h).find((p) => p.firstName === name)!.id;

describe('November: one letter, one next step, one guide', () => {
  it('passes every kit check, keeps its slug and QR, and isn’t schedulable until Megan approves the letter', () => {
    expect(kitProblems(november)).toEqual([]);
    expect(november).toMatchObject({ slug: '2026-11-family-ownership', month: '2026-11', theme: 'Our Family, Our Team', subtitle: 'Make the plan together. Learn to share the load.' });
    expect(november.mailer.qrPath).toBe('/club/kits/2026-11-family-ownership?source=mailer');
    expect(kitBySlug(november.slug)).toBe(november);
    expect(schedulable(november)).toBe(false);
    expect(november.mailer.letter?.draft).toBe(true);
  });

  it('is a three-part kit: the guide replaces the five tabs and the chart', () => {
    expect(november.action?.kind).toBe('paths');
    expect(november.coach).toMatchObject({ id: 'rhythm-ownership', title: 'Family Rhythm & Ownership Guide', cta: 'Find Our Family’s Next Step' });
    expect(november.tool).toBeUndefined();
    expect(november.printables.map((p) => [p.id, p.component])).toEqual([['next-step', 'NextStep'], ['letter', 'Letter']]);
    expect(november.mailer.activity).toBeUndefined();
  });

  it('the letter: It’s Okay to Start Again, 150–200 words, the line for every member, the question, no guilt', () => {
    const l = november.mailer.letter!;
    expect(l.title).toBe('It’s Okay to Start Again');
    expect(l.namedGreeting).toBe('Hi {name},');
    expect(l.greeting).toBe('Hi friend,');
    expect(l.signoff).toBe('Megan');
    expect(words(l.body)).toBeGreaterThanOrEqual(150);
    expect(words(l.body)).toBeLessThanOrEqual(200);
    expect(l.body).toContain('Whether you’ve been doing this for months or you’re just getting started, you can take one small step together this week.');
    expect(l.body).toContain('What’s one thing that would help our family work better together this week?');
    expect(l.body).not.toMatch(/\bI\b|\bmy (husband|kids|family)\b|husband|lazy|should have|failed|behind/i);
    expect(l.body).not.toMatch(/September/);
  });

  it('the action: three paths to circle and two lines to write on; no chart, no new worksheets', () => {
    const a = november.action!;
    expect(a.title).toBe('Our Family’s Next Step');
    expect(a.items).toEqual([]);
    expect(a.paths!.map((p) => [p.label, p.step])).toEqual([
      ['We’re just getting started', 'Have one short family meeting.'],
      ['We started, but got off track', 'Make the meeting easier to repeat.'],
      ['We’re ready to share more ownership', 'Hand off one whole responsibility.'],
    ]);
    expect(a.blanks).toEqual(['Our family’s next step', 'When we’ll try it']);
  });

  it('the back: Make the Rhythm Stick, the four-step handoff, the question, the bonus as a gift, the QR', () => {
    const m = november.mailer;
    expect(m.fieldGuide.title).toBe('Make the Rhythm Stick');
    expect(m.fieldGuide.sections.map((s) => s.heading)).toEqual(['Make it visible.', 'Connect it to an existing habit.', 'Share the leadership.', 'Start small.']);
    expect(m.framework?.title).toBe('Ready for the Next Step?');
    expect(m.framework?.steps.map((s) => s.word)).toEqual(['Show it', 'Do it together', 'Hand it over', 'Check in']);
    expect(m.conversation?.question).toBe('What’s one thing that would help our family work better together this week?');
    expect(m.bonus?.title).toBe('New to the Club? We’ve got you.');
    expect(JSON.stringify(m)).not.toMatch(/\$\d|worth|value|limited|only today|hurry/i);
  });

  it('the bonus is the real September kit, linked, never copied', () => {
    expect(november.bonus?.slug).toBe(september.slug);
    expect(kitBySlug(november.bonus!.slug)).toBe(september);
    expect(november.bonus?.cta).toBe('Open My Bonus September Kit');
    // No September content duplicated in November (its meeting steps, its builder).
    const novText = JSON.stringify(november);
    for (const step of september.action!.items) expect(novText).not.toContain(step.text);
    expect(novText).not.toContain('family-reset');
    // The access rule is the database's, in a migration.
    const sql = readFileSync('supabase/migrations/20261104000000_club_november_bonus.sql', 'utf8');
    expect(sql).toMatch(/club_kit_bonuses/);
    expect(sql).toMatch(/'2026-11-family-ownership'.*'2027-09-a-week-everyone-can-see'/s);
    expect(sql).toMatch(/NOT APPLIED/);
  });

  it('checks catch a broken paths kit or a bonus that isn’t a kit', () => {
    const broken = (k: typeof november) => kitProblems(k).join(' | ');
    expect(broken({ ...november, action: { ...november.action!, paths: november.action!.paths!.slice(0, 1) } })).toMatch(/two to four paths/);
    expect(broken({ ...november, coach: undefined })).toMatch(/coach/);
    expect(broken({ ...november, bonus: { ...november.bonus!, slug: '2099-01-nothing' } })).toMatch(/bonus/);
    expect(broken({ ...november, bonus: { ...november.bonus!, slug: november.slug } })).toMatch(/bonus/);
    expect(broken({ ...november, mailer: { ...november.mailer, bonus: undefined } })).toMatch(/mailer\.bonus/);
  });

  it('keeps the Family Ownership Builder, unregistered, for later', () => {
    expect(kitProblems(ownershipBuilder)).toEqual([]);
    expect(ownershipBuilder.printables.map((p) => p.id)).toContain('ownership-chart');
    expect(kits).not.toContain(ownershipBuilder);
    expect(november.items.length).toBeGreaterThan(20);
  });
});

describe('the guide: only the questions that fit', () => {
  it('opens on one question with four answers', () => {
    expect(currentScreen(emptyGuide())).toBe('start');
    expect(screensFor(emptyGuide())).toEqual(['start']);
  });

  it('A: a new member is welcomed, offered September, and chooses where to start (never made to do September first)', () => {
    const s = walk({ start: 'new' });
    expect(currentScreen(s)).toBe('welcome');
    expect(screensFor(walk({ start: 'new', newStart: 'meeting' }))).toEqual(['start', 'welcome', 'time', 'place', 'plan']);
    expect(screensFor(walk({ start: 'new', newStart: 'handoff' }))).toEqual(['start', 'welcome', 'job', 'owner', 'hard', 'define', 'plan']);
  });

  it('B: never started → a time, a place → Our First Family Meeting Plan', () => {
    const s = walk({ start: 'not-started' }, { time: 'friday' }, { place: 'fridge' });
    expect(screensFor(s)).toEqual(['start', 'time', 'place', 'plan']);
    const p = plan(s)!;
    expect(p).toMatchObject({ kind: 'first-meeting', title: 'Our First Family Meeting Plan', goal: 'Have one short family meeting.', when: 'Friday after dinner', cue: 'The meeting guide, kept on the refrigerator' });
    expect(p.who).toBe('Ana, Luis, Sofia, Mateo and Elena');
  });

  it('C: kept forgetting → make it visible, a cue and a trigger', () => {
    const s = walk({ start: 'off-track' }, { obstacle: 'forgetting' }, { fix: 0 }, { time: 'sunday' });
    expect(screensFor(s)).toEqual(['start', 'obstacle', 'adjust', 'time', 'plan']);
    const p = plan(s)!;
    expect(p).toMatchObject({ kind: 'restart', title: 'Our Family Restart Plan', goal: 'Make the meeting visible', obstacle: 'We kept forgetting.', when: 'Sunday evening' });
    expect(p.step).toMatch(/beside the wall calendar/);
    expect(p.cue).toMatch(/beside the wall calendar/);
    expect(p.why).toMatch(/cue/);
  });

  it('D: kids not participating → one small role each, from the family’s real ages', () => {
    const h = household('chen');
    const p = plan(walk({ start: 'off-track' }, { obstacle: 'kids' }, { fix: 0 }, { time: 'saturday' }), h)!;
    expect(p.goal).toBe('Give everyone one small meeting role');
    const ages = Object.fromEntries(members(h).map((m) => [m.firstName, m.age]));
    expect(p.roles.find((r) => r.startsWith('Grace'))).toMatch(/schedule updates/);
    expect(ages.Grace).toBeGreaterThanOrEqual(13);
    expect(p.roles.find((r) => r.startsWith('Ivy'))).toMatch(/ready this week/);
    expect(p.roles.find((r) => r.startsWith('Mei'))).toMatch(/guide the conversation/);
    expect(p.roles.some((r) => /lead the whole/.test(r))).toBe(false);
    expect(meetingRoles(members(empty))).toHaveLength(4);
  });

  it('E: Mom still leads (going well) → share the meeting leadership, someone chosen by her', () => {
    const h = household('rivera');
    const s = walk({ start: 'going-well' }, { leader: 'mom' });
    expect(currentScreen(s)).toBe('lead');
    expect(leadCandidates(members(h)).map((p) => p.firstName)).toEqual(['Luis', 'Sofia', 'Mateo']);
    const p = plan({ ...s, leadId: idOf(h, 'Sofia'), time: 'sunday' }, h)!;
    expect(p).toMatchObject({ kind: 'leadership', goal: 'Share the meeting leadership.', step: 'Sofia leads our next family meeting.' });
    expect(p.roles[0]).toMatch(/Sofia/);
    expect(p.who).toMatch(/without running it/);
    // Off track because Mom did all the planning: the same idea, as a restart.
    const r = plan(walk({ start: 'off-track' }, { obstacle: 'mom-planning' }, { fix: 0 }, { time: 'friday' }), h)!;
    expect(r).toMatchObject({ kind: 'restart', goal: 'Share the leadership', step: 'Invite someone else to lead the next meeting.' });
  });

  it('F: meetings working and leadership shared → straight into the one-job handoff', () => {
    expect(screensFor(walk({ start: 'going-well' }, { leader: 'shared' }))).toEqual(['start', 'leader', 'job', 'owner', 'hard', 'define', 'plan']);
    // Another person leads, or it varies: that's working; a handoff is offered, not pushed.
    expect(currentScreen(walk({ start: 'going-well' }, { leader: 'varies' }))).toBe('offer');
    expect(screensFor(walk({ start: 'going-well' }, { leader: 'other' }, { offer: 'later' }))).toEqual(['start', 'leader', 'offer', 'later']);
    expect(pathOf(walk({ start: 'going-well' }, { leader: 'other' }, { offer: 'handoff' }))).toBe('handoff');
  });

  it('G: a parent who struggles to let go gets coaching on expectations, teaching and follow-through', () => {
    const h = household('rivera');
    const base = walk({ start: 'going-well' }, { leader: 'shared' }, { job: 'school' }, { ownerId: idOf(h, 'Sofia') });
    const d = defineFor(base, members(h), november.items, h.preferences);
    expect(d.statement).toBe('Sofia owns pack my backpack.');
    expect(d.when).toBe('Every school night');
    expect(d.done).toBe('Packed the night before and waiting by the door.');
    const coach = (hard: GuideState['hard']) => plan({ ...base, hard, define: d }, h)!.handoff!.coaching;
    expect(coach('standards')).toMatch(/what finished looks like/);
    expect(coach('faster')).toMatch(/teaching period/);
    expect(coach('follow-through')).toMatch(/check in after one week/);
    expect(coach('reminding')).toMatch(/trigger/);
    const p = plan({ ...base, hard: 'standards', define: d }, h)!;
    expect(p).toMatchObject({ kind: 'handoff', title: 'Our Ownership Handoff Plan', goal: 'Hand off one whole job.', step: 'Sofia owns pack my backpack.' });
    expect(p.handoff!.stages.map((x) => x.word)).toEqual(['Show it', 'Do it together', 'Hand it over', 'Check in']);
    expect(p.handoff!.stages[3].text).toMatch(/week/);
  });

  it('suggests the version of a job that suits the person’s age, and an adult gets the whole job', () => {
    const h = household('rivera');
    const define = (job: GuideState['job'], name: string) => defineFor(walk({ job, ownerId: idOf(h, name) }), members(h), november.items, h.preferences).statement;
    expect(define('laundry', 'Luis')).toBe('Luis owns family laundry, start to finish.');
    expect(define('laundry', 'Mateo')).toMatch(/Mateo owns (my own laundry|put my clean clothes away)/i);
    expect(define('kitchen', 'Elena')).not.toMatch(/close the kitchen/);
    expect(defineFor(walk({ job: 'other', jobOther: 'the recycling', ownerName: 'Gran' }), members(h), november.items, h.preferences).statement).toBe('Gran owns the recycling.');
  });

  it('different answers, meaningfully different guidance; one adjustment at a time', () => {
    const goals = (['forgetting', 'time', 'mom-planning', 'kids', 'too-long'] as const).map((o) => coachingFor(o, '', members(household('brooks'))).title);
    expect(new Set(goals).size).toBe(5);
    for (const o of ['forgetting', 'time', 'mom-planning', 'kids', 'too-long'] as const) expect(coachingFor(o, '', []).fixes.length).toBeLessThanOrEqual(3);
    expect(coachingFor('time', '', []).fixes.join(' ')).not.toMatch(/must|only Sunday/i);
    expect(coachingFor('too-long', '', []).roles).toEqual(['What’s happening this week?', 'Who’s handling the important preparations?', 'Who needs help?']);
  });

  it('“Something else”: plain keyword matching, or one small experiment when it can’t tell', () => {
    expect(classifyOther('Soccer practice every night, no free evening')).toBe('time');
    expect(classifyOther('the teens just looked at their phones')).toBe('kids');
    expect(classifyOther('honestly it got boring')).toBe('too-long');
    expect(classifyOther('we forgot after week two')).toBe('forgetting');
    expect(classifyOther('the dog ate the guide')).toBeNull();
    expect(coachingFor('other', 'the dog ate the guide', []).title).toBe('Try one small experiment');
    expect(coachingFor('other', 'we forgot', []).title).toBe('Make the meeting visible');
  });

  it('back steps one question at a time, and a changed answer makes a fresh plan', () => {
    let s = walk({ start: 'off-track' }, { obstacle: 'time' }, { fix: 1 }, { time: 'other', timeOther: 'Tuesday breakfast' });
    expect(currentScreen(s)).toBe('plan');
    s = back(s);
    expect(currentScreen(s)).toBe('time');
    s = back(s);
    expect(currentScreen(s)).toBe('adjust');
    const k1 = planKey(walk({ start: 'off-track' }, { obstacle: 'time' }, { fix: 1 }, { time: 'sunday' }));
    const k2 = planKey(walk({ start: 'off-track' }, { obstacle: 'time' }, { fix: 0 }, { time: 'sunday' }));
    expect(k1).not.toBe(k2);
    expect(back(emptyGuide())).toEqual(emptyGuide());
  });

  it('saved progress reads back, and nothing from another household or a removed member survives', () => {
    const h = household('rivera');
    const s = walk({ start: 'going-well' }, { leader: 'mom' }, { leadId: idOf(h, 'Sofia') }, { time: 'sunday' });
    const p = plan(s, h)!;
    const saved = JSON.parse(JSON.stringify({ ...s, plan: { ...p, step: 'Sofia leads on Sunday.' }, planFor: planKey(s) }));
    const back_ = readGuide(saved, members(h).map((m) => m.id));
    expect(back_.plan?.step).toBe('Sofia leads on Sunday.');
    expect(back_.leadId).toBe(idOf(h, 'Sofia'));
    expect(readGuide(saved, members(household('brooks')).map((m) => m.id)).leadId).toBeNull();
    expect(readGuide({ start: 'nope', fix: 9, plan: { kind: 'evil' } }, [])).toEqual(emptyGuide());
    expect(readGuide(null, [])).toEqual(emptyGuide());
  });

  it('works with no family profile beyond her own name, and never assumes two adults', () => {
    const p = plan(walk({ start: 'not-started' }, { time: 'saturday' }, { place: 'calendar' }), empty)!;
    expect(p.who).toBe('Everyone at home');
    expect(leadCandidates(members(empty))).toEqual([]);
    const brooks = household('brooks');
    expect(leadCandidates(members(brooks)).every((m) => m.stage !== 'adult')).toBe(true);
    const lead = plan(walk({ start: 'going-well' }, { leader: 'mom' }, { leadName: 'Gran' }, { time: 'friday' }), brooks)!;
    expect(lead.step).toBe('Gran leads our next family meeting.');
  });

  it('copies as plain text with every part of the plan', () => {
    const h = household('rivera');
    const base = walk({ start: 'new' }, { newStart: 'handoff' }, { job: 'kitchen' }, { ownerId: idOf(h, 'Luis') }, { hard: 'faster' });
    const s = { ...base, define: defineFor(base, members(h), november.items, h.preferences) };
    const t = planText(plan(s, h)!, 'The Rivera Family');
    expect(t).toMatch(/^Our Ownership Handoff Plan · The Rivera Family/);
    expect(t).toMatch(/Done looks like: /);
    expect(t).toMatch(/Show it: .*\nDo it together: .*\nHand it over: .*\nCheck in: /);
    expect(t).toMatch(/Check-in question: /);
  });
});
