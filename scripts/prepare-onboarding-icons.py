#!/usr/bin/env python3
"""
Club onboarding icons: assets/icons/ofc/onboarding/*.jpg -> public/images/club/onboarding/*.webp (transparent).

Removes only the EXTERIOR white background: a flood fill from the image border through near-white pixels. White
areas enclosed by linework (faces, papers, cuffs) are never reached, so they stay opaque white. The anti-aliased
edge band next to the removed background is turned to alpha against white (no white halo); everything else is
copied untouched. No redrawing, no recolouring of the art.

Each icon is trimmed to its art and centred on a square canvas with the same padding, proportions kept.

An icon is FLAGGED (and still written, so a reviewer can look) when the fill reaches deep into the art's bounding
box, which usually means a gap in an outline let it leak into an object's intentional white fill. Flagged icons
are listed in assets/icons/ofc/onboarding/REPORT.md and must be checked by eye before use.

  python3 scripts/prepare-onboarding-icons.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/icons/ofc/onboarding'
OUT = ROOT / 'public/images/club/onboarding'
SIZE = 320          # output square, px (shown at 40-64 CSS px, so 2x+ for sharp screens)
PADDING = 0.08      # of SIZE, on every side
BG = 236            # luminance at or above this, connected to the border, is background
EDGE = 2            # px of anti-aliased edge band softened into alpha
GAP = 3             # outline gaps up to about 2 * GAP px are treated as closed, so the fill can't leak through them
LEAK_LIMIT = 0.62   # share of the art's bounding box that ended up transparent before we flag it


# Notes from looking at every output on a coloured background (2026-10-30). Re-check after replacing a source.
REVIEW = {
    'family-members': 'The people are drawn open at the bottom, so their shirts read as background and are transparent. '
                      'Faces stay white. Fine on the Club\'s light pages; on a dark or coloured fill, use it on a white tile.',
    'family-meeting': 'Same as family-members: open-bottomed bodies are transparent; the wall calendar keeps its white fill.',
    'individual-ownership': 'Same: open-bottomed shirt is transparent; face and clipboard stay white.',
}


def exterior(lum: np.ndarray) -> np.ndarray:
    """Background reachable from the border. Lines are thickened by GAP for the fill so a small break in an
    outline doesn't let it into an object's white fill, then the fill grows back GAP px over light pixels only."""
    light = lum >= BG
    reach = flood(light & ~dilate(~light, GAP))
    return dilate(reach, GAP) & light


def flood(light: np.ndarray) -> np.ndarray:
    h, w = light.shape
    seen = np.zeros_like(light)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:, :] |= out[:-1, :]
        m[:-1, :] |= out[1:, :]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def process(path: Path):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    ext = exterior(lum)
    band = dilate(ext, EDGE) & ~ext

    alpha = np.full(lum.shape, 255.0)
    alpha[ext] = 0
    # Colour-to-alpha against white in the edge band: a pixel that is 30% ink over white becomes ink at 30%.
    a = np.clip((255 - rgb[band].min(axis=1)) / 255, 0, 1)
    alpha[band] = a * 255
    out = rgb.copy()
    safe = np.maximum(a, 1e-6)[:, None]
    out[band] = np.clip((rgb[band] - 255 * (1 - safe)) / safe, 0, 255)

    img = Image.fromarray(np.dstack([out, alpha]).round().astype(np.uint8), 'RGBA')
    ys, xs = np.nonzero(alpha > 8)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    art = img.crop(box)
    inner = ext[box[1]:box[3], box[0]:box[2]]
    leak = float(inner.mean())

    room = SIZE * (1 - 2 * PADDING)
    scale = room / max(art.width, art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    return canvas, leak


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    sources = sorted(p for p in SRC.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg'))
    for p in sources:
        icon, leak = process(p)
        dest = OUT / f'{p.stem}.webp'
        icon.save(dest, 'WEBP', quality=90, method=6)
        flag = leak > LEAK_LIMIT
        rows.append((p.name, dest.name, dest.stat().st_size, leak, flag))
        print(f'{p.name:28} -> {dest.name:28} {dest.stat().st_size / 1024:5.1f} KB  open {leak:.0%}{"  FLAG" if flag else ""}')
    lines = [
        '# Onboarding icons: processing report',
        '',
        'Generated by `scripts/prepare-onboarding-icons.py` from `assets/icons/ofc/onboarding/`. Re-run after replacing a source.',
        '',
        '"Open" is the share of the art\'s bounding box the background fill reached. High values can mean the fill leaked',
        'through a gap in an outline into an object\'s white fill. Flagged icons need a look by eye before use.',
        '',
        '| Source | Output | Size | Open | Status |',
        '| --- | --- | --- | --- | --- |',
    ]
    for src, dest, size, leak, flag in rows:
        note = REVIEW.get(Path(src).stem)
        status = '**Check by eye**' if flag else 'OK'
        lines.append(f'| `{src}` | `{dest}` | {size / 1024:.1f} KB | {leak:.0%} | {status}{" (note)" if note else ""} |')
    lines += ['', '## Reviewer notes', '']
    lines += [f'- `{k}`: {v}' for k, v in REVIEW.items()]
    lines += ['- `shared-responsibility`: flagged only because its rays leave a lot of open space; hands and cuffs '
              'kept their white fill (checked by eye).']
    (SRC / 'REPORT.md').write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
