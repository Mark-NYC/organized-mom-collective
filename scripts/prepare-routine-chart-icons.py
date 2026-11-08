#!/usr/bin/env python3
"""Clean copies of the approved hand-drawn icon-library PNGs for August's routine charts.

The originals in public/images/club/icon-library/ carry a near-invisible alpha haze (alpha 1-15) across the whole
canvas, which prints as a faint gray box on the charts' tinted rows. This zeroes only that haze; the drawing's own
pixels (and their antialiased edges above the threshold) are untouched. Re-run after an icon changes:

    python3 scripts/prepare-routine-chart-icons.py
"""
from pathlib import Path
from PIL import Image

SRC = Path("public/images/club/icon-library")
OUT = Path("public/images/club/routine-icons")
NAMES = [
    "morning-start", "getting-dressed", "breakfast-bowl", "toothbrush", "backpack", "sneakers", "lunch-box", "water-bottle",
    "washing-hands", "yogurt-cup", "doing-homework", "free-afternoon", "quiet-time", "playing-with-friends",
]
THRESHOLD = 16

OUT.mkdir(parents=True, exist_ok=True)
for name in NAMES:
    image = Image.open(SRC / f"{name}.png").convert("RGBA")
    alpha = image.getchannel("A").point(lambda a: 0 if a < THRESHOLD else a)
    image.putalpha(alpha)
    # Trim the empty margin so every icon fills its slot the same way.
    box = alpha.getbbox()
    if box:
        image = image.crop(box)
    image.save(OUT / f"{name}.png", optimize=True)
    print(f"{name}: {image.size[0]}x{image.size[1]}")
