/**
 * The January companion's quality report: for each test family, the opportunity chosen, the intake evidence, why it
 * won, what's recommended, how it can become a habit, how it builds ownership, what was left out, and the editorial
 * scorecard (A grounded, B focus, C age, D actionable habit, E ownership, F low overwhelm; 0–2 each, pass ≥ 10 with
 * no zero in A, D or E). The scores are computed by fixed rules from the generated companion, so they can't be nudged;
 * they're an editorial gate, not proof anything works in a real home.
 *
 *   npx vite-node scripts/meeting-guide-quality.ts   → docs/club/JANUARY_QUALITY.md
 */
import { writeFileSync } from 'node:fs';
import { january2027 as content } from '../src/data/club/meeting-guides/2027-01';
import { generateMeetingGuide, type MeetingGuide } from '../src/lib/club/meeting-guide/generate';
import { FAMILIES } from '../tests/fixtures/meeting-guide-families';

export function scorecard(g: MeetingGuide) {
  const primary = content.opportunities.find((o) => o.id === g.rationale.focus[0].id) ?? content.fallback;
  const ideas = g.people.flatMap((p) => p.ideas);
  const kidsWithAge = g.people.filter((p) => !p.joinsIn && p.stage !== 'child');
  const lines = [...g.focus.map((f) => f.title), ...g.talk.map((t) => t.text), ...ideas.map((i) => i.text), ...g.practice.map((t) => t.text), ...g.grownUps.map((t) => t.text)];
  const A = primary === content.fallback ? 1 : ideas.every((i) => i.source === 'desired' || primary.items.includes(i.itemId)) ? 2 : 1;
  const B = g.focus.length <= 2 && ideas.every((i) => i.source === 'desired' || primary.items.includes(i.itemId)) && g.talk.length <= 4 ? 2 : 1;
  const C = !ideas.length ? (kidsWithAge.length ? 1 : 1) : g.people.some((p) => p.stage === 'child') ? 1 : 2;
  const adjustment = g.practice.some((p) => p.key.startsWith('practice:obstacle') || p.key.startsWith('practice:setup') || p.key === 'practice:meeting');
  // A practical action with a cue: every child idea has one, and there's an adjustment (or January's meeting habit).
  const D = ideas.every((i) => i.cue) && adjustment ? 2 : (ideas.length || adjustment) ? 1 : 0;
  const asks = g.talk.some((t) => t.key.startsWith('talk:ask:')) || Boolean(g.partsDiscover);
  const E = asks && (g.people.some((p) => p.choose) || g.people.every((p) => !p.ideas.length || p.support) ) ? 2 : g.talk.some((t) => t.key === 'talk:invite') ? 1 : 0;
  const F = new Set(lines).size === lines.length && ideas.length <= Math.max(3, g.people.length * 2) && g.practice.length <= 2 ? 2 : 1;
  const total = A + B + C + D + E + F;
  return { A, B, C, D, E, F, total, pass: total >= 10 && A > 0 && D > 0 && E > 0 };
}

/** The editor's own read of each result, where it differs from or adds to the computed score. */
const REVIEW: Record<string, { score?: number; note: string }> = {
  'preschool-support': { note: 'Coherent: the evening focus, Tobi’s coat-and-shoes habit for coming home, the low hook to make it easy, “together first” support. The opening question and opportunity line are the theme’s, not specific to toddlers.' },
  'fewer-reminders': { note: 'Strongest result: her priority, challenge and both named wishes line up; each child gets a cue-based habit and a question; Mira’s pet care is noticed, not added to.' },
  'mixed-ages': { score: 11, note: 'Choice (from her “sharing fairly” answer) means Leo and Jade each see two ideas: five ideas across three children is the heaviest page. Justified by her answer, but it’s the most to read.' },
  'busy-schedules': { note: 'Uses her own activity (robotics) and both challenges; Elsa’s calendar-and-rides habit and Nils’s gear spot address the actual friction.' },
  mornings: { note: 'Focused on mornings; the setup (picture list) replaced the generic “one step” adjustment the first draft repeated.' },
  resistance: { note: 'Her own words lead the focus, with the matched theme’s purpose under it (the work is spread, the kids choose their part). Choice is the right lever for push-back, and each child’s own wish comes first. The first draft had no purpose line under her words; added.' },
  independent: { note: 'Grace is recognized and asked to show how instead of getting more; Owen gets the bag habit with a hook at his height.' },
  'many-priorities': { note: 'Disciplined: one focus from five challenges plus a priority; each child’s named wish is kept; laundry and tidying wishes are left for later.' },
  vague: { note: 'Below a strong result by design: no ages and no answers, so no child ideas and a generic focus. It asks instead of guessing and offers January’s own meeting habit. Limited by intake, not fixable without guessing.' },
  'one-challenge': { note: 'Asks the children which job needs reminders instead of picking jobs for them, then offers the cue. Not age-specific (C 1) because she named no jobs.' },
};

