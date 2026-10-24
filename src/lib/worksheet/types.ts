/**
 * The November "I Own This Job" worksheet: shared types.
 *
 * Personalization (WorksheetInput) is kept apart from the template (content.ts) and the drawing (layout.ts), so the
 * same engine runs in the browser generator and, later, server-side for mailed fulfillment (docs/club/WORKSHEET_PDF.md).
 */

/** What a family types in. Every field is optional: a blank becomes a line to write on, never placeholder text. */
export interface WorksheetInput {
  /** "Goering" or "The Goering Family". */
  familyName?: string;
  /** First name of the person taking over the job. */
  owner?: string;
  /** The whole job, in the owner's words ("Pack my school bag"). */
  job?: string;
  /** When it happens ("Every school night, before bed"). */
  when?: string;
  /** What finished looks like. Line breaks are kept. */
  done?: string;
  adultOwner?: string;
  adultJob?: string;
  adultWhen?: string;
  existing?: string;
  /** First family check-in, ISO date (YYYY-MM-DD). */
  checkIn?: string;
}

/** Cleaned input: trimmed, length-capped, characters the fonts can't draw simplified. `null` means "leave a line". */
export interface WorksheetData {
  familyName: string | null;
  owner: string | null;
  job: string | null;
  when: string | null;
  done: string | null;
  adultOwner: string | null;
  adultJob: string | null;
  adultWhen: string | null;
  existing: string | null;
  /** Formatted for print ("Saturday, November 14"), or null. */
  checkIn: string | null;
}

export type FontKey = 'serif' | 'serifItalic' | 'serifBoldItalic' | 'sans' | 'sansMedium' | 'sansBold';

/** Text measuring, backed by the same font files the PDF embeds. */
export interface Metrics {
  /** Advance width in points, without kerning (the PDF draws without it too). */
  width(font: FontKey, text: string, size: number): number;
  /** Whether the font has a glyph for this character. */
  has(font: FontKey, char: string): boolean;
}

/** One drawing operation. Coordinates in PDF points from the page's top-left; text y is the baseline. */
export type Op =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; sw: number }
  | { t: 'dots'; x1: number; x2: number; y: number; gap: number; r: number; color: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'text'; x: number; y: number; text: string; font: FontKey; size: number; color: string; tracking?: number };

export interface Page {
  width: number;
  height: number;
  ops: Op[];
}
