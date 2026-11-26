/**
 * V20 illustration treatment (docs/ios/V20_BASELINE.md → Visual system): the brand's own hand-drawn icons
 * (assets/icons/ofc/updatedicons/svg, traced from the original drawings) with WHITE-FILLED interiors and a charcoal
 * line, exported on a transparent background so the app places them on a solid calendar-color circle.
 *
 *   node scripts/build-illustrated-badges.mjs        → public/assets/icons/ofc/badges/<name>.png (192 × 192)
 *
 * How the white interior is made (no redrawing, no AI): the line art is rasterized; everything reachable from the
 * edge without crossing a line is "outside" (small gaps in the hand-drawn line are bridged first, then the outside is
 * grown back to the line so nothing outside turns white); every other non-line pixel is "inside" and painted white
 * underneath the original line. The line itself is only re-colored from gray to charcoal.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const BADGES = [
  'move-play', 'school-bus', 'conversation-bubbles', 'toothbrush', 'wrapped-gift', 'family-meeting-around-a-table', 'backpack', 'car',
  'cooking-pot', 'spray-bottle-cloth', 'helping-hands', 'breakfast-bowl', 'calendar', 'home', 'trash-bin', 'clothes-hanger', 'lunchbox',
  'star', 'clock', 'string-lights', 'sneakers', 'book', 'family-group',
];
const SRC = 'assets/icons/ofc/updatedicons/svg';
const OUT = 'public/assets/icons/ofc/badges';
const SIZE = 192;
const CHARCOAL = '#2E2A28';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
for (const name of BADGES) {
  const svg = readFileSync(`${SRC}/${name}.svg`, 'utf8').replace(/fill="#[0-9a-fA-F]{3,6}"/g, `fill="${CHARCOAL}"`);
  const dataUrl = await page.evaluate(async ({ svg, SIZE }) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    // Same visual size for every drawing: crop to the drawing's own bounds, then fit it to 84% of the square.
    const t = document.createElement('canvas');
    t.width = t.height = SIZE;
    const tx = t.getContext('2d');
    tx.drawImage(img, 0, 0, SIZE, SIZE);
    const raw = tx.getImageData(0, 0, SIZE, SIZE).data;
    let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
    for (let p = 0; p < SIZE * SIZE; p++) if (raw[p * 4 + 3] > 10) { const px = p % SIZE, py = (p / SIZE) | 0; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, k = (SIZE * 0.84) / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const x = c.getContext('2d');
    x.drawImage(t, x0, y0, w, h, (SIZE - w * k) / 2, (SIZE - h * k) / 2, w * k, h * k);
    const { data } = x.getImageData(0, 0, SIZE, SIZE);
    const N = SIZE * SIZE;
    const line = new Uint8Array(N);
    for (let i = 0; i < N; i++) line[i] = data[i * 4 + 3] > 90 ? 1 : 0;
    // Bridge small gaps in the hand-drawn line (radius 3).
    const R = 3;
    const wall = new Uint8Array(N);
    for (let y = 0; y < SIZE; y++) for (let xx = 0; xx < SIZE; xx++) {
      if (!line[y * SIZE + xx]) continue;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const yy = y + dy, xxx = xx + dx;
        if (yy >= 0 && yy < SIZE && xxx >= 0 && xxx < SIZE && dx * dx + dy * dy <= R * R) wall[yy * SIZE + xxx] = 1;
      }
    }
    // Outside: flood from the edges through non-wall pixels.
    const out = new Uint8Array(N);
    const q = [];
    for (let i = 0; i < SIZE; i++) for (const p of [i, (SIZE - 1) * SIZE + i, i * SIZE, i * SIZE + SIZE - 1]) if (!wall[p] && !out[p]) { out[p] = 1; q.push(p); }
    while (q.length) {
      const p = q.pop(), py = (p / SIZE) | 0, px = p % SIZE;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + ddx, ny = py + ddy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const n = ny * SIZE + nx;
        if (!wall[n] && !out[n]) { out[n] = 1; q.push(n); }
      }
    }
    // Grow the outside back up to the real line, so the bridge never paints white outside the drawing.
    for (let k = 0; k < R + 1; k++) {
      const add = [];
      for (let p = 0; p < N; p++) {
        if (out[p] || line[p]) continue;
        const py = (p / SIZE) | 0, px = p % SIZE;
        if ((px > 0 && out[p - 1]) || (px < SIZE - 1 && out[p + 1]) || (py > 0 && out[p - SIZE]) || (py < SIZE - 1 && out[p + SIZE])) add.push(p);
      }
      for (const p of add) out[p] = 1;
    }
    const fill = x.createImageData(SIZE, SIZE);
    let inside = 0;
    for (let p = 0; p < N; p++) if (!out[p]) { fill.data.set([255, 255, 255, 255], p * 4); inside++; }
    const c2 = document.createElement('canvas');
    c2.width = c2.height = SIZE;
    const y2 = c2.getContext('2d');
    y2.putImageData(fill, 0, 0);
    y2.drawImage(c, 0, 0);
    return { url: c2.toDataURL('image/png'), inside: inside / N };
  }, { svg, SIZE });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(dataUrl.url.split(',')[1], 'base64'));
  console.log(`${name.padEnd(32)} white interior ${(dataUrl.inside * 100).toFixed(1)}%`);
}
await browser.close();