const PRINCIPLE: Record<string, string> = { trigger: 'a clear cue', stacking: 'stacked on an existing routine', environment: 'a change to the home', simplicity: 'a smaller step', ownership: 'choice', feedback: 'visible progress', consistency: 'a regular time' };
const out: string[] = [
  '# January companion: quality report',
  '',
  'Generated by `scripts/meeting-guide-quality.ts` from `tests/fixtures/meeting-guide-families.ts` (made-up families). Scores are computed by fixed rules from each generated companion. They\'re an editorial quality gate, not evidence that a recommendation will work in a real home.',
  '',
  '| # | Family | Focus chosen | A | B | C | D | E | F | Computed | Editor | Pass |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
const details: string[] = [];
FAMILIES.forEach((f, n) => {
  const g = generateMeetingGuide({ household: f.household, profile: f.profile, content });
  const s = scorecard(g);
  const editor = REVIEW[f.key]?.score ?? s.total;
  out.push(`| ${n + 1} | ${f.label.replace(/^\d+ · /, '')} | ${g.focus.map((x) => x.title).join(' + ')} | ${s.A} | ${s.B} | ${s.C} | ${s.D} | ${s.E} | ${s.F} | **${s.total}** | ${editor} | ${s.pass ? 'yes' : '**no**'} |`);
  const r = g.rationale;
  details.push(
    `## ${f.label}`,
    '',
    `**Highest-impact opportunity:** ${g.focus[0].title}${g.focus[1] ? ` (second: ${g.focus[1].title})` : ''}`,
    '',
    `**Intake evidence:** ${r.focus[0].evidence.length ? r.focus[0].evidence.join('; ') : 'none: no priority, challenge or wish, so the month’s own purpose and discovery questions'}`,
    '',
    `**Why it won:** score ${r.focus[0].score} (relevance ${r.focus[0].parts.relevance}, impact ${r.focus[0].parts.impact}, readiness ${r.focus[0].parts.readiness}, habit ${r.focus[0].parts.habit})${r.considered.length ? `. Also considered: ${r.considered.map((c) => `${c.id} ${c.score}`).join(', ')}.` : '.'}`,
    '',
    '**Strongest recommendations:**',
    ...g.people.filter((p) => p.ideas.length).map((p) => `- ${p.name} (${p.age ?? 'age not given'}): ${p.ideas.map((i) => i.text).join(' **or** ')}`),
    ...(g.partsDiscover ? [`- ${g.partsDiscover}`] : []),
    ...g.practice.map((t) => `- ${t.text}`),
    '',
    `**How it can become a habit:** ${[...new Set(g.people.flatMap((p) => p.ideas.map((i) => `${p.name}: “${i.cue}”, ${PRINCIPLE[i.principle]}`)))].join('; ') || 'a regular meeting time stacked on a weekly routine'}.`,
    '',
    `**How it builds ownership:** ${[...g.talk.filter((t) => t.key.startsWith('talk:ask:')).map((t) => t.text), ...(g.people.some((p) => p.choose) ? ['children 6+ choose between two ideas'] : []), ...g.people.filter((p) => p.keeps).map((p) => p.keeps!)].join(' · ') || 'the children are asked what they’d like to take on'}. Support fades by age (${[...new Set(g.people.filter((p) => p.ideas.length).map((p) => p.support))].join(' / ') || 'n/a'}).`,
    '',
    `**Left out:** ${[...r.considered.map((c) => `${c.id} (score ${c.score})`), ...r.children.flatMap((c) => c.excluded.map((e) => `${c.name}: ${e}`))].join('; ') || 'nothing else applied'}.`,
    '',
    `**Score:** A ${s.A} · B ${s.B} · C ${s.C} · D ${s.D} · E ${s.E} · F ${s.F} = **${s.total}/12** computed${REVIEW[f.key]?.score ? `, **${REVIEW[f.key].score}/12** on review` : ''} ${s.pass ? '(pass)' : '(below standard)'}`,
    '',
    `**Editor’s review:** ${REVIEW[f.key]?.note ?? ''}`,
    '',
  );
});
const WEAKEST = [
  '## Weakest first-draft results and what changed',
  '',
  '| Family | First draft | Change (generator rule, not a per-family tweak) |',
  '| --- | --- | --- |',
  '| 1 Preschoolers | A second focus (mornings) built from the same “routines” answer as the first; a card for the 2-year-old just to show the name; a 4-year-old asked “which things go missing most often” | A second focus needs 4+ points of evidence the first didn’t use; little ones join through Let’s Talk, no card; discovery questions go to children 6+ (preschoolers: do it together first) |',
  '| 3 Mixed ages | The same discovery question printed under each of three children; a second focus from the same tidy-room wish | Questions move to Let’s Talk, one per idea naming every child it fits; the independent-evidence rule |',
  '| 5 Mornings | Practice repeated “each child takes one step”, which one idea per child already is | When the page already applies the obstacle’s principle (smaller step, or choice), Practice offers the setup that makes an idea easier |',
  '| 6 Resistance | “Let each child choose” repeated under Practice; her own words with no purpose line under them | Same rule as 5; the matched theme’s purpose shows under her own words |',
  '| 7 Independent | The opening question and the discovery question were near-duplicates (“forget for school” / “goes missing on a school morning”) | Every discovery question now explores what gets in the way, with options, instead of restating the topic |',
  '| 9 Limited intake | Two children with no ages got the identical guessed idea; no actionable habit at all | No ideas without ages or answers: the children are asked; January’s own meeting habit (stacked on a weekly routine) is offered |',
  '| 10 One challenge | Each child got a calendar idea she never mentioned | A focus that doesn’t say which job (fewer reminders) asks the children which job needs reminders, then offers the cue |',
  '| Any | Two challenges outranked her stated top priority on a tie | Ties go to her top priority |',
  '',
  'Remaining limitations: families 9 and 10 can’t be age-specific because she named no ages or jobs (C 1); the grown-ups’ question is the same for every family; the theme’s opening question and opportunity line are shared by every family with that focus. A sweep test checks the rules for every priority × challenge combination, not just these ten families.',
  '',
];
writeFileSync('docs/club/JANUARY_QUALITY.md', [...out, '', ...WEAKEST, ...details].join('\n'));
console.log(out.slice(4).join('\n'));
