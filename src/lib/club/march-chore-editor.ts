/**
 * The March chore chart editor, one implementation for the desktop dialog (MarchChoreCharts.astro) and the phone edit
 * sheets (MarchPlanMobile.astro). It only changes the plan through the printable's controller (`clubPlan`); after
 * each change it calls `redraw` so the open editor shows the new state. Styles: `.mcc-ed*` in MarchChoreCharts.astro.
 */
import { el } from './plan/dom';
import {
  DAILY_CHORES, DAILY_MAX, TEXT_LIMIT, ZONE_CHORES, REWARD_STEPS, addDaily, ageOf, kidsOf, removeDaily, renameJob,
  setPalette, setReward, setRewards, setWeekly, type ChorePlan,
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

/** One child's chart: daily chores (rename, remove, add), a chore for each weekday, rewards. */
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
    name.setAttribute('aria-label', `Daily chore ${i + 1}`);
    name.addEventListener('change', () => change(() => p.update((s) => renameJob(s, kidId, { daily: i }, name.value, m(), p.pets()))));
    const remove = el('button', { type: 'button', class: 'mcc-ed-remove' }, 'Remove');
    remove.setAttribute('aria-label', `Remove ${j.title}`);
    remove.addEventListener('click', () => change(() => p.update((s) => removeDaily(s, kidId, i, m(), p.pets()))));
    return el('div', { class: 'mcc-ed-row' }, name, remove);
  }));
  const present = new Set(chart.daily.map((j) => j.id));
  const full = chart.daily.length >= DAILY_MAX;
  const adds = group('Add a daily chore', ...DAILY_CHORES.filter((d) => !present.has(d.id) && d.minAge <= age + 1 && (d.id !== 'feed-pets' || p.pets()))
    .map((d) => chip(`+ ${d.title}`, false, () => change(() => p.update((s) => addDaily(s, kidId, d.id, m(), p.pets()))), { disabled: full })));
  const own = el('input', { type: 'text', maxLength: TEXT_LIMIT, placeholder: 'Or type your own', disabled: full });
  own.setAttribute('aria-label', 'Your own daily chore');
  own.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); own.dispatchEvent(new Event('change')); } });
  // Enter and the browser's own change both land here; clearing first keeps it to one chore.
  own.addEventListener('change', () => { const v = own.value.trim(); own.value = ''; if (v) change(() => p.update((s) => addDaily(s, kidId, `own-${Date.now().toString(36)}`, m(), p.pets(), v))); });

  const weekly = el('div', { class: 'mcc-ed-list' }, ...chart.weekly.map((w) => el('div', { class: 'mcc-ed-job' },
    el('p', { class: 'mcc-ed-day' }, el('strong', {}, w.label), ` · ${w.zone} on your calendar`),
    group(`${w.label} chore`,
      ...ZONE_CHORES[w.day].filter((d) => d.minAge <= age + 1).map((d) => chip(d.title, w.job?.id === d.id, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, d.id, m(), p.pets()))))),
      chip('Day off', !w.job, () => change(() => p.update((s) => setWeekly(s, kidId, w.day, null, m(), p.pets())))))),
  ));

  const parts: Node[] = [
    el('h3', { class: 'mcc-ed-h' }, 'Daily chores'),
    el('p', { class: 'mcc-ed-hint' }, `Prepared for age ${age}. Fewer is fine; empty rows print blank to write in.`),
    daily,
    el('p', { class: 'mcc-ed-label' }, full ? `${DAILY_MAX} is the most that fit. Remove one to add another.` : 'Add a daily chore'),
    adds, own,
    el('h3', { class: 'mcc-ed-h' }, 'Weekly chores'),
    el('p', { class: 'mcc-ed-hint' }, 'One a day, matched to that day’s cleaning zone on your wall calendar.'),
    weekly,
  ];
  if (p.view().rewards) {
    parts.push(el('h3', { class: 'mcc-ed-h' }, 'Rewards'), el('div', { class: 'mcc-ed-rewards' }, ...chart.rewardLines.map((r, i) => {
      const input = el('input', { type: 'text', value: r, maxLength: TEXT_LIMIT });
      input.addEventListener('change', () => change(() => p.update((s) => setReward(s, kidId, i, input.value, m(), p.pets()))));
      return el('label', { class: 'mcc-ed-field' }, el('span', {}, `Complete ${REWARD_STEPS[i]}`), input);
    })));
  }
  return el('div', { class: 'mcc-ed' }, ...parts);
}

/** The whole family's choices: rewards on or off, colors. */
export function familyEditor(plan: ChorePlan, redraw: () => void): HTMLElement {
  const p = plan;
  const v = p.view();
  const change = (fn: () => void) => { fn(); redraw(); };
  return el('div', { class: 'mcc-ed' },
    el('h3', { class: 'mcc-ed-h' }, 'Rewards'),
    group('Rewards', chip('Show rewards', v.rewards, () => change(() => p.update((s) => setRewards(s, true)))), chip('No rewards', !v.rewards, () => change(() => p.update((s) => setRewards(s, false))))),
    el('h3', { class: 'mcc-ed-h' }, 'Colors'),
    group('Colors', ...Object.entries(toolPalettes).map(([id, pal]) => chip(pal.label, v.palette === id, () => change(() => p.update((s) => setPalette(s, id)))))));
}
