#!/usr/bin/env python3
"""
One-off prep of the entryway scene layers from the two supplied renders in source/.

    python3 design/entryway/prep.py      # needs: pip install pillow numpy opencv-python-headless rembg onnxruntime

source/empty.png and source/full.png are the same entryway but not the same frame (the calendar,
lamp, table and basket shift between them), and the calendar in both is a re-render with garbled
text. So:

  background.png   source/empty.png with its calendar replaced by the real artwork
                   (public/images/site/calendar-cutout-960.webp, scaled and lit to the wall, never redrawn)
  items/<id>.png   each object cut out of source/full.png (rembg + hand clean-up), placed on the
                   empty frame's table and floor, with a soft contact shadow so it sits down

Then run scripts/entryway-scene.py. Rerun this only if the sources change.
"""
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
EMPTY = os.path.join(HERE, 'source', 'empty.png')
FULL = os.path.join(HERE, 'source', 'full.png')
CALENDAR = os.path.join(ROOT, 'public', 'images', 'site', 'calendar-cutout-960.webp')

# --- calendar --------------------------------------------------------------------------------
OLD_CAL = (500, 146, 768, 580)  # the re-rendered calendar plus its shadow, in the empty frame
CAL_W = 256  # real calendar page width in px (≈ 11 in against the ≈ 45 in console table)
CAL_CX, CAL_TOP = 634, 158  # centered where the old one hung, coil at the same height
PAGE = (34, 5, 953, 1364)  # page bounds inside the cutout (rest is its soft shadow)
HOLE = (490, 76)  # hanging hole in the cutout

# --- items: crop box in full.png, offset onto the empty frame, floor or table ------------------
ITEMS = {
    'backpack': dict(box=(235, 870, 455, 1155), move=(0, 0), floor=True, keep=[(215, 850), (448, 850), (448, 1095), (420, 1125), (420, 1175), (215, 1175)]),
    'soccer-ball': dict(box=(636, 1000, 772, 1140), move=(0, 4), floor=True),
    'ballet-bag': dict(box=(425, 930, 625, 1135), move=(0, 0), floor=True),
    'ballet-shoes': dict(box=(355, 1080, 605, 1172), move=(0, 4), floor=True),
    'work-tools': dict(box=(870, 1005, 1102, 1172), move=(0, 6), floor=True),
    'grocery-bag': dict(box=(1018, 885, 1228, 1168), move=(0, 4), floor=True, keep=[(1040, 865), (1250, 865), (1250, 1190), (1040, 1190)]),
    'keys': dict(box=(440, 712, 545, 772), move=(0, 5), floor=False),
    'school-papers': dict(box=(522, 688, 782, 748), move=(0, 5), floor=False),
    # The papers hid the lunchbox's lower-left, so it can only be shown with the papers in front
    # (same beat in src/data/entryway-scene.ts). The water bottle beside it is left out: its cutout
    # came out murky and it would sit into the lamp.
    'lunchbox': dict(box=(700, 585, 880, 742), move=(0, 5), floor=False, keep=[(680, 565), (821, 565), (821, 762), (680, 762)]),
}
PAD = 20


def wall_fill(img: np.ndarray, box) -> np.ndarray:
    """Replace a rectangle of wall by blending the columns either side of it, plus a little grain."""
    x0, y0, x1, y1 = box
    out = img.copy().astype(np.float32)
    left = out[y0:y1, x0 - 6:x0].mean(axis=1)
    right = out[y0:y1, x1:x1 + 6].mean(axis=1)
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    patch = left[:, None, :] * (1 - t) + right[:, None, :] * t
    patch = cv2.GaussianBlur(patch, (0, 0), 6)
    patch += np.random.default_rng(1).normal(0, 1.4, patch.shape)
    mask = np.zeros(img.shape[:2], np.float32)
    mask[y0:y1, x0:x1] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), 3)[..., None]
    full = out.copy()
    full[y0:y1, x0:x1] = patch
    return np.clip(out * (1 - mask) + full * mask, 0, 255).astype(np.uint8)


