#!/usr/bin/env python3
"""
Make the web sizes of one responsibility illustration, without touching the original.

    python3 scripts/responsibility-image.py SOURCE ID

SOURCE  the original artwork (PNG or WebP with a transparent background), e.g. a file from the card artist
ID      the responsibility id in src/data/responsibilities.ts, e.g. brush-my-teeth

Copies SOURCE unchanged to design/responsibilities/{ID}.{ext} (the kept original) and writes
public/images/responsibilities/{ID}-{128,256}.webp: square, transparent, resized only (no crop, no recolor).
128 is the picker tile (56 px, sharp on 2× screens); 256 is the chart icon, sharp in the 2× PNG export.
Then set `image: true` on the responsibility. Requires Pillow.
"""
import argparse
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
ORIGINALS = os.path.join(ROOT, 'design', 'responsibilities')
OUT_DIR = os.path.join(ROOT, 'public', 'images', 'responsibilities')
SIZES = (128, 256)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('source')
    p.add_argument('id')
    a = p.parse_args()

    img = Image.open(a.source).convert('RGBA')
    w, h = img.size
    if w != h:
        sys.exit(f'{a.source} is {w}×{h}; the illustrations are square. Ask for a square export rather than cropping.')
    if img.getextrema()[3][0] == 255:
        sys.exit(f'{a.source} has no transparent pixels; ask for the transparent original.')

    os.makedirs(ORIGINALS, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    ext = os.path.splitext(a.source)[1].lower()
    kept = os.path.join(ORIGINALS, f'{a.id}{ext}')
    if os.path.abspath(a.source) != os.path.abspath(kept):
        shutil.copyfile(a.source, kept)
    print(os.path.relpath(kept, ROOT), f'{w}×{h}', f'{os.path.getsize(kept) // 1024} KB (original, unchanged)')
    for size in SIZES:
        out = img.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'{a.id}-{size}.webp')
        out.save(path, 'WEBP', quality=86, method=6, exact=True)
        print(os.path.relpath(path, ROOT), f'{size}×{size}', f'{os.path.getsize(path) / 1024:.1f} KB')


if __name__ == '__main__':
    sys.exit(main())
