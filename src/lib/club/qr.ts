/**
 * A small QR code encoder for the Club mailer's printable twin (the printed mailer's QR comes from the same URL).
 * Byte mode, error correction level M, versions 1–6 (up to 106 bytes): enough for a kit's address. No dependency.
 * Follows ISO/IEC 18004; structure after Project Nayuki's reference encoder (MIT).
 */

/** Total codewords, EC codewords per block, and data codewords per block, for level M, versions 1–6. */
const VERSIONS: { total: number; ec: number; blocks: number[] }[] = [
  { total: 26, ec: 10, blocks: [16] },
  { total: 44, ec: 16, blocks: [28] },
  { total: 70, ec: 26, blocks: [44] },
  { total: 100, ec: 18, blocks: [32, 32] },
  { total: 134, ec: 24, blocks: [43, 43] },
  { total: 172, ec: 16, blocks: [27, 27, 27, 27] },
];
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

/** The QR code for `text` as rows of dark (true) and light modules, without the quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  const v = VERSIONS.findIndex((x) => x.blocks.reduce((a, b) => a + b, 0) >= bytes.length + 2);
  if (v < 0) throw new Error('qr_too_long');
  const version = v + 1;
  const { ec, blocks } = VERSIONS[v];
  const capacity = blocks.reduce((a, b) => a + b, 0);

  // Data: byte mode, 8-bit length, the bytes, terminator, padding.
  const bits: number[] = [];
  const put = (value: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, 8);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, capacity * 8 - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

  // Blocks with their error correction, interleaved.
  const divisor = rsDivisor(ec);
  const split: { d: number[]; e: number[] }[] = [];
  let at = 0;
  for (const n of blocks) {
    const d = data.slice(at, at + n);
    at += n;
    split.push({ d, e: rsRemainder(d, divisor) });
  }
  const codewords: number[] = [];
  for (let i = 0; i < Math.max(...blocks); i++) for (const b of split) if (i < b.d.length) codewords.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of split) codewords.push(b.e[i]);

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; fixed[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
    }
  }
  const align = ALIGN[v];
  for (const ax of align) for (const ay of align) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    const fmt = (0 << 3) | mask; // level M is 00
    let rem = fmt;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((fmt << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);

  // Codewords in the zigzag, two columns at a time, skipping the vertical timing column.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && i < codewords.length * 8) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && masks[m](x, y)) modules[y][x] = !modules[y][x];
  };
  let best = 0;
  let lowest = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const score = penalty(modules);
    if (score < lowest) { lowest = score; best = m; }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return modules;
}

/** The standard mask penalty: runs, 2×2 blocks, finder-like patterns, dark/light balance. */
function penalty(m: boolean[][]) {
  const size = m.length;
  let score = 0;
  const lines = [...m, ...m.map((_, x) => m.map((row) => row[x]))];
  const finder = [true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    for (let i = 0; i + 7 <= size; i++) {
      if (!finder.every((d, k) => line[i + k] === d)) continue;
      const lightBefore = i >= 4 && line.slice(i - 4, i).every((d) => !d);
      const lightAfter = i + 11 <= size && line.slice(i + 7, i + 11).every((d) => !d);
      if (lightBefore || lightAfter) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  const dark = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

/** An SVG path for the dark modules, with a 4-module quiet zone; viewBox is `0 0 n n`. */
export function qrPath(text: string): { path: string; size: number } {
  const m = qrMatrix(text);
  const q = 4;
  let path = '';
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + q} ${y + q}h1v1h-1z`; }));
  return { path, size: m.length + q * 2 };
}
