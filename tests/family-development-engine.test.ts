import { describe, expect, it } from 'vitest';
import {
  buildDevelopmentPlan, rankSkillsFor, seasonOf, skillForGrowthItem, responsibilityCategoryOf, checkInQuestion,
  MAX_NEW_PER_MEETING, PROGRESSIONS, skillAgreementSource,
  type CheckInStep, type EngineInput, type SuggestStep,
} from '../src/lib/family-development/engine';
import { applyDecision, availableDecisions, decisionToDb, recordFromDb, DecisionError, type DevelopmentRecord, type DevelopmentEvent } from '../src/lib/family-development/records';
import { skills, skillById } from '../src/lib/family-development/skills';
import type { Household, FamilyMember } from '../src/lib/club/profile';
import { emptyProfile, type FamilyProfile, type Responsibility } from '../src/lib/club/family-profile';

const TODAY = '2026-11-20'; // everyday season
const adult = (id: string, name: string, holder = false): FamilyMember => ({ id, firstName: name, kind: 'adult', role: holder ? 'parent' : 'partner', ...(holder ? { isAccountHolder: true } : {}) });
const child = (id: string, name: string, birthYear: number, birthMonth = 1): FamilyMember => ({ id, firstName: name, kind: 'child', role: 'child', birthYear, birthMonth });
const household = (members: FamilyMember[], preferences: Household['preferences'] = {}): Household => ({ id: 'h1', preferences, profileVersion: 1, members });

const ANA = adult('a1', 'Ana', true);
const MIA = child('c-mia', 'Mia', 2019); // 7
const NOAH = child('c-noah', 'Noah', 2015); // 11
const TOT = child('c-tot', 'Tess', 2024); // 2
const TEEN = child('c-teen', 'Sam', 2011); // 15

let seq = 0;
function rec(p: Partial<DevelopmentRecord> & Pick<DevelopmentRecord, 'memberId' | 'skillId'>): DevelopmentRecord {
  seq += 1;
  return {
    id: `r${String(seq).padStart(3, '0')}`, title: skillById(p.skillId)?.title ?? p.skillId, stage: 'model', status: 'active',
    variationsPracticed: 0, libraryVersion: 1, revision: 1, history: [], createdAt: '2026-10-01T10:00:00Z', ...p,
  };
}
const ev = (e: Partial<DevelopmentEvent>): DevelopmentEvent => ({ decision: 'check-in', fromStage: 'watch', toStage: 'watch', fromStatus: 'active', toStatus: 'active', variationPracticed: false, decidedAt: '2026-11-01T10:00:00Z', ...e });
const resp = (r: Partial<Responsibility> & Pick<Responsibility, 'status' | 'category'>): Responsibility => ({ ownerIds: [], helperIds: [], ...r });
const plan = (i: Partial<EngineInput> & Pick<EngineInput, 'household'>) => buildDevelopmentPlan({ records: [], today: TODAY, ...i });
const stepOf = (p: ReturnType<typeof plan>, id: string) => p.people.find((x) => x.memberId === id)?.step ?? null;

