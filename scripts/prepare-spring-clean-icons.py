#!/usr/bin/env python3
"""Print-ready copies of the approved black-and-white icons March's Spring Clean job guides use.

Sources (never changed): the March chore set (assets/icons/ofc/march/*.webp) and the Club icon library
(public/images/club/icon-library/*.png), as named in src/data/club/spring-clean-guides.ts. Each copy:
  1. zeroes only the near-invisible alpha haze (alpha below 16) the library PNGs carry, which prints as a faint gray box
     (same rule as scripts/prepare-routine-chart-icons.py); the drawing's own pixels are untouched;
  2. trims to the drawing itself, so every icon is sized by its lines, not by its canvas's padding;
  3. centers it on a transparent 256 x 256 square with the same margin for every icon.
Out: public/images/club/spring-clean-icons/<set>-<name>.png ('m' March, 'l' library). Re-run after a guide's icon
changes:  python3 scripts/prepare-spring-clean-icons.py
"""
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/images/club/spring-clean-icons"
SIZE, MARGIN, HAZE, INK = 256, 0.08, 16, 40

guides = (ROOT / "src/data/club/spring-clean-guides.ts").read_text()
icons = sorted(set(re.findall(r"\b(m|lib)\('([a-z-]+)'\)", guides)))
OUT.mkdir(parents=True, exist_ok=True)
for kind, name in icons:
    src = ROOT / (f"assets/icons/ofc/march/{name}.webp" if kind == "m" else f"public/images/club/icon-library/{name}.png")
    image = Image.open(src).convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda a: 0 if a < HAZE else a))
    box = image.getchannel("A").point(lambda a: 255 if a > INK else 0).getbbox()
    art = image.crop(box)
    inner = round(SIZE * (1 - 2 * MARGIN))
    scale = inner / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2), art)
    canvas.putalpha(canvas.getchannel("A").point(lambda a: 0 if a < 8 else a))  # no faint fringe from resampling
    canvas.save(OUT / f"{'m' if kind == 'm' else 'l'}-{name}.png", optimize=True)
# Copies of icons no guide uses any more go.
keep = {f"{'m' if k == 'm' else 'l'}-{n}.png" for k, n in icons}
for old in OUT.glob("*.png"):
    if old.name not in keep:
        old.unlink()
print(f"{len(icons)} icons → {OUT.relative_to(ROOT)}")
