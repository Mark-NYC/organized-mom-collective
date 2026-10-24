/**
 * The worksheet's two US Letter pages as drawing operations (types.ts → Op), in points from the top-left.
 *
 * Every box has a fixed size and every personalized line is fitted into its box (text.ts → fit), so no entry can push
 * the layout, add a page or clip at the edge. A blank entry becomes a dotted line to write on.
 * Print-safe: nothing is drawn within 0.5 in of the paper's edge, no bleed.
 */
import { WORKSHEET } from './content.ts';
import { fit } from './text.ts';
import type { FontKey, Metrics, Op, Page, WorksheetData } from './types.ts';

export const PAGE_W = 612;
export const PAGE_H = 792;
/** Safe margin on every side: 0.5 in. */
export const MARGIN = 36;
const X0 = MARGIN;
const X1 = PAGE_W - MARGIN;
const W = X1 - X0;
/** Inner padding of framed sections. */
const PAD = 14;

/** Calendar palette: November header blue, charcoal type, fine gray rules, soft gray panels. */
export const COLORS = {
  ink: '#333333',
  soft: '#575757',
  faint: '#7a7a7a',
  blue: '#cddde1',
  blueRule: '#9fb9c0',
  frame: '#8c8c8c',
  hair: '#cfcfcf',
  panel: '#f3f3f2',
  dot: '#9c9c9c',
  white: '#ffffff',
} as const;

const LABEL = { font: 'sansBold' as FontKey, size: 6.6, tracking: 1.25 };
const WRITE_GAP = 24; // handwriting line spacing: 1/3 in

class Draw {
  ops: Op[] = [];
  m: Metrics;
  constructor(m: Metrics) {
    this.m = m;
  }

  width(text: string, font: FontKey, size: number, tracking = 0) {
    return this.m.width(font, text, size) + tracking * Math.max([...text].length - 1, 0);
  }
  text(x: number, y: number, text: string, font: FontKey, size: number, opts: { color?: string; align?: 'left' | 'center' | 'right'; tracking?: number } = {}) {
    const tracking = opts.tracking ?? 0;
    const w = this.width(text, font, size, tracking);
    const left = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
    this.ops.push({ t: 'text', x: left, y, text, font, size, color: opts.color ?? COLORS.ink, ...(tracking ? { tracking } : {}) });
    return w;
  }
  /** Spaced capitals, as on the printed calendar. Returns the label's width. */
  label(x: number, y: number, text: string, opts: { color?: string; align?: 'left' | 'center' | 'right'; size?: number } = {}) {
    const size = opts.size ?? LABEL.size;
    return this.text(x, y, text.toUpperCase(), LABEL.font, size, { color: opts.color ?? COLORS.soft, align: opts.align, tracking: LABEL.tracking * (size / LABEL.size) });
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, sw = 0.6) {
    this.ops.push({ t: 'rect', x, y, w, h, ...(fill ? { fill } : {}), ...(stroke ? { stroke, sw } : {}) });
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string = COLORS.hair, sw = 0.5) {
    this.ops.push({ t: 'line', x1, y1, x2, y2, color, sw });
  }
  /** A dotted writing line, like the calendar's dot grid. */
  dots(x1: number, x2: number, y: number) {
    this.ops.push({ t: 'dots', x1, x2, y, gap: 4.8, r: 0.55, color: COLORS.dot });
  }
  circle(cx: number, cy: number, r: number, fill?: string, stroke?: string, sw = 0.6) {
    this.ops.push({ t: 'circle', cx, cy, r, ...(fill ? { fill } : {}), ...(stroke ? { stroke, sw } : {}) });
  }
  box(x: number, y: number, size = 8.5) {
    this.rect(x, y, size, size, COLORS.white, COLORS.soft, 0.7);
  }
  /** Fitted multi-line text; returns the baseline after the last line. */
  block(x: number, y: number, text: string, font: FontKey, o: { width: number; maxLines: number; size: number; min: number; lead: number; color?: string; align?: 'left' | 'center' }) {
    const f = fit(this.m, font, text, o);
    f.lines.forEach((line, i) => this.text(x, y + i * f.size * o.lead, line, font, f.size, { color: o.color, align: o.align }));
    return { ...f, bottom: y + (f.lines.length - 1) * f.size * o.lead };
  }

  /** A framed section with the calendar's blue title strip ("WORD OF THE WEEK"). */
  section(y: number, h: number, number: string | null, title: string) {
    this.rect(X0, y, W, h, COLORS.white, COLORS.frame);
    this.rect(X0, y, W, 20, COLORS.blue, COLORS.frame);
    let x = X0 + PAD;
    if (number) x += this.text(x, y + 13.2, number, 'sansBold', 7, { color: COLORS.ink, tracking: 0.8 }) + 10;
    this.label(x, y + 13.2, title, { color: COLORS.ink, size: 7 });
  }