describe('development records: family decisions only', () => {
  it('starts only at the stage the family chose, and never infers one', () => {
    expect(applyDecision(null, { decision: 'start', stage: 'watch' })).toEqual({ stage: 'watch', status: 'active' });
    expect(applyDecision(null, { decision: 'start', stage: 'launch' })).toEqual({ stage: 'launch', status: 'launched' });
    expect(() => applyDecision(null, { decision: 'start' })).toThrow(DecisionError);
    expect(applyDecision(null, { decision: 'pause' })).toEqual({ stage: null, status: 'paused' });
    expect(applyDecision(null, { decision: 'dismiss' })).toEqual({ stage: null, status: 'dismissed' });
    expect(() => applyDecision(null, { decision: 'advance' })).toThrow(DecisionError);
  });

  it('moves exactly one stage per explicit decision, in both directions', () => {
    expect(applyDecision({ stage: 'model', status: 'active' }, { decision: 'advance' })).toEqual({ stage: 'assist', status: 'active' });
    expect(applyDecision({ stage: 'watch', status: 'active' }, { decision: 'advance' })).toEqual({ stage: 'launch', status: 'launched' });
    expect(applyDecision({ stage: 'launch', status: 'launched' }, { decision: 'step-back' })).toEqual({ stage: 'watch', status: 'active' });
    expect(applyDecision({ stage: 'assist', status: 'active' }, { decision: 'step-back' })).toEqual({ stage: 'model', status: 'active' });
    expect(() => applyDecision({ stage: 'model', status: 'active' }, { decision: 'step-back' })).toThrow(DecisionError);
    expect(() => applyDecision({ stage: 'launch', status: 'launched' }, { decision: 'advance' })).toThrow(DecisionError);
  });

  it('keeps Watch through any number of good check-ins; check-ins and stays never move a stage', () => {
    let s = { stage: 'watch' as const, status: 'active' as const } as Pick<DevelopmentRecord, 'stage' | 'status'>;
    for (let i = 0; i < 40; i++) s = applyDecision(s, { decision: i % 2 ? 'stay' : 'check-in', check: { signal: 'consistency', value: 'strong', variation: true } });
    expect(s).toEqual({ stage: 'watch', status: 'active' });
    expect(() => applyDecision(s, { decision: 'check-in' })).toThrow(DecisionError);
    expect(() => applyDecision(s, { decision: 'pause', check: { signal: 'consistency', value: 'strong' } })).toThrow(DecisionError);
  });

  it('pauses, dismisses and resumes deliberately; reopening a never-started idea needs the family\'s stage', () => {
    expect(applyDecision({ stage: 'assist', status: 'active' }, { decision: 'pause' })).toEqual({ stage: 'assist', status: 'paused' });
    expect(applyDecision({ stage: 'assist', status: 'paused' }, { decision: 'resume' })).toEqual({ stage: 'assist', status: 'active' });
    expect(() => applyDecision({ stage: null, status: 'dismissed' }, { decision: 'resume' })).toThrow(DecisionError);
    expect(applyDecision({ stage: null, status: 'dismissed' }, { decision: 'resume', stage: 'model' })).toEqual({ stage: 'model', status: 'active' });
    expect(applyDecision({ stage: 'launch', status: 'paused' }, { decision: 'resume' })).toEqual({ stage: 'launch', status: 'launched' });
    expect(() => applyDecision({ stage: 'model', status: 'active' }, { decision: 'resume' })).toThrow(DecisionError);
  });

  it('offers only decisions that make sense for the stage', () => {
    expect(availableDecisions({ stage: 'model', status: 'active' })).toEqual(['stay', 'advance', 'pause', 'modify', 'dismiss']);
    expect(availableDecisions({ stage: 'watch', status: 'active' })).toContain('step-back');
    expect(availableDecisions({ stage: 'launch', status: 'launched' })).toEqual(['stay', 'step-back', 'pause', 'modify']);
    expect(availableDecisions({ stage: null, status: 'dismissed' })).toEqual(['resume', 'modify']);
  });

  it('round-trips the database shape and sends only what a decision may change', () => {
    const r = recordFromDb({ id: 'x', member_id: 'c', skill_id: 'bed', title: 'Make my bed', stage: 'watch', status: 'active', cue: 'After breakfast', finish_line: null, note: null, last_signal: 'consistency', last_value: 'partial', last_check_in_on: '2026-11-13', variations_practiced: 1, library_version: 1, revision: 4, history: [{ decision: 'advance', from_stage: 'assist', to_stage: 'watch', from_status: 'active', to_status: 'active', signal: null, value: null, variation_practiced: false, note: null, decided_at: '2026-11-01T00:00:00Z' }] });
    expect(r).toMatchObject({ stage: 'watch', cue: 'After breakfast', lastValue: 'partial', lastCheckInOn: '2026-11-13', revision: 4 });
    expect(r.finishLine).toBeUndefined();
    expect(r.history[0]).toMatchObject({ decision: 'advance', fromStage: 'assist', toStage: 'watch' });
    expect(decisionToDb(r, { decision: 'stay', cue: 'ignored' }, 1, false)).toEqual({ id: 'x', decision: 'stay', library_version: 1 });
    expect(decisionToDb({ id: 'n', memberId: 'c', skillId: 'bed', title: 'Make my bed' }, { decision: 'start', stage: 'assist', cue: ' After breakfast ' }, 1, true))
      .toEqual({ id: 'n', decision: 'start', library_version: 1, member_id: 'c', skill_id: 'bed', title: 'Make my bed', stage: 'assist', cue: 'After breakfast' });
  });
});

