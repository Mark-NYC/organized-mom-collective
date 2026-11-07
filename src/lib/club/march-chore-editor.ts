/**
 * The March chore chart editor, one implementation for the desktop dialog (MarchChoreCharts.astro) and the phone edit
 * sheets (MarchPlanMobile.astro). It only changes the plan through the printable's controller (`clubPlan`); after
 * each change it calls `redraw` so the open editor shows the new state. Styles: `.mcc-ed*` in MarchChoreCharts.astro.
 */
import { el } from './plan/dom';
import {
  DAILY_MAX, TEXT_LIMIT, addDaily, ageOf, chartPeople, dailyChoices, removeDaily, renameJob, setChartOn, setPalette,
  setWeekly, weeklyChoices, type ChorePlan,
} from './engines/march-chore-charts';
import { toolPalettes } from '../../data/tool-palettes';

const chip = (text: string, on: boolean, pick: () => void, opts: { disabled?: boolean } = {}) => {
  const b = el('button', { type: 'button', class: 'mcc-ed-chip', disabled: Boolean(opts.disabled) }, text);
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', pick);
  return b;
};
const group = (label: string, ...kids: Node[]) => {
  const g = el('div', { class: 'mcc-ed-chips', role: 'group' }, ...kids);
  g.setAttribute('aria-label', label);
  return g;
};

/** One person's chart (a child or a grown-up): daily chores (rename, remove, add) and a chore or a day off for each weekday. */
export function kidEditor(plan: ChorePlan, kidId: string, redraw: () => void): HTMLElement {
  const p = plan;
  const m = () => p.members();
  const kid = chartPeople(p.state(), m()).find((k) => k.id === kidId);
  const chart = p.view().charts.find((c) => c.id === kidId);
  if (!kid || !chart) return el('p', {}, 'This chart isn’t in the family any more.');
  const age = ageOf(kid);
  const change = (fn: () => void) => { fn(); redraw(); };

  const daily = el('div', { class: 'mcc-ed-list' }, ...chart.daily.map((j, i) => {
    const name = el('input', { type: 'text', value: j.title, maxLength: TEXT_LIMIT });
    name.setAttribute('aria-label', `Daily chore ${i + 1}`);
    name.addEventListener('change', () => change(() => p.update((s) => renameJob(s, kidId, { daily: i }, name.value, m(), p.pets()))));
    const remove = el('button', { type: 'button', class: 'mcc-ed-remove' }, 'Remove');
    remove.setAttribute('aria-label', `Remove ${j.title}`);
    remove.addEventListener('click', () => change(() => p.update((s) => removeDaily(s, kidId, i, m(), p.pets()))));
    return el('div', { class: 'mcc-ed-row' }, name, remove);
  }));
  const present = new Set(chart.daily.map((j) => j.id));
  const full = chart.daily.length >= DAILY_MAX;
  const adds = group('Add a daily chore', ...dailyChoices(kid, p.pets()).filter((d) => !present.has(d.id))
    .map((d) => chip(`+ ${d.title}`, false, () => change(() => p.update((s) => addDaily(s, kidId, d.id, m(), p.pets()))), { disabled: full })));
  const own = el('input', { type: 'text', maxLength: TEXT_LIMIT, placeholder: 'Or type your own', disabled: full });
  own.setAttribute('aria-label', 'Your own daily chore');
  own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); own.dispatchEvent(new Event('change')); } });
  // Enter and the browser's own change both land here; clearing first keeps it to one chore.
  own.addEventListener('change', () => { const v = own.value.trim(); own.value = ''; if (v) change(() => p.update((s) => addDaily(s, kidId, `own-${Date.now().toString(36)}`, m(), p.pets(), v))); });

  const weekly = el('div', { class: 'mcc-ed-list' }, ...chart.weekly.map((w) => el('div', { class: 'mcc-ed-job' },
    el('p', { class: 'mcc-ed-day' }, el('strong', {}, w.label), ` · ${w.zone} on your calendar`),
    group(`${w.label} chore`,
      ...weeklyChoices(kid, w.day).map((d) => chip(d.title, w.job?.id === d.id, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, d.id, m(), p.pets()))))),
      chip('Day off', !w.job, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, null, m(), p.pets())))))),
  ));

  const parts: Node[] = [
    el('h3', { class: 'mcc-ed-h' }, 'Daily chores'),
    el('p', { class: 'mcc-ed-hint' }, chart.adult
      ? 'Grown-up jobs, shared out between the grown-ups so nobody carries them all. Only the chores listed here print.'
      : `Prepared for age ${age}: their own jobs plus a share of the family’s, so nobody has the same job twice. Only the chores listed here print, so fewer is fine.`),
    daily,
    el('p', { class: 'mcc-ed-label' }, full ? `${DAILY_MAX} is the most that fit. Remove one to add another.` : 'Add a daily chore'),
    adds, own,
    el('h3', { class: 'mcc-ed-h' }, 'Weekly chores'),
    el('p', { class: 'mcc-ed-hint' }, 'One a day, matched to that day’s cleaning zone on your wall calendar, or a day off.'),
    weekly,
  ];
  return el('div', { class: 'mcc-ed' }, ...parts);
}

/** The whole family's choices: the charts' colors, and which grown-ups get a chart. */
export function familyEditor(plan: ChorePlan, redraw: () => void): HTMLElement {
  const p = plan;
  const v = p.view();
  const change = (fn: () => void) => { fn(); redraw(); };
  const parts: Node[] = [
    el('h3', { class: 'mcc-ed-h' }, 'Colors'),
    group('Colors', ...Object.entries(toolPalettes).map(([id, pal]) => chip(pal.label, v.palette === id, () => change(() => p.update((s) => setPalette(s, id)))))),
  ];
  if (v.adults.length) {
    parts.push(
      el('h3', { class: 'mcc-ed-h' }, 'Charts for the grown-ups'),
      el('p', { class: 'mcc-ed-hint' }, 'The grown-ups’ share of the family jobs goes on their own chart. Leave one off and those jobs go to the other grown-ups.'),
      group('Charts for the grown-ups', ...v.adults.map((a) => chip(a.on ? `✓ ${a.name}` : a.name, a.on, () => change(() => p.update((s) => setChartOn(s, a.id, !a.on, p.members())))))));
  }
  return el('div', { class: 'mcc-ed' }, ...parts);
}
