"""
loose-scrap — a hand-sized cluster of debris the rig sweeps up by driving over it (M1).

The "Pickup" rung of the size ladder (docs/asset-style.md): a ~0.4 m clump, small enough to read
as a single grabbable bit on the ground. It is the dedicated small-scrap asset the field scatter
and the scrap-pile rummage burst both spawn — distinct from the big `scrap-pile` heap (the source
those pieces fly out of). A few tumbled beveled boxes, mostly `scrap_grey` with a `rust` accent.

Front toward −Y by convention, like every other asset (a clump has no real facing).
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


# (name, size (x,y,z) m, palette, location (x,y,z) m, rotation (deg))
_CHUNKS = [
    ("base", (0.34, 0.28, 0.18), "scrap_grey", (0.00, 0.00, 0.09), _deg(0, 0, 10)),
    ("lump", (0.22, 0.20, 0.18), "rust", (0.10, -0.06, 0.20), _deg(12, 18, -8)),
    ("shard", (0.16, 0.15, 0.14), "dark_metal", (-0.10, 0.08, 0.17), _deg(20, 0, 24)),
]


def build():
    parts = []
    for name, size, mat, loc, rot in _CHUNKS:
        obj = rr.beveled_box(name, size=size, mat=mat, location=loc)
        obj.rotation_euler = rot
        parts.append(obj)
    return rr.join(parts, "loose-scrap")
