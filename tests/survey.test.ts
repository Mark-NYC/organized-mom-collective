import { describe, expect, it } from 'vitest';
import { isComplete, surveyQuestions, toggleMulti, type ChoiceQuestion } from '../src/data/survey';
import { answerCounts, funnel, responsesCsv, type ResponseRow } from '../src/lib/survey';
import { isAppPath, routes } from '../src/routes';

const q3 = surveyQuestions.find((q) => q.id === 'q3') as ChoiceQuestion;

const row = (over: Partial<ResponseRow> = {}): ResponseRow => ({
  session_id: 's1',
  created_at: '2026-10-09T12:00:00Z',
  q1: ['paper', 'in_my_head'],
  q2: 'scattered',
  q3: ['email'],
  q4: 'every_week',
  q5: 'routine',
  q6: 'one_place',
  q7: null,
  duration_seconds: 75,
  ...over,
});

describe('survey questions', () => {
  it('has six choice questions and one optional open question, with unique option ids', () => {
    expect(surveyQuestions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
    for (const q of surveyQuestions) {
      if (q.kind === 'text') continue;
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });

  it('matches the answer ids the database accepts', () => {
    const files = import.meta.glob<string>('../supabase/migrations/*_customer_survey.sql', { query: '?raw', import: 'default', eager: true });
    const sql = Object.values(files).join('\n');
    expect(sql).toContain('survey_allowed');
    for (const q of surveyQuestions) {
      if (q.kind === 'text') continue;
      const m = sql.match(new RegExp(`when '${q.id}' then array\\[([^\\]]+)\\]`));
      expect(m, q.id).not.toBeNull();
      const ids = m![1].split(',').map((s: string) => s.trim().replace(/'/g, ''));
      expect(ids, q.id).toEqual(q.options.map((o) => o.id));
    }
  });

  it('keeps "Not applicable" on its own', () => {
    expect(toggleMulti(q3, ['email', 'text'], 'na')).toEqual(['na']);
    expect(toggleMulti(q3, ['na'], 'email')).toEqual(['email']);
    expect(toggleMulti(q3, ['email', 'text'], 'email')).toEqual(['text']);
  });

  it('needs every choice question answered; the open question is optional', () => {
    const { q7: _, ...answers } = row();
    expect(isComplete(answers)).toBe(true);
    expect(isComplete({ ...answers, q3: [] })).toBe(false);
    expect(isComplete({ ...answers, q6: undefined })).toBe(false);
  });

  it('lives on the public site, outside the app scope', () => {
    expect(routes.survey).toBe('/survey');
    expect(isAppPath(routes.survey)).toBe(false);
    expect(isAppPath(routes.surveyAdmin)).toBe(false);
  });
});

describe('survey stats', () => {
  it('counts starts, completions and where people stop', () => {
    const f = funnel([0, 0, 1, 3, 3, 7, 8, 8].map((furthest_step) => ({ furthest_step })));
    expect(f.views).toBe(8);
    expect(f.starts).toBe(6);
    expect(f.completions).toBe(2);
    expect(f.completionRate).toBeCloseTo(2 / 6);
    expect(f.steps.map((s) => s.leftHere)).toEqual([1, 0, 2, 0, 0, 0, 1]);
    expect(f.steps.map((s) => s.reached)).toEqual([6, 5, 5, 3, 3, 3, 3]);
  });

  it('counts answers as a share of respondents', () => {
    const counts = answerCounts([row(), row({ session_id: 's2', q1: ['paper'], q2: 'other' })]);
    const q1 = counts.find((c) => c.question.id === 'q1')!.counts;
    expect(q1.find((c) => c.id === 'paper')).toMatchObject({ count: 2, share: 1 });
    expect(q1.find((c) => c.id === 'in_my_head')).toMatchObject({ count: 1, share: 0.5 });
    expect(counts).toHaveLength(6);
  });

  it('exports CSV with labels, quoting and formula-safe free text', () => {
    const csv = responsesCsv([row({ q7: '=HYPERLINK("x")\nthen, "oops"' })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('q1 Schedule tools');
    expect(lines[1]).toContain('Paper wall calendar or planner; Mostly keeping it in my head');
    expect(csv).toContain(`"'=HYPERLINK(""x"")\nthen, ""oops"""`);
  });
});
