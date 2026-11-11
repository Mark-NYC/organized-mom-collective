/** Build Club-style, one-page vector printable using the approved design. */
import {generateMiniClubChorePrintables} from './lib/club-style-chores-pdf.mjs';
await generateMiniClubChorePrintables();
// Replace only the three age-specific PDFs with the approved illustrated card layout.
// Leave the separate no-reminders worksheet on its existing template.
await import('./generate-age-chores-card-pdfs.mjs');
