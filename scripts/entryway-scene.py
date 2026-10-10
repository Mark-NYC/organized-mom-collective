#!/usr/bin/env python3
"""
Build the homepage entryway scene from real photos, without touching the originals.

    python3 scripts/entryway-scene.py [--src DIR]

Reads design/entryway/ or --src DIR (spec: design/entryway/README.md):
  background.(png|jpg|webp)   the square plate: entryway, real calendar on the wall, empty console table
  items/<id>.png              one object per file, full canvas (same size as the plate), transparent
                              everywhere except the object and its contact shadow, shot or masked in place

Writes public/images/site/entryway/background-<w>.webp and <id>-<w>.webp (each item trimmed to its
pixels), and src/data/entryway-scene.json with each item's box as a fraction of the plate, which
src/components/site/EntrywayScene.astro uses to place it. Item ids, order and timing live in
src/data/entryway-scene.ts. Requires Pillow (pip install pillow).
"""
import argparse
import json
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'design', 'entryway')
OUT = os.path.join(ROOT, 'public', 'images', 'site', 'entryway')
DATA = os.path.join(ROOT, 'src', 'data', 'entryway-scene.json')
WIDTHS = [720, 1080, 1440]  # rendered widths of the whole scene
PAD = 4  # px kept around each trimmed item at master size, so soft shadow edges aren't clipped


def find_background(src: str) -> str:
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        path = os.path.join(src, f'background.{ext}')
        if os.path.exists(path):
            return path
    sys.exit(f'No background.(png|jpg|webp) in {src}')


def save(img: Image.Image, path: str) -> None:
    img.save(path, 'WEBP', quality=82, alpha_quality=90, method=6)
    print(os.path.relpath(path), img.size, f'{os.path.getsize(path) // 1024} KB')


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--src', default=SRC)
    src = p.parse_args().src
    bg = Image.open(find_background(src)).convert('RGB')
    size = bg.width
    if bg.height != size:
        sys.exit(f'background must be square, got {bg.size}')
    widths = [w for w in WIDTHS if w <= size] or [size]
    os.makedirs(OUT, exist_ok=True)
    for w in widths:
        save(bg.resize((w, w), Image.LANCZOS), os.path.join(OUT, f'background-{w}.webp'))

    items = {}
    item_dir = os.path.join(src, 'items')
    for name in sorted(os.listdir(item_dir)) if os.path.isdir(item_dir) else []:
        if not name.endswith('.png'):
            continue
        item_id = name[:-4]
        layer = Image.open(os.path.join(item_dir, name)).convert('RGBA')
        if layer.size != bg.size:
            sys.exit(f'{name}: {layer.size} does not match the background {bg.size}')
        box = layer.getchannel('A').getbbox()
        if not box:
            sys.exit(f'{name} is fully transparent')
        x0, y0 = max(box[0] - PAD, 0), max(box[1] - PAD, 0)
        x1, y1 = min(box[2] + PAD, size), min(box[3] + PAD, size)
        crop = layer.crop((x0, y0, x1, y1))
        for w in widths:
            scale = w / size
            out = crop.resize((max(round(crop.width * scale), 1), max(round(crop.height * scale), 1)), Image.LANCZOS)
            save(out, os.path.join(OUT, f'{item_id}-{w}.webp'))
        items[item_id] = {
            'left': round(x0 / size, 5),
            'top': round(y0 / size, 5),
            'width': round((x1 - x0) / size, 5),
            'height': round((y1 - y0) / size, 5),
        }

    with open(DATA, 'w') as f:
        json.dump({'widths': widths, 'items': items}, f, indent=2)
        f.write('\n')
    print(os.path.relpath(DATA), f'{len(items)} items')


if __name__ == '__main__':
    sys.exit(main())
