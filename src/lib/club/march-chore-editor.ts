/**
 * The March chore chart editor, one implementation for the desktop dialog (MarchChoreCharts.astro) and the phone edit
 * sheets (MarchPlanMobile.astro). It only changes the plan through the printable's controller (`clubPlan`); after
 * each change it calls `redraw` so the open editor shows the new state. Styles: `.mcc-ed*` in MarchChoreCharts.astro.
 */
import { el } from './plan/dom';
import {
  DAILY_CHORES, DAILY_MAX, LEVELS, LEVEL_TEXT, TEXT_LIMIT, ZONE_CHORES, addDaily, ageOf, kidsOf, removeDaily, renameJob,
  setDailyLevel, setPalette, setReward, setRewards, setWeekly, setWeeklyLevel, toggleTurn, type ChorePlan, type Level,
} from './engines/march-chore-charts';
import { toolPalettes } from '../../data/tool-palettes';

const chip = (text: string, on: boolean, pick: () => void, opts: { disabled?: boolean; label?: string } = {}) => {
  const b = el('button', { type: 'button', class: 'mcc-ed-chip', disabled: Boolean(opts.disabled) }, text);
  b.setAttribute('aria-pressed', String(on));
  if (opts.label) b.setAttribute('aria-label', opts.label);
  b.addEventListener('click', pick);
  return b;
};
const group = (label: string, ...kids: Node[]) => {
  const g = el('div', { class: 'mcc-ed-chips', role: 'group' }, ...kids);
  g.setAttribute('aria-label', label);
  return g;
};
const levelChips = (label: string, current: Level, pick: (l: Level) => void) =>
  group(label, ...LEVELS.map((l) => chip(LEVEL_TEXT[l], l === current, () => pick(l), { label: `${label}: ${LEVEL_TEXT[l]}` })));

/** One child's jobs: daily (level, rename, remove, add), one job a day in the calendar's zones, rewards. */
export function kidEditor(plan: ChorePlan, kidId: string, redraw: () => void): HTMLElement {
  const p = plan;
  const m = () => p.members();
  const kid = kidsOf(m()).find((k) => k.id === kidId);
  const chart = p.view().charts.find((c) => c.id === kidId);
  if (!kid || !chart) return el('p', {}, 'This child isn’t in the family profile any more.');
  const age = ageOf(kid);
  const change = (fn: () => void) => { fn(); redraw(); };

  const daily = el('div', { class: 'mcc-ed-list' }, ...chart.daily.map((j, i) => {
    const name = el('input', { type: 'text', value: j.title, maxLength: TEXT_LIMIT });
    name.setAttribute('aria-label', `Daily job ${i + 1}`);
    name.addEventListener('change', () => change(() => p.update((s) => renameJob(s, kidId, { daily: i }, name.value, m(), p.pets()))));
    const remove = el('button', { type: 'button', class: 'mcc-ed-remove' }, 'Remove');
    remove.setAttribute('aria-label', `Remove ${j.title}`);
    remove.addEventListener('click', () => change(() => p.update((s) => removeDaily(s, kidId, i, m(), p.pets()))));
    return el('div', { class: 'mcc-ed-job' }, el('div', { class: 'mcc-ed-job-head' }, name, remove),
      levelChips(`${j.title} level`, j.level, (l) => change(() => p.update((s) => setDailyLevel(s, kidId, i, l, m(), p.pets())))));
  }));
  const present = new Set(chart.daily.map((j) => j.id));
  const full = chart.daily.length >= DAILY_MAX;
  const adds = group('Add a daily job', ...DAILY_CHORES.filter((d) => !present.has(d.id) && d.minAge <= age + 1 && (d.id !== 'feed-pets' || p.pets()))
    .map((d) => chip(`+ ${d.title}`, false, () => change(() => p.update((s) => addDaily(s, kidId, d.id, m(), p.pets()))), { disabled: full })));
  const own = el('input', { type: 'text', maxLength: TEXT_LIMIT, placeholder: 'Or type your own job', disabled: full });
  own.setAttribute('aria-label', 'Your own daily job');
  own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); own.dispatchEvent(new Event('change')); } });
  own.addEventListener('change', () => { const v = own.value.trim(); if (v) change(() => p.update((s) => addDaily(s, kidId, `own-${Date.now().toString(36)}`, m(), p.pets(), v))); });

  const weekly = el('div', { class: 'mcc-ed-list' }, ...chart.weekly.map((w) => {
    const options = ZONE_CHORES[w.day].filter((d) => d.minAge <= age + 1);
    const pick = group(`${w.label} job`,
      ...options.map((d) => chip(d.title, w.job?.id === d.id, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, d.id, m(), p.pets()))))),
      chip('No job', !w.job, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, null, m(), p.pets())))));
    const parts: Node[] = [el('p', { class: 'mcc-ed-day' }, el('strong', {}, w.label), ` · ${w.zone}`), pick];
    if (w.job) parts.push(levelChips(`${w.label} job level`, w.job.level, (l) => change(() => p.update((s) => setWeeklyLevel(s, kidId, w.day, l, m(), p.pets())))));
    return el('div', { class: 'mcc-ed-job' }, ...parts);
  }));

  const parts: Node[] = [
    el('h3', { class: 'mcc-ed-h' }, 'Every day'),
    el('p', { class: 'mcc-ed-hint' }, `Up to ${DAILY_MAX}, prepared for age ${age}. The level shows on the chart, so ${kid.firstName} can see what they’re learning and what they own.`),
    daily,
    el('p', { class: 'mcc-ed-label' }, full ? `${DAILY_MAX} jobs is the most that fit. Remove one to add another.` : 'Add a daily job'),
    adds, own,
    el('h3', { class: 'mcc-ed-h' }, 'One job a day, with our calendar'),
    el('p', { class: 'mcc-ed-hint' }, 'Each day’s job is in that day’s cleaning zone on your wall calendar.'),
    weekly,
  ];
  if (p.view().rewards) {
    const labels = ['Half the week done', 'Most of the week done', 'The whole week done'];
    parts.push(el('h3', { class: 'mcc-ed-h' }, 'Rewards'), el('div', { class: 'mcc-ed-rewards' }, ...chart.rewardLines.map((r, i) => {
      const input = el('input', { type: 'text', value: r, maxLength: TEXT_LIMIT });
      input.addEventListener('change', () => change(() => p.update((s) => setReward(s, kidId, i, input.value, m(), p.pets()))));
      return el('label', { class: 'mcc-ed-field' }, el('span', {}, labels[i]), input);
    })));
  }
  return el('div', { class: 'mcc-ed' }, ...parts);
}