def background() -> Image.Image:
    empty = np.array(Image.open(EMPTY).convert('RGB'))
    # How the wall light falls across the old calendar's paper: keep the brightest paper, blur away the lines.
    x0, y0, x1, y1 = 515, 200, 752, 565
    paper = cv2.dilate(empty[y0:y1, x0:x1].astype(np.float32), np.ones((9, 9)))
    light = cv2.GaussianBlur(paper, (0, 0), 25) / 255.0

    plate = wall_fill(empty, OLD_CAL)
    cut = Image.open(CALENDAR).convert('RGBA')
    scale = CAL_W / (PAGE[2] - PAGE[0])
    cal = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
    left = round(CAL_CX - (PAGE[0] + (PAGE[2] - PAGE[0]) / 2) * scale)
    top = round(CAL_TOP - PAGE[1] * scale)

    # Light the calendar like the wall around it (multiply), stretching the measured light map over it.
    arr = np.array(cal).astype(np.float32)
    lm = cv2.resize(light, (cal.width, cal.height), interpolation=cv2.INTER_LINEAR)
    arr[..., :3] *= np.clip(lm * 1.03, 0, 1)
    cal = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    base = Image.fromarray(plate).convert('RGBA')
    # Soft cast shadow, light from the window on the left.
    a = cal.getchannel('A').filter(ImageFilter.GaussianBlur(7))
    shadow = Image.new('RGBA', cal.size, (70, 50, 35, 0))
    shadow.putalpha(a.point(lambda v: int(v * 0.28)))
    base.alpha_composite(shadow, (left + 7, top + 6))
    base.alpha_composite(cal, (left, top))
    # Nail through the hanging hole.
    d = ImageDraw.Draw(base)
    hx, hy = left + HOLE[0] * scale, top + HOLE[1] * scale
    d.ellipse((hx - 2.2, hy - 2.6, hx + 2.2, hy + 1.8), fill=(92, 80, 70, 255))
    return base.convert('RGB')


def contact_shadow(alpha: np.ndarray, strength: float) -> np.ndarray:
    """A soft shadow along the bottom of an object, thrown slightly right (window light from the left)."""
    h, w = alpha.shape
    ys, xs = np.nonzero(alpha > 128)
    if not len(ys):
        return np.zeros_like(alpha, np.float32)
    bottom = ys.max()
    sh = np.zeros((h, w), np.float32)
    lo, hi = xs.min(), xs.max()
    cy = bottom - 2
    cv2.ellipse(sh, (int((lo + hi) / 2 + 6), int(cy)), (int((hi - lo) / 2 * 0.95), max(int((hi - lo) * 0.06), 4)), 0, 0, 360, 1.0, -1)
    sh = cv2.GaussianBlur(sh, (0, 0), max((hi - lo) * 0.05, 3))
    return sh * strength


def items(size) -> dict:
    full = Image.open(FULL).convert('RGB')
    session = new_session('isnet-general-use')
    layers = {}
    for name, cfg in ITEMS.items():
        x0, y0, x1, y1 = cfg['box']
        crop_box = (x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD)
        cut = np.array(remove(full.crop(crop_box), session=session)).astype(np.float32)
        if 'keep' in cfg:  # drop neighbours the cutout caught
            m = Image.new('L', (cut.shape[1], cut.shape[0]), 0)
            ImageDraw.Draw(m).polygon([(x - crop_box[0], y - crop_box[1]) for x, y in cfg['keep']], fill=255)
            cut[..., 3] *= np.array(m.filter(ImageFilter.GaussianBlur(1.5))) / 255.0
        # Place on a full canvas at its spot in the empty frame.
        layer = np.zeros((size[1], size[0], 4), np.float32)
        dx, dy = cfg['move']
        ox, oy = crop_box[0] + dx, crop_box[1] + dy
        h, w = cut.shape[:2]
        layer[oy:oy + h, ox:ox + w] = cut
        # Contact shadow under it, part of the same layer so it fades with the object.
        sh = contact_shadow(layer[..., 3], 0.45 if cfg['floor'] else 0.3)
        sh_col = np.array([45, 30, 20], np.float32)
        a_obj = layer[..., 3:4] / 255.0
        a_sh = sh[..., None] * (1 - a_obj)
        a_out = a_obj + a_sh
        rgb = np.where(a_out > 0, (layer[..., :3] * a_obj + sh_col * a_sh) / np.maximum(a_out, 1e-6), 0)
        layers[name] = Image.fromarray(np.dstack([rgb, a_out * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    return layers


def main() -> None:
    bg = background()
    bg.save(os.path.join(HERE, 'background.png'))
    os.makedirs(os.path.join(HERE, 'items'), exist_ok=True)
    for name, layer in items(bg.size).items():
        layer.save(os.path.join(HERE, 'items', f'{name}.png'))
        print('items/' + name + '.png')
    print('background.png', bg.size)


if __name__ == '__main__':
    main()
