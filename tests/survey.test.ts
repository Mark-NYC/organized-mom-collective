import { describe, expect, it } from 'vitest';
import { cleanAnswers, isComplete, normalizeSource, SURVEY_SOURCES, surveyQuestions, toggleMulti, type ChoiceQuestion } from '../src/data/survey';
import { answerCounts, funnel, responsesCsv, type ResponseRow } from '../src/lib/survey';
import { isAppPath, routes } from '../src/routes';

const q3 = surveyQuestions.find((q) => q.id === 'q3') as ChoiceQuestion;

const row = (over: Partial<ResponseRow> = {}): ResponseRow => ({
  session_id: 's1',
  created_at: '2026-10-09T12:00:00Z',
  q1: ['paper', 'in_my_head'],
  q2: 'paper_calendar',
  q3: ['email'],
  q4: 'every_week',
  q5: 'routine',
  q6: 'tracking',
  q7: null,
  q1_other: null,
  q2_other: null,
  q3_other: null,
  q5_other: null,
  q6_other: null,
  source: 'direct',
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

  const files = import.meta.glob<string>('../supabase/migrations/*_customer_survey.sql', { query: '?raw', import: 'default', eager: true });
  const sql = Object.values(files).join('\n');

  it('matches the answer ids the database accepts', () => {
    expect(sql).toContain('survey_allowed');
    for (const q of surveyQuestions) {
      if (q.kind === 'text') continue;
      const m = sql.match(new RegExp(`when '${q.id}' then array\\[([^\\]]+)\\]`));
      expect(m, q.id).not.toBeNull();
      const ids = m![1].split(',').map((s: string) => s.trim().replace(/'/g, ''));
      expect(ids, q.id).toEqual(q.options.map((o) => o.id));
    }
  });

  it('matches the sources the database accepts', () => {
    const list = `(${SURVEY_SOURCES.map((x) => `'${x}'`).join(',')})`;
    expect(sql.match(new RegExp(`check \\(source in ${list.replace(/[()]/g, '\\$&')}\\)`, 'g'))).toHaveLength(2);
    expect(sql).toContain(`array[${SURVEY_SOURCES.map((x) => `'${x}'`).join(',')}]`);
  });

  it('asks Q2 about behavior, Q6 about pain, and Q7 about a hard week', () => {
    const q2 = surveyQuestions.find((q) => q.id === 'q2') as ChoiceQuestion;
    expect(q2.kind).toBe('single');
    expect(q2.prompt).toBe('When you get an email or message about a school event, appointment, or activity, what do you usually do?');
    expect(q2.options.map((o) => o.label)).toEqual([
      'Add it to my phone’s calendar',
      'Write it on our paper calendar',
      'Save or flag the message for later',
      'Tell myself I’ll remember it',
      'Share it with my spouse or family',
      'Something else',
    ]);
    const q6 = surveyQuestions.find((q) => q.id === 'q6') as ChoiceQuestion;
    expect(q6.prompt).toBe('Which part of managing your home or family takes the most mental energy?');
    expect(q6.options.map((o) => o.label)).toEqual([
      'Keeping track of appointments and activities',
      'Sorting through school and activity messages',
      'Keeping up with cleaning and household tasks',
      'Planning the week and keeping everyone informed',
      'Managing last-minute schedule changes',
      'Something else',
    ]);
    expect(surveyQuestions[6].prompt).toBe('Think of a recent week that felt hard to manage. What made it difficult?');
  });

  it('offers a "Something else" field wherever that option appears, with a matching database column', () => {
    for (const q of surveyQuestions) {
      if (q.kind === 'text' || !q.options.some((o) => o.label === 'Something else')) continue;
      expect(q.options.find((o) => o.label === 'Something else')!.id).toBe('other');
      expect(sql).toContain(`${q.id}_other text check (char_length(${q.id}_other) <= 200)`);
    }
  });

  it('normalizes ?source=', () => {
    expect(normalizeSource(null)).toBe('direct');
    expect(normalizeSource('  ')).toBe('direct');
    expect(normalizeSource('Instagram')).toBe('instagram');
    expect(normalizeSource('customer-insert')).toBe('customer-insert');
    expect(normalizeSource('tiktok')).toBe('other');
    expect(normalizeSource('<script>')).toBe('other');
  });

  it('sends "Something else" text only for questions where it is picked', () => {
    const out = cleanAnswers({
      q1: ['paper', 'other'],
      q1_other: '  Fridge whiteboard  ',
      q2: 'remember',
      q2_other: 'typed, then changed answer',
      q3: ['other'],
      q3_other: '   ',
      q6_other: 'x'.repeat(500),
      q6: 'other',
      q7: '  ',
    });
    expect(out.q1_other).toBe('Fridge whiteboard');
    expect(out).not.toHaveProperty('q2_other');
    expect(out).not.toHaveProperty('q3_other');
    expect(out.q6_other).toHaveLength(200);
    expect(out).not.toHaveProperty('q7');
  });

  it('keeps "Not applicable" on its own', () => {
    expect(toggleMulti(q3, ['email', 'text'], 'na')).toEqual(['na']);
    expect(toggleMulti(q3, ['na'], 'email')).toEqual(['email']);
    expect(toggleMulti(q3, ['email', 'text'], 'email')).toEqual(['text']);
  });

  it('needs every choice question answered; the open question is optional', () => {
    const { q1, q2, q3, q4, q5, q6 } = row();
    const answers = { q1, q2, q3, q4, q5, q6 };
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
    const csv = responsesCsv([row({ q7: '=HYPERLINK("x")\nthen, "oops"', q1: ['other'], q1_other: 'Fridge whiteboard', source: 'instagram' })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('source,q1 Schedule tools,q1 something else,q2 What she does with a new message,q2 something else');
    expect(lines[0]).toContain('q4 Weekly planning,q5 Cleaning approach');
    expect(lines[1]).toContain('instagram,Something else,Fridge whiteboard,');
    const csv2 = responsesCsv([row()]);
    expect(csv2.split('\r\n')[1]).toContain('Paper wall calendar or planner; Mostly keeping it in my head');
    expect(csv).toContain(`"'=HYPERLINK(""x"")\nthen, ""oops"""`);
  });
});
