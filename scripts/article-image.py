#!/usr/bin/env python3
"""
Make responsive article images from an original photo, without touching the original.

    python3 scripts/article-image.py SOURCE NAME [--crop x0,y0,x1,y1] [--widths 640,960,1440]

SOURCE   an original photo, e.g. design/etsy-listing/11.webp (never edited)
NAME     output base name, e.g. hc-01-hero → public/images/resources/hc-01-hero-{width}.webp
--crop   optional crop box as fractions of the image (0–1): left,top,right,bottom.
         Crop only to frame the photo or remove a text overlay; never alter what it shows.
--widths output widths in px (default 640,960,1440; capped at the cropped width)

Prints the output files and the cropped aspect ratio (use it for the component's width/height).
Requires Pillow (pip install pillow). Rules: docs/editorial/BLOG_EDITORIAL_STYLE.md → Photography.
"""
import argparse
import os
import sys

from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'resources')


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('source')
    p.add_argument('name')
    p.add_argument('--crop', default='0,0,1,1')
    p.add_argument('--widths', default='640,960,1440')
    a = p.parse_args()

    img = Image.open(a.source).convert('RGB')
    x0, y0, x1, y1 = (float(v) for v in a.crop.split(','))
    w, h = img.size
    img = img.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    cw, ch = img.size
    os.makedirs(OUT_DIR, exist_ok=True)
    for width in sorted({min(int(v), cw) for v in a.widths.split(',')}):
        out = img.resize((width, round(ch * width / cw)), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'{a.name}-{width}.webp')
        out.save(path, 'WEBP', quality=82, method=6)
        print(os.path.relpath(path), out.size, f'{os.path.getsize(path) // 1024} KB')
    print(f'aspect {cw}:{ch} ≈ {cw / ch:.3f}')


if __name__ == '__main__':
    sys.exit(main())
