/**
 * Print-first, one-page US Letter checklist.
 * All tasks and original zone artwork come directly from the cleaning companion.
 * Dimensions in PDF points (72 pt = 1 inch). This remains a single page.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'src/data/cleaning.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { dailyEssentials, weeklySchedule, weekend } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
if (dailyEssentials.tasks.length !== 5 || weeklySchedule.length !== 4 || weekend.days.length !== 3) {
  throw new Error('Cleaning schedule changed; review the one-page printable layout.');
}

const pdf = await PDFDocument.create();
pdf.setTitle('Our Weekly Cleaning Reset | One-Page Printable');
pdf.setAuthor('Organized Mom Collective');
pdf.setSubject('Original illustrated seven-day household cleaning checklist');
const page = pdf.addPage([612, 792]);
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
const hex = h => rgb(...[0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
const ink = hex('545454'), muted = hex('66615C'), border = hex('CCC6C0');
const ivory = hex('FBF7F1'), blue = hex('CDDDE1'), white = rgb(1, 1, 1);
const safe = value => String(value).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
function text(value, x, y, size = 10, font = regular, color = ink) {
  page.drawText(safe(value), { x, y, size, font, color });
}
function fitted(value, x, y, maxWidth, fontSize = 10.3, font = regular, minimum = 9.6) {
  let size = fontSize;
  while (font.widthOfTextAtSize(safe(value), size) > maxWidth && size > minimum) size -= 0.1;
  if (font.widthOfTextAtSize(safe(value), size) > maxWidth) {
    throw new Error('Text too wide for one-page cleaning printable: ' + value);
  }
  text(value, x, y, size, font);
}
function rectangle(x, y, width, height, color = white, stroke = border) {
  page.drawRectangle({ x, y, width, height, color, borderColor: stroke, borderWidth: 0.65 });
}
function checkbox(x, y, size = 12) {
  page.drawRectangle({ x, y, width: size, height: size, borderColor: ink, borderWidth: 0.9 });
}
const icons = new Map();
async function icon(path, x, y, size = 36) {
  if (!icons.has(path)) icons.set(path, await pdf.embedPng(await readFile(join(root, 'public', path.replace(/^\//, '')))));
  const image = icons.get(path);
  const scale = Math.min(size / image.width, size / image.height);
  const w = image.width * scale, h = image.height * scale;
  page.drawImage(image, { x: x + (size - w) / 2, y: y + (size - h) / 2, width: w, height: h });
}

rectangle(0, 0, 612, 792);
text('ORGANIZED MOM COLLECTIVE  /  FREE FAMILY PRINTABLE', 32, 763, 8.3, bold, muted);
text('Our Weekly Cleaning Reset', 32, 731, 25, serif);
text('15-minute Daily Reset  +  one weekday zone  +  a flexible weekend', 32, 712, 10);

// The blue band leads. A compact task area leaves the bulk of the page for larger weekday type.
rectangle(32, 604, 548, 96);
rectangle(32, 658, 548, 42, blue);
await icon(dailyEssentials.icon, 43, 663, 32);
text('DAILY RESET', 85, 679, 15, serif);
text('15 MINUTES  /  EVERY DAY', 85, 665, 8.7, bold, muted);
text('CHECK OFF EACH DAY', 383, 685, 8, bold, muted);
['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
  const x = 392 + i * 25.4;
  text(d, x, 672, 8, bold);
  checkbox(x - 1, 659, 10.5);
});
dailyEssentials.tasks.forEach((task, i) => {
  const col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
  const x = 44 + col * 266, y = 647 - row * 16;
  // Keep the entire checkbox and task text clear of the card border and blue header.
  if (y - 2 < 604 + 8 || y + 10.1 > 658 - 1) throw new Error('Daily Reset row overlaps its frame: ' + task.label);
  checkbox(x, y - 2, 11);
  fitted(task.label, x + 19, y, 244, 10.1, regular, 9.6);
});

// Balanced cards: five-item days get more breathing room; the eight-item day remains readable.
async function zone(day, x, top, height = 213) {
  const width = 269;
  rectangle(x, top - height, width, height);
  rectangle(x, top - 44, width, 44, ivory);
  await icon(day.icon, x + 11, top - 39, 34);
  text(day.dayLabel.toUpperCase(), x + 55, top - 17, 9.1, bold, muted);
  fitted(day.zone, x + 55, top - 35, width - 66, 16, serif, 13.6);
  const count = day.tasks.length;
  const gap = count >= 8 ? 16.5 : count === 7 ? 19 : 26;
  const start = top - 61;
  const ownerY = top - height + 15;
  // Reserve an actual gutter above the owner label and underline. No task may enter it.
  const finalCheckboxBottom = start - (count - 1) * gap - 2;
  if (finalCheckboxBottom < ownerY + 18) {
    throw new Error(day.dayLabel + ' checklist overlaps its owner line');
  }
  day.tasks.forEach((task, i) => {
    const y = start - i * gap;
    checkbox(x + 12, y - 2, 11.5);
    fitted(task.label, x + 32, y, width - 44, 10.25, regular, 9.65);
  });
  text('OWNER:', x + 12, ownerY, 9.1, bold, muted);
  page.drawLine({
    start: { x: x + 65, y: ownerY - 1 },
    end: { x: x + width - 13, y: ownerY - 1 },
    color: ink, thickness: 0.65,
  });
}
await zone(weeklySchedule[0], 32, 594);
await zone(weeklySchedule[1], 311, 594);
await zone(weeklySchedule[2], 32, 371);
await zone(weeklySchedule[3], 311, 371);

// Weekend is useful but secondary. Drop repetitive weekend icons to free space for legible copy.
rectangle(32, 64, 548, 84);
rectangle(32, 126, 548, 22, blue);
text('FRIDAY - SUNDAY   /   FLEXIBLE', 43, 133, 9, bold);
const actions = [
  'Choose one deeper cleaning task',
  'One monthly home project task',
  'Catch up on one zone, reset, or rest',
];
for (let i = 0; i < 3; i++) {
  const x = 43 + i * 179;
  const d = weekend.days[i];
  if (i > 0) page.drawLine({ start: { x: x - 8, y: 71 }, end: { x: x - 8, y: 120 }, color: border, thickness: 0.6 });
  text(d.dayLabel.toUpperCase(), x, 112, 9.2, bold, muted);
  checkbox(x + 148, 105, 12);
  fitted(d.zone, x, 94, 141, 12.8, serif, 11);
  fitted(actions[i], x, 76, 163, 9.35, regular, 8.9);
}
text('Missed a day? Skip, don\'t stack. Find monthly project tasks in the cleaning companion.', 32, 45, 8.9, regular, muted);
text('organizedmomcollective.com', 32, 25, 8.3, bold);
const destination = join(root, 'public/downloads/weekly-cleaning-reset-one-page.pdf');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, await pdf.save());
console.log('Generated one-page Letter cleaning reset from live tasks and original zone icons.');