/** The whole family's choices: who takes turns with family jobs, rewards on or off, colors. */
export function familyEditor(plan: ChorePlan, redraw: () => void): HTMLElement {
  const p = plan;
  const v = p.view();
  const change = (fn: () => void) => { fn(); redraw(); };
  const turns = el('div', { class: 'mcc-ed-list' }, ...v.sharedOptions.map((o) => el('div', { class: 'mcc-ed-job' },
    el('p', { class: 'mcc-ed-day' }, el('strong', {}, o.title), o.who.length >= 2 ? ' · taking turns' : ' · not shared'),
    o.able.length < 2
      ? el('p', { class: 'mcc-ed-hint' }, 'Needs two children old enough for it.')
      : group(`${o.title}: who takes turns`, ...o.able.map((k) => chip(k.name, o.who.includes(k.id), () => change(() => p.update((s) => toggleTurn(s, o.id, k.id, p.members(), p.pets())))))))));
  return el('div', { class: 'mcc-ed' },
    el('h3', { class: 'mcc-ed-h' }, 'We take turns'),
    el('p', { class: 'mcc-ed-hint' }, 'Family jobs rotate week by week, so no one is stuck with the trash. Each chart shows whose week it is.'),
    turns,
    el('h3', { class: 'mcc-ed-h' }, 'Rewards'),
    group('Rewards', chip('Show rewards', v.rewards, () => change(() => p.update((s) => setRewards(s, true)))), chip('No rewards', !v.rewards, () => change(() => p.update((s) => setRewards(s, false))))),
    el('p', { class: 'mcc-ed-hint' }, 'Optional. The growth levels on each job are the main reward.'),
    el('h3', { class: 'mcc-ed-h' }, 'Colors'),
    group('Colors', ...Object.entries(toolPalettes).map(([id, pal]) => chip(pal.label, v.palette === id, () => change(() => p.update((s) => setPalette(s, id)))))));
}
