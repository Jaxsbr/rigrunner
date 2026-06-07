"""
debris-heap — a small tumble of wreckage strewn around a looter camp (the 'damage' half of the camp's
environmental mess): a knee-high mound of scrap chunks at varied tilts, a little brother of the big
rummageable scrap-pile. Spawns scattered around the camp and sinks into the ground when it's cleared.

A static single-mesh prop (~1.3 m footprint, ~0.6 m tall). World decoration, not a part — no tier, no
collider. Authored 'front' toward −Y by convention (it isn't directional).

Finish note: like the scrap-pile, join() keeps only the first chunk's bevel, which then rounds the
whole merged heap — so the chunky catch-light edge comes for free across every piece.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


# (name, size (x,y,z) m, palette, location (x,y,z) m, rotation (deg)) — tumbled, none neatly stacked.
_CHUNKS = [
    ("heap_base_a", (0.90, 0.70, 0.34), "scrap_grey", (-0.10, 0.00, 0.17), _deg(0, 0, 8)),
    ("heap_base_b", (0.66, 0.58, 0.30), "rust", (0.42, 0.18, 0.16), _deg(4, 0, -12)),
    ("heap_base_c", (0.58, 0.50, 0.28), "dark_metal", (-0.40, -0.22, 0.15), _deg(-6, 0, 14)),
    ("heap_mid", (0.54, 0.46, 0.40), "scrap_grey", (0.05, -0.05, 0.46), _deg(10, 14, 6)),
    ("heap_bar", (0.20, 0.20, 0.66), "rust", (0.30, -0.30, 0.42), _deg(20, 0, 10)),
    ("heap_plate", (0.50, 0.12, 0.34), "dark_metal", (-0.25, 0.25, 0.42), _deg(0, 0, 50)),
]


def build():
    parts = []
    for name, size, mat, loc, rot in _CHUNKS:
        obj = rr.beveled_box(name, size=size, mat=mat, location=loc)
        obj.rotation_euler = rot  # baked into the mesh when join() pulls it into the heap
        parts.append(obj)
    return rr.join(parts, "debris-heap")