  header(center: string) {
    this.rect(X0, X0, W, 46, COLORS.blue, COLORS.frame);
    this.text(X0 + 16, X0 + 31, WORKSHEET.month, 'serifBoldItalic', 25, { color: COLORS.ink, tracking: 0.4 });
    this.text(X1 - 16, X0 + 31, WORKSHEET.year, 'serifBoldItalic', 25, { color: COLORS.ink, align: 'right', tracking: 0.4 });
    this.label(PAGE_W / 2, X0 + 26, center, { align: 'center', color: COLORS.ink, size: 6.4 });
  }

  footer(side: string) {
    const y = PAGE_H - MARGIN - 2;
    this.label(X0, y, `${WORKSHEET.brand}  ·  ${WORKSHEET.site}`, { size: 5.8, color: COLORS.faint });
    this.label(X1, y, side, { size: 5.8, color: COLORS.faint, align: 'right' });
  }
}

function front(m: Metrics, d: WorksheetData): Page {
  const g = new Draw(m);
  const t = WORKSHEET.front;
  g.header(WORKSHEET.brand);

  // Title, with the family's name in a gray panel beside it.
  g.label(X0, 114, t.eyebrow);
  g.text(X0 - 1.5, 156, t.title, 'serif', 42, { tracking: -0.6 });
  g.text(X0, 178, t.deck, 'sans', 9, { color: COLORS.soft });
  const px = 372;
  const pw = X1 - px;
  g.rect(px, 98, pw, 88, COLORS.panel, COLORS.frame);
  g.label(px + PAD, 114, t.preparedFor);
  if (d.familyName) g.block(px + PAD, 136, d.familyName, 'serif', { width: pw - PAD * 2, maxLines: 2, size: 18, min: 10, lead: 1.15 });
  else g.dots(px + PAD, X1 - PAD, 140);
  g.block(px + PAD, 168, t.preparedNote, 'sans', { width: pw - PAD * 2, maxLines: 2, size: 6.8, min: 6, lead: 1.4, color: COLORS.soft });

  // 01 The job: owner and when side by side, then the whole job.
  let y = 204;
  g.section(y, 146, '01', t.sections.job);
  const mid = X0 + 264;
  g.line(mid, y + 20, mid, y + 82);
  g.line(X0, y + 82, X1, y + 82);
  g.label(X0 + PAD, y + 37, t.owner);
  if (d.owner) g.block(X0 + PAD, y + 67, d.owner, 'serif', { width: mid - X0 - PAD * 2, maxLines: 1, size: 26, min: 14, lead: 1 });
  else g.dots(X0 + PAD, mid - PAD, y + 68);
  g.label(mid + PAD, y + 37, t.when);
  if (d.when) g.block(mid + PAD, y + 55, d.when, 'serif', { width: X1 - mid - PAD * 2, maxLines: 2, size: 13, min: 9.5, lead: 1.25 });
  else g.dots(mid + PAD, X1 - PAD, y + 68);
  g.label(X0 + PAD, y + 99, t.job);
  if (d.job) g.block(X0 + PAD, y + 119, d.job, 'serif', { width: W - PAD * 2, maxLines: 2, size: 17, min: 11, lead: 1.15 });
  else g.dots(X0 + PAD, X1 - PAD, y + 126);

  // 02 What finished looks like: their words, then a line for more.
  y = 362;
  g.section(y, 118, '02', t.sections.done);
  if (d.done) {
    const b = g.block(X0 + PAD, y + 40, d.done, 'serif', { width: W - PAD * 2, maxLines: 3, size: 12.5, min: 9.5, lead: 1.38 });
    if (b.lines.length <= 2 && b.bottom < y + 70) g.dots(X0 + PAD, X1 - PAD, y + 80);
    const lw = g.label(X0 + PAD, y + 104, t.addMore);
    g.dots(X0 + PAD + lw + 10, X1 - PAD, y + 104);
  } else {
    [44, 44 + WRITE_GAP, 44 + WRITE_GAP * 2].forEach((dy) => g.dots(X0 + PAD, X1 - PAD, y + dy + 12));
  }

  // 03 The handoff: four steps across, each with a box and a date.
  y = 492;
  g.section(y, 150, '03', t.sections.handoff);
  const col = W / 4;
  t.handoff.forEach((step, i) => {
    const cx = X0 + col * i + col / 2;
    if (i) g.line(X0 + col * i, y + 20, X0 + col * i, y + 150);
    g.circle(cx, y + 44, 12, COLORS.blue, COLORS.blueRule);
    g.text(cx, y + 47.6, String(i + 1), 'serifBoldItalic', 12, { align: 'center' });
    g.label(cx, y + 73, step.title, { align: 'center', color: COLORS.ink });
    g.block(cx, y + 89, step.body, 'serif', { width: col - 24, maxLines: 3, size: 9.6, min: 8, lead: 1.32, align: 'center', color: COLORS.soft });
    const bx = X0 + col * i + 13;
    g.box(bx, y + 126);
    const lw = g.label(bx + 14, y + 133.5, t.handoffDate, { size: 5.8 });
    g.dots(bx + 14 + lw + 6, X0 + col * (i + 1) - 13, y + 134);
  });

  // My promise, signed by both.
  y = 654;
  g.rect(X0, y, W, 86, COLORS.panel, COLORS.frame);
  g.label(X0 + PAD, y + 17, t.promiseLabel);
  g.block(X0 + PAD, y + 37, t.promise, 'serifItalic', { width: W - PAD * 2, maxLines: 2, size: 13, min: 10, lead: 1.3 });
  const half = W / 2;
  [t.signOwner, t.signCoach].forEach((who, i) => {
    const x = X0 + PAD + half * i;
    const lw = g.label(x, y + 72, who, { size: 5.8 });
    g.line(x + lw + 8, y + 72.5, X0 + half * (i + 1) - PAD, y + 72.5, COLORS.faint, 0.6);
  });

  g.footer('Front  ·  1 / 2');
  return { width: PAGE_W, height: PAGE_H, ops: g.ops };
}

