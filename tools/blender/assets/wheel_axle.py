"""
wheel-axle — the chassis's WHEEL & AXLE sub-part (the drive contact / top-speed piece).

A "Small part" on the size ladder (docs/asset-style.md): a ~1.2 m-wide axle carrying a faceted tyre
at each end. The read is unmistakable — two wheels on a shaft — the chassis sub-part that sets top
speed. Shared by both chassis sizes (the spec's "three models, scaled per size" default); the in-game
chassis still renders as its whole GLB until Phase 2b composes products from sub-parts.

The axle runs along Blender +X (the track), matching the whole-chassis convention (chassis_common.py)
where wheels sit on the sides. The central diff housing is the first chunk (axis-aligned) so the
merged transform stays clean; the axle and wheels are laid along +X and `join` bakes those rotations
in. Wheel bottoms sit on Z=0 (radius == hub height) so the part rests cleanly on the ground.
"""

import math

import rr_style as rr

WHEEL_R = 0.33
TREAD = 0.28
HUB_W = TREAD + 0.06


def _cyl_x(name, r, d, mat, loc, verts=16):
    """A cylinder laid along Blender +X (the axle/track)."""
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (0.0, math.radians(90), 0.0)
    return obj


def _wheel(side, x):
    """A faceted dark tyre + rust hub + two hazard lug nubs, laid on the +X axle at offset `x`."""
    z = WHEEL_R
    return [
        _cyl_x(f"tyre_{side}", WHEEL_R, TREAD, "dark_metal", (x, 0.0, z), verts=16),
        _cyl_x(f"hub_{side}", 0.12, HUB_W, "rust", (x, 0.0, z), verts=10),
        rr.beveled_box(f"lug_{side}_a", (0.05, 0.05, 0.07), "hazard_yellow", (x, 0.0, z + 0.14)),
        rr.beveled_box(f"lug_{side}_b", (0.05, 0.05, 0.07), "hazard_yellow", (x, 0.14, z)),
    ]


def build():
    parts = [
        # Diff housing — the central dark box the axle runs through (first chunk; bevel rounds the join,
        # identity rotation keeps the merged transform clean).
        rr.beveled_box("diff", (0.22, 0.22, 0.20), "dark_metal", (0.0, 0.0, WHEEL_R)),
        # Axle — the scrap_grey shaft spanning the track.
        _cyl_x("axle", 0.05, 1.04, "scrap_grey", (0.0, 0.0, WHEEL_R)),
    ]
    parts += _wheel("l", -0.55)
    parts += _wheel("r", 0.55)
    return rr.join(parts, "wheel-axle")
