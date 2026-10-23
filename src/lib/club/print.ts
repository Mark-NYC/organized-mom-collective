/**
 * Printing a Club printable: US Letter, one printable at a time, from the browser's own print dialog ("Save as PDF"
 * on every phone and computer). No server, no PDF library.
 *
 * The family chart is a landscape page of person cards. chartLayout() picks columns and a density so a typical family
 * fits one page and a very long chart stays readable over two, never shrinking type below DENSITY.tight.
 */

/** US Letter landscape, inside the 0.35in print margins. */
export const PAGE = { width: 11 - 0.7, height: 8.5 - 0.7 } as const;
/** Header band and footer line, in inches. */
const HEADER = 1.05;
const FOOTER = 0.3;
const CARD_HEAD = 0.48;
const GAP = 0.14;

/** Row heights per density, in inches (with "done means" lines only when roomy). */
export const DENSITY = {
  roomy: { row: 0.5, done: true },
  compact: { row: 0.34, done: false },
  tight: { row: 0.27, done: false },
} as const;
export type Density = keyof typeof DENSITY;

export interface ChartLayout {
  columns: number;
  cardRows: number;
  density: Density;
  /** Estimated pages at that density (1 for nearly every family). */
  pages: number;
}

/**
 * A first guess, before the browser can measure (fitChart settles it). `cards`: how many rows each person card holds
 * (plus one card for "Needs an owner", when there is one). Up to five people sit side by side; more flow into up to
 * four columns. The tallest card in each row of cards sets that row's height.
 */
export function chartLayout(cards: number[]): ChartLayout {
  const n = Math.max(cards.length, 1);
  const columns = n <= 5 ? n : Math.min(4, Math.ceil(n / Math.ceil(n / 4)));
  const groups: number[][] = [];
  for (let i = 0; i < cards.length; i += columns) groups.push(cards.slice(i, i + columns));
  const cardRows = Math.max(groups.length, 1);
  const tallest = groups.map((g) => Math.max(0, ...g));
  const heightAt = (d: Density) => tallest.reduce((t, rows) => t + CARD_HEAD + rows * DENSITY[d].row + GAP, 0);
  const room = PAGE.height - HEADER - FOOTER;
  for (const d of ['roomy', 'compact', 'tight'] as const) {
    if (heightAt(d) <= room) return { columns, cardRows, density: d, pages: 1 };
  }
  return { columns, cardRows, density: 'tight', pages: Math.ceil(heightAt('tight') / room) };
}

/** Printable height of the chart page, in CSS pixels (7.7in, inside the margins with a little room). */
const CHART_HEIGHT_PX = 7.7 * 96;

/**
 * Fit the family chart on its page by measuring it, since only the browser knows which titles wrap: the roomiest
 * density whose content fits one page wins; if even the tightest doesn't, it flows onto a second page at that size.
 * Run just before printing and when the preview opens. Returns what it chose.
 */
export function fitChart(root: HTMLElement): { density: Density; pages: number; columns: number } {
  // Measure a copy at full size, off screen: the real one is display:none until previewed or printed.
  const probe = root.cloneNode(true) as HTMLElement;
  probe.setAttribute('style', 'display:flex;position:absolute;left:-20000px;top:0;transform:none;height:auto;min-height:0');
  probe.removeAttribute('data-doc');
  document.body.appendChild(probe);
  const grid = probe.querySelector<HTMLElement>('.club-chart-grid');
  const cards = grid?.children.length ?? 1;
  // A portrait checklist says how tall its page is and which column counts to try (data-fit-*).
  const maxHeight = Number(root.dataset.fitHeight ?? 0) * 96 || CHART_HEIGHT_PX;
  const wanted = root.dataset.fitColumns?.split(',').map(Number).filter((n) => n > 0);
  const setColumns = (el: HTMLElement | null, n: number) => {
    if (el) el.style.columnCount = String(n);
  };
  // Widest first: everyone side by side when five or fewer, then four, then three columns of cards.
  const columnOptions = [...new Set((wanted?.length ? wanted : [5, 4, 3]).map((n) => Math.min(cards, n)))];
  let chosen = { density: 'tight' as Density, pages: 2, columns: Math.min(cards, 4) };
  search: for (const d of ['roomy', 'compact', 'tight'] as const) {
    probe.classList.remove('club-density-roomy', 'club-density-compact', 'club-density-tight');
    probe.classList.add(`club-density-${d}`);
    for (const columns of columnOptions) {
      setColumns(grid, columns);
      const clipped = [...probe.querySelectorAll<HTMLElement>('.club-job-title, .club-card-name')].some((t) => t.scrollWidth > t.clientWidth + 1);
      if (probe.scrollHeight <= maxHeight + 1 && !clipped) {
        chosen = { density: d, pages: 1, columns };
        break search;
      }
    }
  }
  probe.remove();
  root.classList.remove('club-density-roomy', 'club-density-compact', 'club-density-tight');
  root.classList.add(`club-density-${chosen.density}`);
  setColumns(root.querySelector<HTMLElement>('.club-chart-grid'), chosen.columns);
  root.dataset.pages = String(chosen.pages);
  return chosen;
}

const PAGE_STYLE_ID = 'club-page-size';

/**
 * Print one printable (`data-doc` on its .club-print block). Sets the page size for this print only, then puts
 * everything back after the dialog closes.
 */
export function printDocument(doc: string, orientation: 'portrait' | 'landscape') {
  const html = document.documentElement;
  document.getElementById(PAGE_STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = PAGE_STYLE_ID;
  style.textContent = `@media print { @page { size: letter ${orientation}; margin: 0.35in; } }`;
  document.head.appendChild(style);
  const chart = document.querySelector<HTMLElement>(`.club-print.club-chart[data-doc="${doc}"]:not(.club-command)`);
  if (chart) fitChart(chart);
  for (const el of document.querySelectorAll('.club-print.is-printing')) el.classList.remove('is-printing');
  const target = document.querySelectorAll<HTMLElement>(`.club-print[data-doc="${doc}"]`);
  for (const el of target) el.classList.add('is-printing');
  html.dataset.clubPrint = doc;
  const done = () => {
    delete html.dataset.clubPrint;
    for (const el of target) el.classList.remove('is-printing');
    style.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Browsers that never fire afterprint leave the attribute behind; harmless, since every rule using it is print-only,
  // and the next print replaces it.
}