function back(m: Metrics, d: WorksheetData): Page {
  const g = new Draw(m);
  const t = WORKSHEET.back;
  g.header('Our family, our team');

  g.label(X0, 114, t.eyebrow);
  g.text(X0 - 1, 148, t.title[0], 'serif', 31, { tracking: -0.4 });
  g.text(X0 - 1, 183, t.title[1], 'serifItalic', 31, { tracking: -0.4 });

  // For the grown-ups: the kit's handoff rules, beside the title.
  const px = 352;
  const pw = X1 - px;
  g.rect(px, 98, pw, 100, COLORS.panel, COLORS.frame);
  g.label(px + PAD, 114, t.guidanceLabel);
  let gy = 130;
  for (const line of t.guidance) {
    g.circle(px + PAD + 2, gy - 2.8, 1.5, COLORS.soft);
    const b = g.block(px + PAD + 10, gy, line, 'serif', { width: pw - PAD * 2 - 10, maxLines: 2, size: 9.4, min: 8, lead: 1.3 });
    gy = b.bottom + 16;
  }

  // The letter, full width.
  let ly = 222;
  for (const p of t.letter) {
    const b = g.block(X0, ly, p, 'serif', { width: W, maxLines: 5, size: 11, min: 9.5, lead: 1.42 });
    ly = b.bottom + 21;
  }

  // Family check-in: three questions, two writing lines each.
  let y = 326;
  g.section(y, 238, null, t.checkInLabel);
  const dw = g.label(X1 - PAD - 150, y + 13.2, t.checkInDate, { color: COLORS.ink, size: 7 });
  if (d.checkIn) g.text(X1 - PAD - 150 + dw + 8, y + 13.6, d.checkIn, 'sansMedium', 8, { color: COLORS.ink });
  else g.dots(X1 - PAD - 150 + dw + 8, X1 - PAD, y + 14);
  t.prompts.forEach((q, i) => {
    const qy = y + 42 + i * 72;
    g.text(X0 + PAD, qy, q, 'serifItalic', 12.5);
    g.dots(X0 + PAD, X1 - PAD, qy + WRITE_GAP);
    g.dots(X0 + PAD, X1 - PAD, qy + WRITE_GAP * 2);
  });

  // Try it together: four boxes.
  y = 576;
  g.section(y, 72, null, t.tryLabel);
  t.checks.forEach((c, i) => {
    const x = X0 + PAD + (i % 2) * (W / 2);
    const cy = y + 38 + Math.floor(i / 2) * 21;
    g.box(x, cy - 7.5);
    g.text(x + 16, cy, c, 'sans', 8.6);
  });

  // Bring it to the calendar, and the sign-off.
  y = 660;
  const nw = 340;
  g.rect(X0, y, nw, 80, COLORS.panel, COLORS.frame);
  g.label(X0 + PAD, y + 17, t.calendarLabel);
  g.block(X0 + PAD, y + 37, t.calendar(d.owner), 'serif', { width: nw - PAD * 2, maxLines: 3, size: 10.6, min: 8.5, lead: 1.38 });
  g.text(X0 + nw + 26, y + 30, t.signoff, 'serifItalic', 12, { color: COLORS.soft });
  g.text(X0 + nw + 26, y + 64, t.signature, 'serifBoldItalic', 28);

  g.footer('Back  ·  2 / 2');
  return { width: PAGE_W, height: PAGE_H, ops: g.ops };
}

/** Both pages: front (the job) and back (check-in and encouragement). Always exactly two. */
export function layoutWorksheet(m: Metrics, d: WorksheetData): [Page, Page] {
  return [front(m, d), back(m, d)];
}
