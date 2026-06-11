"""
yard-plant — a potted plant in a metal planter: the shop's quiet sign of life, the one bit of green by an
otherwise barren trade post.

Kept from the earlier shopfront (the part of the dressing that worked), with two fixes: the foliage is
`leaf_green` — the muted sage that matches the restored-tree leaves and sits in the sun-baked palette, NOT
the saturated `nature_green` that read as neon — and it's a standalone prop now, so the yard layout can set
it forward and a little misaligned from the building (features/shop/shop-yard.ts) rather than flush to a wall.

A static single-mesh prop (~0.9 m). World decoration, not a part — no tier, no collider. The planter is the
first (axis-aligned) piece so grounding lands true; the leaf slabs above are tilted for a bushy read.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []
    # Planter FIRST (axis-aligned).
    parts.append(rr.beveled_box("planter", size=(0.46, 0.46, 0.42), mat="rust", location=(0.0, 0.0, 0.21)))
    parts.append(rr.beveled_box("planter_rim", size=(0.52, 0.52, 0.07), mat="dark_metal", location=(0.0, 0.0, 0.42)))
    parts.append(rr.beveled_box("plant_stem", size=(0.07, 0.07, 0.34), mat="leaf_green", location=(0.0, 0.0, 0.58)))

    # A bushy clump of angled leaf slabs so the foliage reads full from the elevated camera.
    leaves = [
        ((0.32, 0.20, 0.22), (-0.10, -0.04, 0.66), _deg(20, 0, 23)),
        ((0.20, 0.32, 0.24), (0.10, 0.06, 0.70), _deg(12, 18, 57)),
        ((0.28, 0.26, 0.24), (-0.02, 0.08, 0.78), _deg(-14, 12, 34)),
        ((0.22, 0.22, 0.22), (0.06, -0.08, 0.82), _deg(14, -12, 80)),
        ((0.18, 0.18, 0.20), (-0.06, 0.02, 0.90), _deg(6, 24, -28)),
    ]
    for i, (size, loc, rot) in enumerate(leaves):
        leaf = rr.beveled_box(f"leaf_{i}", size=size, mat="leaf_green", location=loc)
        leaf.rotation_euler = rot
        parts.append(leaf)

    return rr.join(parts, "yard-plant")
