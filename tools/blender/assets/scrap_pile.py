"""
scrap-pile — the big rummageable junk heap the Reclaimer digs into (Option C / PR4).

A "Large" object on the size ladder (docs/asset-style.md): a rough ~5 m × 3 m footprint, ~3 m
tall mound of tumbled wreckage — big enough to read as a landmark you drive up to and work, not
a pickup. Built as a heap of beveled boxes at varied sizes / tilts (so it reads as collapsed
scrap, not a neat stack) with a few rusted WHEELS half-buried in it for silhouette and story.
Mostly `scrap_grey` and `rust` (heavy weathering), with `dark_metal` recesses.

NOT to be confused with `loose-scrap` (the hand-sized pickup): this is the source, those are
what burst out of it as it's rummaged.

Piles aren't strongly directional, but we still author with the "front" toward −Y by convention
so orientation is consistent with every other asset.

Note on the finish: each `beveled_box`/`beveled_cylinder` adds a bevel + weighted-normal
modifier, but `join` keeps only the first chunk's modifiers — and that single bevel then rounds
the *whole* merged heap, so the chunky catch-light edge comes for free across every piece.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


# (name, size (x,y,z) m, palette, location (x,y,z) m, rotation (deg))
_CHUNKS = [
    # Base layer — wide, low slabs forming the mound's bulk (~5 m × 3 m footprint).
    ("base_a", (3.80, 2.60, 0.90), "scrap_grey", (-0.30, 0.00, 0.45), _deg(0, 0, 6)),
    ("base_b", (2.30, 1.90, 0.80), "scrap_grey", (1.15, 0.30, 0.52), _deg(4, 0, -10)),
    ("base_c", (2.00, 1.70, 0.74), "rust", (-1.25, -0.40, 0.42), _deg(-5, 0, 14)),
    ("base_d", (1.80, 1.40, 0.70), "dark_metal", (0.60, 0.90, 0.40), _deg(0, 6, -8)),
    # Mid chunks — cubes and a protruding bar climbing the heap.
    ("mid_grey", (1.60, 1.40, 1.00), "scrap_grey", (0.10, -0.20, 1.30), _deg(8, 12, 5)),
    ("mid_rust", (1.20, 1.00, 0.90), "rust", (-0.90, 0.55, 1.20), _deg(0, 14, -10)),
    ("mid_dark", (1.00, 0.90, 0.80), "dark_metal", (1.20, 0.55, 1.45), _deg(6, 0, 12)),
    ("mid_bar", (0.46, 0.46, 1.70), "rust", (1.45, -0.45, 1.30), _deg(16, 0, 8)),
    # Top bits — smaller shards perched near the crown (~3 m tall).
    ("top_grey", (0.90, 0.80, 0.80), "scrap_grey", (0.00, 0.05, 2.20), _deg(18, 24, 0)),
    ("top_plate", (1.20, 0.24, 0.70), "rust", (-0.45, 0.30, 2.00), _deg(0, 0, 40)),
    ("top_nub", (0.50, 0.50, 0.46), "dark_metal", (0.55, -0.45, 2.40), _deg(14, 10, 22)),
    ("top_spike", (0.30, 0.30, 0.95), "scrap_grey", (-0.20, -0.15, 2.60), _deg(10, 8, 0)),
]

# (name, radius, depth, palette, location (x,y,z) m, rotation (deg)) — rusted wheels in the heap.
# Each disc stands roughly upright (axle ~horizontal) with its centre a radius off the ground so
# its bottom rests near Z=0; a couple lean and one is half-buried/tilted.
_WHEELS = [
    ("wheel_a", 0.66, 0.34, "rust", (1.70, -1.00, 0.66), _deg(90, 0, 10)),
    ("wheel_b", 0.60, 0.32, "dark_metal", (-1.80, 0.92, 0.60), _deg(90, 0, -16)),
    ("wheel_c", 0.54, 0.30, "rust", (0.55, 1.20, 0.52), _deg(72, 22, 0)),
]


def _wheel(name, radius, depth, mat, loc, rot):
    """A faceted tyre with a contrasting hub, joined into one chunk before it joins the heap."""
    tyre = rr.beveled_cylinder(f"{name}_tyre", radius, depth, mat, location=(0, 0, 0), verts=16)
    hub = rr.beveled_cylinder(f"{name}_hub", radius * 0.3, depth + 0.06, "dark_metal",
                              location=(0, 0, 0), verts=8)
    wheel = rr.join([tyre, hub], name)
    wheel.location = loc
    wheel.rotation_euler = rot  # baked when the heap-wide join() pulls it in
    return wheel


def build():
    parts = []
    for name, size, mat, loc, rot in _CHUNKS:
        obj = rr.beveled_box(name, size=size, mat=mat, location=loc)
        obj.rotation_euler = rot  # baked into the mesh when join() pulls it into the heap
        parts.append(obj)
    for name, radius, depth, mat, loc, rot in _WHEELS:
        parts.append(_wheel(name, radius, depth, mat, loc, rot))
    return rr.join(parts, "scrap-pile")
