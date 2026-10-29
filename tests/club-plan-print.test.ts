/**
 * Club plan printables (September Sunday Reset and October Daily Reset: two sheets; April: two sheets; January and May: one sheet; February: one or two, one per readiness level in use; March: one per child) print one US Letter page per sheet in WebKit
 * (Safari on iPhone, iPad and Mac). The rules live in src/components/club/plan/ClubPrintStyles.astro.
 *
 * Chromium's PDF output can't stand in for Safari: WebKit paginates differently. This models WebCore's
 * PrintContext (computePageRects) and FrameView::forceLayoutForPagination for this document: a page holds
 * `document width × printable height ÷ printable width` CSS px, truncated to an integer, after taking out the
 * header and footer Safari prints (on iOS, always). Forced breaks move the back sheet to the next page start.
 * It is a model, not Safari: the final check is a real print on an iPhone.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PX_PER_IN = 96;
const SHEET = { width: 8.5 * PX_PER_IN, height: 11 * PX_PER_IN }; // the printable artwork, 816 × 1056 px
const LETTER = { width: 612, height: 792 }; // points

interface PrintSetup { side: number; vertical: number; header: number; footer: number } // points

function webkitPageCount(documentWidthPx: number, setup: PrintSetup, sheets = 2) {
  const availableWidth = LETTER.width - 2 * setup.side;
  const availableHeight = LETTER.height - 2 * setup.vertical - setup.header - setup.footer;
  const pageHeight = (documentWidthPx * availableHeight) / availableWidth; // layout's page height
  let end = 0;
  for (let i = 0; i < sheets; i++) {
    const start = i === 0 ? 0 : Math.ceil(end / pageHeight - 1e-9) * pageHeight; // break-after: page
    end = start + SHEET.height;
  }
  return Math.ceil(end / Math.floor(pageHeight)); // page rects use an integer height
}

/** The printed document width WebKit sees, from the page's own WebKit-only print rule. */
function webkitDocumentWidth() {
  const page = readFileSync(new URL('../src/components/club/plan/ClubPrintStyles.astro', import.meta.url), 'utf8');
  const print = page.slice(page.indexOf('@media print{'));
  const rule = /@supports \(hanging-punctuation: first\)\{\s*html:has\(\.club-plan\[data-plan-state="ready"\]\)\{([^}]*)\}/.exec(print);
  expect(rule, 'WebKit print rule in the shared print block').not.toBeNull();
  const decl = rule![1];
  expect(decl).toMatch(/box-sizing:content-box/);
  const width = Number(/width:([\d.]+)in/.exec(decl)?.[1]);
  const pad = Number(/padding:0 ([\d.]+)in/.exec(decl)?.[1]);
  return (width + 2 * pad) * PX_PER_IN;
}

// Plausible Safari setups: page margins (iOS may not honor @page margin:0), header and footer heights.
const setups: PrintSetup[] = [];
for (const side of [0, 18, 36]) for (const vertical of [0, 18, 36]) for (const header of [0, 18, 30]) for (const footer of [0, 18, 30]) {
  if (vertical <= side + 18) setups.push({ side, vertical, header, footer });
}

describe('Club plan printables in WebKit', () => {
  it('reproduces the iPhone bug with an 8.5in document: front, spill, back, spill', () => {
    const iosFooter = { side: 0, vertical: 0, header: 0, footer: 24 };
    expect(webkitPageCount(SHEET.width, iosFooter)).toBe(4);
    // Even with nothing taken away, an exact 11in fit leaves no headroom at all.
    expect(webkitPageCount(SHEET.width, { side: 0, vertical: 0, header: 0, footer: 0 })).toBeLessThanOrEqual(2);
  });

  it('prints one page per sheet for every plausible Safari header, footer and margin', () => {
    const width = webkitDocumentWidth();
    expect(width).toBeGreaterThan(SHEET.width);
    expect(setups.filter((s) => webkitPageCount(width, s, 2) !== 2)).toEqual([]); // October: front and back
    expect(setups.filter((s) => webkitPageCount(width, s, 1) !== 1)).toEqual([]); // January: one sheet
  });

  it('reproduces the one-sheet risk too: an 8.5in document spills January onto a second page', () => {
    expect(webkitPageCount(SHEET.width, { side: 0, vertical: 0, header: 0, footer: 24 }, 1)).toBe(2);
  });

  it('marks the last sheet of every Club plan printable, so nothing breaks after it', () => {
    for (const file of ['SeptemberSundayReset.astro', 'OctoberDailyReset.astro', 'JanuaryHabitCards.astro', 'FebruaryLaundryGuides.astro', 'MarchChoreCharts.astro', 'MaySummerRhythm.astro', 'AprilDinnerPlan.astro']) {
      const src = readFileSync(new URL(`../src/components/club/${file}`, import.meta.url), 'utf8');
      expect(src.match(/data-plan-sheet-end/g)?.length, file).toBe(1);
    }
  });

  it('keeps the sheet at least 85% of its full-width size (scaled, never cropped)', () => {
    expect(SHEET.width / webkitDocumentWidth()).toBeGreaterThanOrEqual(0.85);
  });
});
