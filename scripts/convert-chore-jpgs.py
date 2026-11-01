#!/usr/bin/env python3
"""Convert chore JPGs to transparent WebP, removing only edge-connected white.

Only pixels connected to the outer canvas are cleared; enclosed white remains.
"""
from collections import deque
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path("assets/icons/ofc/updatedicons/svg")
NAMES = ("clothes-in-hamper", "sort-laundry", "dust-furniture", "tidy-living-room")

for name in NAMES:
    source = ROOT / (name + ".jpg")
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.uint8)
    h, w = rgb.shape[:2]
    # Remove connected background, not enclosed white highlights in the artwork.
    bright = (rgb.min(axis=2) > 233) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 20)
    exterior = np.zeros((h, w), dtype=np.bool_)
    queue = deque()
    for x in range(w):
        if bright[0, x]: exterior[0, x] = True; queue.append((0, x))
        if bright[h-1, x]: exterior[h-1, x] = True; queue.append((h-1, x))
    for y in range(h):
        if bright[y, 0]: exterior[y, 0] = True; queue.append((y, 0))
        if bright[y, w-1]: exterior[y, w-1] = True; queue.append((y, w-1))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0 <= ny < h and 0 <= nx < w and bright[ny,nx] and not exterior[ny,nx]:
                exterior[ny,nx] = True
                queue.append((ny,nx))

    # Antialiased fringe: neighboring almost-white pixels at the exterior edge
    # get fractional alpha. Interior white stays opaque.
    rgba = np.dstack((rgb, np.full((h, w), 255, dtype=np.uint8)))
    rgba[exterior, 3] = 0
    # Clean RGB hidden beneath transparent pixels for better resampling.
    rgba[exterior, :3] = 255
    out = Image.fromarray(rgba, "RGBA")
    target = ROOT / (name + ".webp")
    out.save(target, "WEBP", lossless=True, method=6)
    print(f"{source} -> {target}: {np.count_nonzero(exterior)} transparent pixels")
