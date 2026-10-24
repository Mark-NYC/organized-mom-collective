# November worksheet PDF: generator and future mail fulfillment

**Status (2026-10-24):** the generator is built at `/club/worksheet-generator` (Club page: noindex, never linked, no trackers). Nothing is connected to LetterStream, nothing is mailed, nothing typed on the page is stored or sent.

## What it makes

The "I Own This Job" worksheet for the November kit (Our Family, Our Team): one 8.5 × 11 in sheet printed front and back.

- **Front:** prepared-for family name, job owner, the whole job, when it happens, what finished looks like (plus a write-in line), the four-step handoff with a box and date per step, and a promise signed by the owner and a grown-up coach.
- **Back:** a note for the family, three grown-up guidelines (from the kit's "Handing Over a Whole Job" checklist), the family check-in (date plus three questions with two writing lines each), a four-item "Try it together" checklist, the calendar reminder with the owner's name, and the sign-off.

Print spec, enforced by the code and checked by tests:

| | |
| --- | --- |
| Size | 612 × 792 pt (US Letter), exactly 2 pages, portrait |
| Safe area | Nothing within 0.5 in of any edge; no bleed |
| Color | RGB, full color (calendar blue `#cddde1` bands, charcoal text, gray panels) |
| Fonts | Gelasio (Georgia's metric-compatible open stand-in; Georgia can't be embedded) and Montserrat, both SIL OFL, subset and embedded |
| Text | Real text (selectable, searchable), not images |
| Print hints | Viewer preferences: print scaling None, duplex flip on long edge |
| Size on disk | about 75–100 KB |
| Mailing | Flat in a 9 × 12 envelope, unfolded |

## How it's built

`src/lib/worksheet/`, no DOM and no browser APIs:

| File | Role |
| --- | --- |
| `types.ts` | `WorksheetInput` (personalization), `WorksheetData` (cleaned), the drawing operations |
| `content.ts` | Template copy, job presets, input limits. The only place the words live |
| `normalize.ts` | Input → data: trims, caps lengths on a whole word, simplifies characters the fonts can't draw, formats the date, "goering" → "The Goering Family". A blank becomes `null`, which prints a line to write on |
| `text.ts` | Line wrapping and shrink-to-fit, measured with the embedded fonts |
| `layout.ts` | Data → two pages of drawing operations. Every box is a fixed size; text is fitted into it, so no entry can move the layout, add a page or clip |
| `pdf.ts` | Operations → PDF (pdf-lib) |
| `svg.ts` | Operations → SVG, the on-screen preview |
| `index.ts` | `createWorksheetPdf(input, fontBytes)` → `Uint8Array`, `worksheetFileName(input)` |

The preview and the PDF draw the same operations with the same font files (`public/fonts/worksheet/*.ttf`, made from `@fontsource` by `scripts/build-worksheet-fonts.mjs`), so lines break identically. `scripts/worksheet-qa.mjs` renders each downloaded PDF and diffs it against the preview (under 0.2 % of pixels differ, from antialiasing).

Server-side, no browser:

```sh
echo '{"familyName":"Goering","owner":"Andrew","job":"Empty the dishwasher"}' | node scripts/render-worksheet.mjs - out.pdf
```

pdf-lib and fontkit are pure JavaScript, so the same call runs in Node, a Supabase Edge Function (Deno) or a Cloudflare Worker: pass the six font files' bytes.

## Fulfillment contract (for later)

**Input per family** (only what the page prints; `WorksheetInput`):

```json
{ "familyName": "Goering", "owner": "Andrew", "job": "Set and clear the dinner table",
  "when": "Every evening, before and after dinner", "done": "Plates, cups and forks out…", "checkIn": "2026-11-14" }
```

Plus, kept apart from the worksheet data and never printed on it: a mailing ID, the recipient's mailing name and address (from the Club's mailing snapshot, `docs/club/IMPLEMENTATION_PLAN.md`), and the kit slug (`2026-11-family-ownership`).

**Output per family:** one PDF (2 pages, as above), its SHA-256, page count 2, and a stable file name `<kit>/<mailing-id>.pdf`. No names in file names or URLs.

**Proposed pipeline** (nothing below exists yet):

1. At the month's mailing cutoff, the mailing snapshot lists eligible members (`IMPLEMENTATION_PLAN.md`, Phase 3).
2. For each: load the family's worksheet answers (saved by the Club, once accounts exist), call `createWorksheetPdf`, check 2 pages and 612 × 792, upload to private storage, create a short-lived signed URL.
3. Create a LetterStream job: mail type `flat`, ink color, the signed PDF URL, page count 2, a unique job ID (the mailing ID), recipient and sender address, cover sheet `Y` (the worksheet has no address window, so LetterStream adds the address page).
4. Review proofs in LetterStream test mode, then authorize the batch (a human step at first).
5. Store LetterStream's job ID, cost and status; update from its callbacks; mark mailed in the Club admin.
6. Delete the PDFs and signed URLs once mailed (or after 30 days). Keep only the job ID, status and cost.

## What we know about LetterStream, and what's still open

Known from LetterStream's public help pages (2026-10-24):

- API access is granted on request to support@letterstream.com (company overview, intended use, confirmation of development resources). Full API docs, sample code, test mode and callback settings appear in the account only after approval. ([API information](https://help.letterstream.com/article/940-letterstream-api-information))
- The API takes PDFs and supports Flats; it has a test mode and status callbacks.
- PDFs must be text-based, and every recipient in a batch must get the same page count. Pre-addressed documents must keep the address window area clear; otherwise a cover sheet is added (about $0.10 per recipient). ([Formatting pre-addressed documents](https://help.letterstream.com/article/24-will-my-addresses-show-through-the-windows-in-the-envelope))
- Flats hold 1–75 sheets; duplex is offered. ([Flat mail options](https://www.letterstream.com/flats-options/))
- A third-party integration lists job fields: PDF URL, unique job ID (8–20 characters), number of pages, sender and recipient name and address, mail type (`flat` among others), ink (`B`/`C`), return envelope, cover sheet. Unofficial: confirm against LetterStream's own docs once the account has API access. ([Tadabase LetterStream pipe](https://docs.tadabase.io/pipes/article/letter-stream-pipe))

Open, to settle before connecting:

- [ ] API access approved, and the real endpoint, authentication and field names.
- [ ] Whether a flat can be printed duplex from a 2-page PDF (one sheet) and how that's set per job; whether the cover sheet counts as a printed page.
- [ ] Color flat pricing per piece at our volume, and whether $5/month covers it (D1).
- [ ] Their printable area and any minimum margins (ours: 0.5 in, no bleed), paper weight for flats, and whether they accept RGB or want CMYK.
- [ ] Whether they fetch the PDF from our signed URL or need an upload, and how long the URL must stay valid.
- [ ] Callback format and signing, so the status endpoint can verify it.
- [ ] Turnaround from authorization to mail drop (sets the cutoff, D2).
- [ ] A printed proof of this PDF from LetterStream, checked by hand: color of the blue bands, the dotted lines, the fine rules, duplex alignment.

## Privacy

The browser generator stores nothing and sends nothing. For mail fulfillment, store only what's needed to print and mail: the six worksheet fields (a child's first name among them) and the mailing address, in the Club's existing access-controlled tables; delete generated PDFs after mailing; never put names in URLs, file names, logs or analytics.
