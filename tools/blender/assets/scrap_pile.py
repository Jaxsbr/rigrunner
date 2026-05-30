"""
scrap-pile — a low, irregular mound of junk metal the player drives up to and rummages (M2).

A "Medium" object on the size ladder (docs/asset-style.md): ~1.4 m footprint, ~0.7 m tall —
low enough to see over, wide enough to drive around. Built as a heap of beveled boxes at
varied sizes / tilts so it reads as tumbled scrap rather than a neat stack. Mostly `scrap_grey`
with a couple of `rust` and `dark_metal` accents.

Piles aren't strongly directional, but we still author with the "front" toward −Y by convention
so orientation is consistent with every other asset.

Note on the finish: each `beveled_box` adds a bevel + weighted-normal modifier, but `join`
keeps only the first chunk's modifiers — and that single bevel then rounds the *whole* merged
heap. So the chunky catch-light edge comes for free across every piece.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


# (name, size (x,y,z) m, palette, location (x,y,z) m, rotation (deg))
_CHUNKS = [
    # Base layer — wide, low slabs forming the mound's bulk (~1.5 m footprint = Medium class).
    ("base_a", (1.40, 1.15, 0.34), "scrap_grey", (0.00, 0.00, 0.17), _deg(0, 0, 8)),
    ("base_b", (1.00, 0.85, 0.30), "scrap_grey", (0.30, -0.10, 0.33), _deg(5, 0, -12)),
    ("base_c", (0.92, 0.78, 0.28), "scrap_grey", (-0.32, 0.16, 0.31), _deg(-6, 0, 18)),
    # Mid chunks — cubes and a protruding bar.
    ("mid_grey", (0.50, 0.50, 0.46), "scrap_grey", (0.05, 0.06, 0.55), _deg(10, 15, 5)),
    ("mid_rust", (0.40, 0.46, 0.36), "rust", (-0.30, -0.22, 0.50), _deg(0, 20, -10)),
    ("mid_bar", (0.28, 0.28, 0.54), "dark_metal", (0.34, 0.24, 0.56), _deg(14, 0, 8)),
    # Top bits — small shards perched on the heap.
    ("top_grey", (0.32, 0.32, 0.30), "scrap_grey", (0.00, -0.04, 0.74), _deg(22, 30, 0)),
    ("top_plate", (0.55, 0.13, 0.34), "rust", (-0.12, 0.28, 0.60), _deg(0, 0, 42)),
    ("top_nub", (0.26, 0.26, 0.20), "dark_metal", (0.24, -0.28, 0.66), _deg(16, 10, 26)),
]


def build():
    parts = []
    for name, size, mat, loc, rot in _CHUNKS:
        obj = rr.beveled_box(name, size=size, mat=mat, location=loc)
        obj.rotation_euler = rot  # baked into the mesh when join() pulls it into the heap
        parts.append(obj)
    return rr.join(parts, "scrap-pile")
