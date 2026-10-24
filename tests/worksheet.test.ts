import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createMetrics, createWorksheetPdf, FONT_DIR, FONT_FILES, JOB_PRESETS, layoutWorksheet, LIMITS, MARGIN, normalize, PAGE_H, PAGE_W, worksheetFileName, type FontBytes, type Op } from '../src/lib/worksheet/index.ts';
import { fit, wrap } from '../src/lib/worksheet/text.ts';

const fonts = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, new Uint8Array(readFileSync(FONT_DIR + f))])) as FontBytes;
const metrics = createMetrics(fonts);

const long = {
  familyName: 'Montgomery-Vanderbilt-Castellanos Household of Five',
  owner: 'Maximiliana-Josephine-Anne',
  job: 'Plan, shop for and cook one family dinner every single Sunday night, including all cleanup',
  when: 'Every Sunday afternoon starting at four, plus the grocery list on Friday nights too',
  done: 'x'.repeat(40) + ' ' + 'Menu chosen by Friday, groceries on the list, dinner on the table by six, counters wiped, dishwasher loaded and started, leftovers labeled in the fridge, and the recipe added to the family binder so we can make it again next month without anyone asking at all.',
  checkIn: '2026-11-28',
};

/** Every point an operation touches, for the margin check (text by its measured box). */
function bounds(op: Op): [number, number, number, number] {
  switch (op.t) {
    case 'rect': return [op.x, op.y, op.x + op.w, op.y + op.h];
    case 'line': return [Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.max(op.x1, op.x2), Math.max(op.y1, op.y2)];
    case 'circle': return [op.cx - op.r, op.cy - op.r, op.cx + op.r, op.cy + op.r];
    case 'dots': return [op.x1 - op.r, op.y - op.r, op.x2 + op.r, op.y + op.r];
    case 'text': {
      const w = metrics.width(op.font, op.text, op.size) + (op.tracking ?? 0) * ([...op.text].length - 1);
      return [op.x, op.y - op.size, op.x + w, op.y + op.size * 0.3];
    }
  }
}

describe('worksheet normalize', () => {
  it('formats family names', () => {
    expect(normalize({ familyName: 'goering' }).familyName).toBe('The Goering Family');
    expect(normalize({ familyName: 'The Goering Family' }).familyName).toBe('The Goering Family');
    expect(normalize({ familyName: 'Rivera crew' }).familyName).toBe('Rivera crew');
    expect(normalize({ familyName: '   ' }).familyName).toBeNull();
  });
  it('blank fields become null (a line to write on)', () => {
    expect(normalize({})).toEqual({ familyName: null, owner: null, job: null, when: null, done: null, checkIn: null });
  });
  it('keeps only drawable characters', () => {
    expect(normalize({ owner: 'Zoë 🎉' }).owner).toBe('Zoë');
    expect(normalize({ familyName: 'Łukasiewicz' }).familyName).toBe('The Lukasiewicz Family');
    expect(normalize({ owner: "o'brien" }).owner).toBe('O’brien');
  });
  it('caps lengths on a whole word', () => {
    const job = normalize({ job: 'word '.repeat(40) }).job!;
    expect([...job].length).toBeLessThanOrEqual(LIMITS.job + 1);
    expect(job.endsWith('word…')).toBe(true);
  });
  it('formats and validates the check-in date', () => {
    expect(normalize({ checkIn: '2026-11-14' }).checkIn).toBe('Saturday, November 14');
    expect(normalize({ checkIn: '2026-02-30' }).checkIn).toBeNull();
    expect(normalize({ checkIn: 'soon' }).checkIn).toBeNull();
  });
  it('makes safe file names', () => {
    expect(worksheetFileName({ familyName: 'Nuñez-Ortiz' })).toBe('november-i-own-this-job-nunez-ortiz.pdf');
    expect(worksheetFileName({})).toBe('november-i-own-this-job.pdf');
  });
});

describe('worksheet text fitting', () => {
  it('wraps at spaces and hyphens and never exceeds the width', () => {
    const lines = wrap(metrics, 'serif', 18, 'The Montgomery-Vanderbilt-Castellanos Household', 170);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(metrics.width('serif', l, 18)).toBeLessThanOrEqual(170);
  });
  it('shrinks, then ellipsizes, inside its box', () => {
    const f = fit(metrics, 'serif', 'word '.repeat(200), { width: 200, maxLines: 2, size: 14, min: 10 });
    expect(f.lines).toHaveLength(2);
    expect(f.size).toBe(10);
    expect(f.lines[1].endsWith('…')).toBe(true);
  });
});

describe('worksheet layout', () => {
  const cases = { blank: {}, short: { familyName: 'Li', owner: 'Bo', job: 'Feed the cat' }, long, ...Object.fromEntries(JOB_PRESETS.map((p, i) => [`preset ${i}`, { familyName: 'Goering', owner: 'Andrew', ...p }])) };
  for (const [name, input] of Object.entries(cases)) {
    it(`${name}: two pages, everything inside the 0.5 in margin`, () => {
      const pages = layoutWorksheet(metrics, normalize(input));
      expect(pages).toHaveLength(2);
      for (const page of pages) {
        expect([page.width, page.height]).toEqual([PAGE_W, PAGE_H]);
        for (const op of page.ops) {
          const [x0, y0, x1, y1] = bounds(op);
          // Large titles are nudged left by their glyph side bearing, so the ink (not the box) meets the margin.
          expect(x0, JSON.stringify(op)).toBeGreaterThanOrEqual(MARGIN - (op.t === 'text' ? 2 : 0.5));
          expect(y0, JSON.stringify(op)).toBeGreaterThanOrEqual(MARGIN - 0.5);
          expect(x1, JSON.stringify(op)).toBeLessThanOrEqual(PAGE_W - MARGIN + 0.5);
          expect(y1, JSON.stringify(op)).toBeLessThanOrEqual(PAGE_H - MARGIN + 0.5);
        }
      }
    });
  }
});

describe('worksheet PDF', () => {
  it('is exactly two US Letter pages, with metadata and print settings', async () => {
    const bytes = await createWorksheetPdf(long, fonts, { date: new Date('2026-10-24T00:00:00Z') });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    for (const p of doc.getPages()) expect(p.getSize()).toEqual({ width: 612, height: 792 });
    expect(doc.getTitle()).toContain('I Own This Job');
    const prefs = doc.catalog.getOrCreateViewerPreferences();
    expect(prefs.getPrintScaling()).toBe('None');
    expect(prefs.getDuplex()).toBe('DuplexFlipLongEdge');
  });
});
