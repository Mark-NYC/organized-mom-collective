#!/usr/bin/env python3
"""Remove only the outer white/JPEG background, preserving enclosed white details.
Creates transparent WebPs alongside the five source JPEG icons.
"""
from pathlib import Path
from collections import deque
from PIL import Image
import numpy as np
from scipy.ndimage import binary_propagation

ROOT = Path("assets/icons/ofc/updatedicons/svg")
NAMES = ["comb-my-hair", "clothes-in-hamper", "sort-laundry", "dust-furniture", "tidy-living-room"]
for name in NAMES:
    source = ROOT / f"{name}.jpg"
    image = Image.open(source).convert("RGB")
    pixels = np.asarray(image, dtype=np.uint8)
    light = pixels.min(axis=2) > 225
    seed = np.zeros(light.shape, dtype=bool)
    seed[0,:] = light[0,:]
    seed[-1,:] = light[-1,:]
    seed[:,0] = light[:,0]
    seed[:,-1] = light[:,-1]
    exterior = binary_propagation(seed, mask=light)
    # White connected to the canvas edge is background; enclosed white stays opaque.
    rgba = np.dstack([pixels, np.where(exterior, 0, 255).astype("uint8")])
    # Avoid near-white fringe along boundaries of the removed background.
    from scipy.ndimage import binary_dilation
    halo = binary_dilation(exterior, iterations=2) & ~exterior & (pixels.min(axis=2) > 200)
    rgba[halo, 3] = np.minimum(rgba[halo, 3], ((255 - pixels.min(axis=2)[halo]) * 255 / 55).clip(0, 255).astype("uint8"))
    target = ROOT / f"{name}.webp"
    Image.fromarray(rgba, "RGBA").save(target, "WEBP", lossless=True, method=6)
    print(f"{source} -> {target}")