describe('recommendation engine: one useful next step per child', () => {
  it('works with a minimal profile: a starting idea, honestly labeled, never invented details', () => {
    const p = plan({ household: household([ANA, MIA]), profile: null });
    const s = stepOf(p, MIA.id) as SuggestStep;
    expect(s.kind).toBe('suggest');
    expect(s.generic).toBe(true);
    expect(s.suggestedStage).toBe('model');
    expect(s.why.join(' ')).toMatch(/starting idea/);
    expect(s.why.join(' ')).toMatch(/guide, not a rule/);
    // No pets, yard, dishwasher or plants unless the family said so.
    expect(['pet', 'pet-care', 'yard', 'outdoor', 'dishwasher', 'plants']).not.toContain(s.skill.id);
    expect(p.people.map((x) => x.memberId)).toEqual([MIA.id]); // adults never get development steps
  });

  it('is deterministic: the same family and day give the same plan', () => {
    const input = { household: household([ANA, MIA, NOAH]), profile: { ...emptyProfile(), priority: 'mornings' } };
    expect(JSON.stringify(plan(input))).toEqual(JSON.stringify(plan(input)));
  });

  it('suggests different, age-fitting skills for children of different ages', () => {
    const p = plan({ household: household([ANA, MIA, NOAH, TEEN]) });
    const ids = p.people.map((x) => (x.step as SuggestStep | null)?.skill.id ?? null);
    expect(ids.filter(Boolean)).toHaveLength(MAX_NEW_PER_MEETING); // two new skills per meeting, household-wide
    for (const x of p.people) {
      const s = x.step as SuggestStep | null;
      if (!s) continue;
      const from = s.skill.typicalAge?.from ?? 0;
      expect(from).toBeLessThanOrEqual((x.age ?? 0) + 1);
      if (s.skill.requiresAdultSupervision) expect(from).toBeLessThanOrEqual(x.age!);
    }
    expect(new Set(ids.filter(Boolean)).size).toBe(ids.filter(Boolean).length);
  });

  it('gives a toddler no job and keeps supervised tasks at or above their typical starting age', () => {
    const p = plan({ household: household([ANA, TOT]) });
    expect(stepOf(p, TOT.id)).toBeNull();
    const ranked = rankSkillsFor({ household: household([ANA, MIA]), records: [], today: TODAY }, MIA.id);
    for (const r of ranked) {
      const s = skillById(r.id)!;
      if (s.requiresAdultSupervision) expect(s.typicalAge!.from!).toBeLessThanOrEqual(7);
    }
    expect(ranked.map((r) => r.id)).not.toContain('dinner'); // 14+, supervised
  });

  it('treats age as guidance: one year early is allowed for unsupervised skills, and says so', () => {
    const six = child('c6', 'Ivy', 2020, 1); // 6
    // Without a family signal, an early skill isn't offered; with one (the laundry priority), it is, honestly labeled.
    expect(rankSkillsFor({ household: household([ANA, six]), records: [], today: TODAY }, six.id).map((r) => r.id)).not.toContain('fold');
    const ranked = rankSkillsFor({ household: household([ANA, six]), profile: { ...emptyProfile(), priority: 'laundry' }, records: [], today: TODAY }, six.id);
    const fold = ranked.find((r) => r.id === 'fold'); // typical from 7, unsupervised
    expect(fold?.why.join(' ')).toMatch(/earlier than usual/);
    expect(ranked.map((r) => r.id)).not.toContain('counters'); // from 7 but supervised: never early
  });

  it('prioritizes what the family said they want for this child', () => {
    const profile: FamilyProfile = { ...emptyProfile(), responsibilities: [resp({ status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: [MIA.id] })] };
    const s = stepOf(plan({ household: household([ANA, MIA]), profile }), MIA.id) as SuggestStep;
    expect(s.skill.id).toBe('school-bag');
    expect(s.generic).toBe(false);
    expect(s.why[0]).toMatch(/You said you’d like Mia to take on packing their school bag/);
  });

  it('uses the family priority and challenges to rank, with reasons', () => {
    const profile: FamilyProfile = { ...emptyProfile(), priority: 'laundry', challenges: ['routines'] };
    const s = stepOf(plan({ household: household([ANA, MIA]), profile }), MIA.id) as SuggestStep;
    expect(['hamper', 'sort', 'fold']).toContain(s.skill.id);
    expect(s.why.join(' ')).toMatch(/working on: laundry/);
  });

  it('never duplicates a responsibility the child already owns or an agreement made from a skill', () => {
    const profile: FamilyProfile = { ...emptyProfile(), responsibilities: [
      resp({ status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: [MIA.id] }),
      resp({ status: 'confirmed', category: 'school-prep', ownerIds: [MIA.id], agreement: { text: 'Pack my backpack', source: skillAgreementSource('school-bag') } }),
      resp({ status: 'existing', category: 'routines', item: 'morning-routine', ownerIds: [MIA.id] }),
    ] };
    const ranked = rankSkillsFor({ household: household([ANA, MIA]), profile, records: [], today: TODAY }, MIA.id).map((r) => r.id);
    expect(ranked).not.toContain('school-bag');
    expect(ranked).not.toContain('morning-rhythm');
  });

  it('never repeats a paused, dismissed, active or launched skill', () => {
    const records = [
      rec({ memberId: MIA.id, skillId: 'table', status: 'dismissed', stage: null }),
      rec({ memberId: MIA.id, skillId: 'dishes', status: 'paused', stage: null }),
      rec({ memberId: MIA.id, skillId: 'bed', status: 'launched', stage: 'launch', lastCheckInOn: '2026-11-19' }),
    ];
    const ranked = rankSkillsFor({ household: household([ANA, MIA]), records, today: TODAY }, MIA.id).map((r) => r.id);
    for (const id of ['table', 'dishes', 'bed']) expect(ranked).not.toContain(id);
    // The dismissed skill stays dismissed across seasons and library-driven re-ranking.
    for (const today of ['2026-06-01', '2026-08-20', '2027-01-05']) {
      expect(rankSkillsFor({ household: household([ANA, MIA]), records, today }, MIA.id).map((r) => r.id)).not.toContain('table');
    }
  });

  it('puts an existing responsibility that needs attention ahead of anything new', () => {
    const r = rec({ memberId: MIA.id, skillId: 'bed', stage: 'assist', lastCheckInOn: '2026-11-19', lastSignal: 'performance', lastValue: 'not-yet' });
    const s = stepOf(plan({ household: household([ANA, MIA]), records: [r] }), MIA.id) as CheckInStep;
    expect(s.kind).toBe('check-in');
    expect(s.attention).toBe(true);
    expect(s.record.id).toBe(r.id);
    expect(s.question.signal).toBe('performance');
  });

  it('checks in weekly on active records; launched ones every four weeks', () => {
    const due = rec({ memberId: MIA.id, skillId: 'bed', stage: 'watch', lastCheckInOn: '2026-11-13' });
    expect(stepOf(plan({ household: household([ANA, MIA]), records: [due] }), MIA.id)?.kind).toBe('check-in');
    const fresh = rec({ memberId: MIA.id, skillId: 'bed', stage: 'watch', lastCheckInOn: '2026-11-18' });
    expect(stepOf(plan({ household: household([ANA, MIA]), records: [fresh] }), MIA.id)?.kind).toBe('suggest'); // not due; one Watch record leaves room for one idea
    const launched = rec({ memberId: MIA.id, skillId: 'bed', stage: 'launch', status: 'launched', lastCheckInOn: '2026-11-06' });
    expect(stepOf(plan({ household: household([ANA, MIA]), records: [launched] }), MIA.id)?.kind).toBe('suggest');
    const launchedDue = rec({ memberId: MIA.id, skillId: 'bed', stage: 'launch', status: 'launched', lastCheckInOn: '2026-10-20' });
    const s = stepOf(plan({ household: household([ANA, MIA]), records: [launchedDue] }), MIA.id) as CheckInStep;
    expect(s.question.signal).toBe('ownership');
    const today = rec({ memberId: MIA.id, skillId: 'bed', stage: 'watch', lastCheckInOn: TODAY, lastValue: 'partial', lastSignal: 'consistency' });
    expect(stepOf(plan({ household: household([ANA, MIA]), records: [today] }), MIA.id)?.kind).not.toBe('check-in');
  });

  it('adds no new skill while a child is in Model or Assist, or already has two active records', () => {
    const assist = rec({ memberId: MIA.id, skillId: 'bed', stage: 'assist', lastCheckInOn: '2026-11-19' });
    expect(stepOf(plan({ household: household([ANA, MIA]), records: [assist] }), MIA.id)).toBeNull();
    const two = [rec({ memberId: NOAH.id, skillId: 'bed', stage: 'watch', lastCheckInOn: '2026-11-19' }), rec({ memberId: NOAH.id, skillId: 'floor', stage: 'watch', lastCheckInOn: '2026-11-19' })];
    expect(stepOf(plan({ household: household([ANA, NOAH]), records: two }), NOAH.id)).toBeNull();
  });

  it('coaches Watch for quality and new circumstances, occasionally, and only hints at Launch', () => {
    const steady = rec({ memberId: NOAH.id, skillId: 'school-bag', stage: 'watch', cue: 'After dinner', lastCheckInOn: '2026-11-12', lastSignal: 'consistency', lastValue: 'strong', variationsPracticed: 2 });
    const s = stepOf(plan({ household: household([ANA, NOAH]), records: [steady] }), NOAH.id) as CheckInStep;
    expect(s.question.signal).toBe('consistency');
    expect(s.question.text).toMatch(/after dinner/);
    expect(skillById('school-bag')!.watchVariations).toContain(s.watchVariation);
    expect(s.hint).toMatch(/your call/);
    expect(s.decisions).toContain('advance'); // offered, never applied
    expect(s.record.stage).toBe('watch');
    const weekOne = rec({ memberId: NOAH.id, skillId: 'school-bag', stage: 'watch', lastCheckInOn: '2026-11-12', history: [] });
    expect((stepOf(plan({ household: household([ANA, NOAH]), records: [weekOne] }), NOAH.id) as CheckInStep).watchVariation).toBeUndefined();
  });

  it('supports a child staying in Watch for months, without pressure to Launch', () => {
    const history = Array.from({ length: 20 }, (_, i) => ev({ value: i % 3 ? 'partial' : 'strong', signal: 'consistency', decidedAt: `2026-0${(i % 9) + 1}-01T00:00:00Z` }));
    const long = rec({ memberId: NOAH.id, skillId: 'school-bag', stage: 'watch', lastCheckInOn: '2026-11-10', lastSignal: 'consistency', lastValue: 'partial', history, createdAt: '2026-02-01T00:00:00Z' });
    const s = stepOf(plan({ household: household([ANA, NOAH]), records: [long] }), NOAH.id) as CheckInStep;
    expect(s.kind).toBe('check-in');
    expect(s.record.stage).toBe('watch');
    expect(s.hint ?? '').not.toMatch(/Launch|your call/);
  });

  it('suggests making it easier after two weeks of "not yet", without changing anything', () => {
    const history = [ev({ value: 'not-yet', signal: 'consistency' }), ev({ value: 'not-yet', signal: 'consistency' })];
    const r = rec({ memberId: MIA.id, skillId: 'floor', stage: 'watch', lastCheckInOn: '2026-11-12', lastSignal: 'consistency', lastValue: 'not-yet', history });
    const s = stepOf(plan({ household: household([ANA, MIA]), records: [r] }), MIA.id) as CheckInStep;
    expect(s.hint).toMatch(/Stepping back/);
    expect(s.record.stage).toBe('watch');
  });

  it('respects adult-selected higher and lower stages exactly as recorded', () => {
    const higher = rec({ memberId: MIA.id, skillId: 'school-bag', stage: 'watch', lastCheckInOn: '2026-11-01' }); // 7, plausibly "early"
    const lower = rec({ memberId: NOAH.id, skillId: 'teeth', stage: 'model', lastCheckInOn: '2026-11-01' }); // 11, typical from 4
    const p = plan({ household: household([ANA, MIA, NOAH]), records: [higher, lower] });
    expect((stepOf(p, MIA.id) as CheckInStep).record.stage).toBe('watch');
    expect((stepOf(p, NOAH.id) as CheckInStep).record.stage).toBe('model');
    expect((stepOf(p, NOAH.id) as CheckInStep).coaching).toBe(skillById('teeth')!.model);
  });

  it('builds on launched skills: the next step waits until its foundation is the child\'s', () => {
    const active = [rec({ memberId: NOAH.id, skillId: 'sort', stage: 'watch', lastCheckInOn: '2026-11-19' })];
    expect(rankSkillsFor({ household: household([ANA, NOAH]), records: active, today: TODAY }, NOAH.id).map((r) => r.id)).not.toContain('fold');
    const launched = [rec({ memberId: NOAH.id, skillId: 'sort', stage: 'launch', status: 'launched', lastCheckInOn: '2026-11-19' })];
    const fold = rankSkillsFor({ household: household([ANA, NOAH]), records: launched, today: TODAY }, NOAH.id).find((r) => r.id === 'fold');
    expect(fold?.why.join(' ')).toMatch(/Builds on “Sort clean laundry”, which Noah now owns/);
    for (const [from, to] of Object.entries(PROGRESSIONS)) { expect(skillById(from), from).not.toBeNull(); expect(skillById(to), to).not.toBeNull(); }
  });

  it('lets seasons reorder ideas, never reset records', () => {
    const records = [rec({ memberId: NOAH.id, skillId: 'bed', stage: 'watch', lastCheckInOn: '2026-05-25' })];
    expect(seasonOf('2026-06-01')).toBe('summer-transition');
    expect(seasonOf('2026-08-20')).toBe('school-start');
    expect(seasonOf('2027-01-05')).toBe('new-year');
    expect(seasonOf('2026-11-20')).toBe('everyday');
    const summer = rankSkillsFor({ household: household([ANA, MIA]), records: [], today: '2026-06-01' }, MIA.id);
    const school = rankSkillsFor({ household: household([ANA, MIA]), records: [], today: '2026-08-20' }, MIA.id);
    expect(summer[0].why.join(' ')).toMatch(/summer/);
    expect(school.slice(0, 3).map((r) => r.id)).toContain('school-bag');
    for (const today of ['2026-06-01', '2026-08-20', '2027-01-05']) {
      const s = stepOf(buildDevelopmentPlan({ household: household([ANA, NOAH]), records, today }), NOAH.id) as CheckInStep;
      expect(s.record.stage).toBe('watch');
    }
  });

  it('never assumes school for a homeschool family or pets without being told', () => {
    const hs = rankSkillsFor({ household: household([ANA, MIA], { school: 'homeschool' }), records: [], today: '2026-08-20' }, MIA.id).map((r) => r.id);
    expect(hs).not.toContain('school-bag');
    expect(rankSkillsFor({ household: household([ANA, MIA]), records: [], today: TODAY }, MIA.id).map((r) => r.id)).not.toContain('pet');
    expect(rankSkillsFor({ household: household([ANA, MIA], { pets: true }), records: [], today: TODAY }, MIA.id).map((r) => r.id)).toContain('pet');
  });

  it('offers habit cues from the library and the family rhythm, never a reward', () => {
    const s = stepOf(plan({ household: household([ANA, MIA]), profile: { ...emptyProfile(), priority: 'mornings' } }), MIA.id) as SuggestStep;
    expect(s.cueOptions.length).toBeGreaterThan(0);
    expect(s.cueOptions.length).toBeLessThanOrEqual(3);
    expect(s.cueOptions).toContain('After brushing teeth in the morning');
    expect(JSON.stringify(s)).not.toMatch(/reward|allowance|treat|screen time|sticker/i);
  });

  it('handles several children: at most one step each, two new ideas per meeting, check-ins for the rest', () => {
    const kids = [MIA, NOAH, TEEN, child('c4', 'Lily', 2017)];
    const records = [rec({ memberId: TEEN.id, skillId: 'own-laundry', stage: 'assist', lastCheckInOn: '2026-11-10' })];
    const p = plan({ household: household([ANA, ...kids]), records });
    expect(p.people).toHaveLength(4);
    expect(p.people.filter((x) => x.step?.kind === 'suggest')).toHaveLength(2);
    expect(stepOf(p, TEEN.id)?.kind).toBe('check-in');
  });

  it('fails safe when records cannot be loaded: nothing new, no resurfaced dismissals', () => {
    const p = buildDevelopmentPlan({ household: household([ANA, MIA, NOAH]), records: null, today: TODAY });
    expect(p.unavailable).toBe(true);
    expect(p.people.every((x) => x.step === null)).toBe(true);
    expect(buildDevelopmentPlan({ household: null, records: null, today: TODAY })).toMatchObject({ unavailable: true, people: [] });
  });

  it('keeps records for skills the library no longer knows, in the family\'s words', () => {
    const r = rec({ memberId: MIA.id, skillId: 'retired-skill', title: 'Feed the fish', stage: 'assist', lastCheckInOn: '2026-11-01' });
    const s = stepOf(plan({ household: household([ANA, MIA]), records: [r] }), MIA.id) as CheckInStep;
    expect(s.skill).toBeNull();
    expect(s.question.text).toMatch(/Feed the fish/);
    expect(s.coaching).toMatch(/together/);
  });

  it('ignores archived members and other people\'s records', () => {
    const gone = { ...NOAH, archived: true };
    const p = plan({ household: household([ANA, MIA, gone]), records: [rec({ memberId: 'someone-else', skillId: 'bed', stage: 'watch' })] });
    expect(p.people.map((x) => x.memberId)).toEqual([MIA.id]);
    expect(stepOf(p, MIA.id)?.kind).toBe('suggest');
  });

  it('asks a different kind of question per stage: skill, habit, ownership', () => {
    expect(checkInQuestion({ stage: 'assist', title: 'Set the table' }, 'Mia').signal).toBe('performance');
    expect(checkInQuestion({ stage: 'watch', title: 'Set the table', cue: 'When dinner starts' }, 'Mia').text).toMatch(/when dinner starts.*without a reminder/);
    expect(checkInQuestion({ stage: 'launch', title: 'Set the table' }, 'Mia').signal).toBe('ownership');
  });
});

describe('crosswalks into the existing family profile', () => {
  it('maps onboarding growth items to curated skills without forcing homework', () => {
    expect(skillForGrowthItem('pack-school-bag', 8)).toBe('school-bag');
    expect(skillForGrowthItem('tidy-room', 6)).toBe('floor');
    expect(skillForGrowthItem('tidy-room', 12)).toBe('room');
    expect(skillForGrowthItem('homework-start', 9)).toBeNull();
    for (const item of ['morning-routine', 'bedtime-routine', 'pack-school-bag', 'tidy-room', 'put-away-laundry', 'help-with-meals', 'own-belongings', 'pet-care']) {
      for (const age of [5, 9, 13]) expect(skillById(skillForGrowthItem(item, age)!), `${item} ${age}`).not.toBeNull();
    }
  });

  it('files every skill\'s agreement under a category the database accepts', () => {
    const allowed = ['meals', 'laundry', 'cleaning', 'transportation', 'belongings', 'school-prep', 'homework', 'pet-care', 'routines', 'other'];
    for (const s of skills) expect(allowed).toContain(responsibilityCategoryOf(s));
    expect(skillAgreementSource('school-bag')).toMatch(/^[A-Za-z0-9:_.-]+$/); // agreed_source check in 20261127
  });
});
