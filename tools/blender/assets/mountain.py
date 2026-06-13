"""
mountain — a craggy rock massif that tiles into the ring of peaks bounding the world (Phase 1's
"bowl wall"): the worked, textured floor sits inside a circle of these, and they physically block
the way out except at the exit gaps (features/terrain places + rotates + scales copies around the ring).

Authored as ONE wide, asymmetric cluster: a settled rubble BASE spreading ~24 m, a dominant central
SPIRE rising ~16 m, and a few lower flanking spurs — jagged stacks of tilted faceted slabs, so the
bevel catch-light reads the silhouette as rock. The asymmetry is the point: rotated + scaled per
instance, the copies read as a varied range rather than a repeated stamp.

A "bigger-than-Large" landmark on the size ladder — terrain, not a part, far out on the horizon.
Earthy weathered tones (grey/dark/rust, a little bone), no single colour dominating, so it reads as
dusty rock/scrap rather than a polished slab. Built from a fixed seed (reproducible GLB). Front toward
-Y by convention (a mountain isn't directional, but orientation stays consistent with every asset).
"""

import math
import random

import bpy  # type: ignore  # Blender runtime (used to bake the merged rotation before grounding — see build)
import rr_style as rr

_SEED = 71

# Footprint half-extents (m) — wide + deep so one massif fills a ring segment.
_FOOT_X = 12.0
_FOOT_Y = 7.0

# The weathered tone mix every chunk draws from — leaning grey/dark rock with rust streaks.
_TONES = [("scrap_grey", 38), ("dark_metal", 32), ("rust", 22), ("bone_white", 8)]

# The spires that set the silhouette: (x, y, base_w, base_d, height). One dominant central peak plus
# lower, offset flanking spurs — never symmetric, so the rotated copies don't read as a stamp.
_SPIRES = [
    (0.0, 0.0, 7.5, 5.5, 16.0),    # dominant central peak
    (-7.8, 1.6, 5.2, 4.2, 11.5),   # left shoulder
    (7.6, -1.4, 4.6, 3.8, 9.5),    # right spur
    (2.6, 3.2, 3.6, 3.2, 7.0),     # back spur
    (-3.4, -3.0, 3.2, 3.0, 6.0),   # front-left nub
]


def _deg(rng, lo, hi):
    return math.radians(rng.uniform(lo, hi))


def _pick(rng, weights):
    """Weighted random palette key from a [(name, weight), ...] table."""
    total = sum(w for _, w in weights)
    r = rng.uniform(0, total)
    upto = 0.0
    for name, w in weights:
        upto += w
        if r <= upto:
            return name
    return weights[-1][0]


def _rock(rng, name, size, mat, loc, tilt):
    """One angular rock slab: a beveled box given a random small tumble so faces face every which way."""
    obj = rr.beveled_box(name, size=size, mat=mat, location=loc)
    obj.rotation_euler = (_deg(rng, -tilt, tilt), _deg(rng, -tilt, tilt), _deg(rng, -tilt, tilt))
    return obj


def _spire(rng, name, cx, cy, base_w, base_d, height):
    """A jagged spire: a stack of tilted slabs that taper + drift as they rise, so it zig-zags to a
    rough point rather than a clean pyramid. The slabs overlap in z so the spire reads as one mass."""
    parts = []
    layers = max(4, int(height / 2.3))
    for i in range(layers):
        f = i / (layers - 1)                       # 0 at the base → 1 at the tip
        w = base_w * (1.0 - f * 0.80)              # taper to a narrow crown
        d = base_d * (1.0 - f * 0.80)
        h = (height / layers) * rng.uniform(1.15, 1.55)  # overlap into the slab below
        z = f * height + h * 0.25
        drift = (1.0 - f) * 0.7                     # the lower stack wanders more; the tip settles
        x = cx + rng.uniform(-drift, drift)
        y = cy + rng.uniform(-drift, drift)
        tilt = 7 + f * 16                           # crags lean harder toward the top
        parts.append(_rock(rng, f"{name}_{i}", (w, d, h), _pick(rng, _TONES), (x, y, z), tilt))
    return parts


def _base_rubble(rng, n):
    """A settled apron of large angular boulders around the spires' feet — wide, low, oblate, so the
    massif carries its weight at the base and the spires don't look planted on bare ground."""
    parts = []
    for i in range(n):
        ang = rng.uniform(0, math.tau)
        dist = math.sqrt(rng.random())            # even scatter out to the footprint edge
        x = math.cos(ang) * dist * _FOOT_X
        y = math.sin(ang) * dist * _FOOT_Y
        w = rng.uniform(2.2, 4.6)
        d = rng.uniform(2.0, 4.0)
        h = rng.uniform(1.4, 3.2)                  # squat — boulders, not towers
        z = h * 0.4                                # mostly resting, a little sunk
        parts.append(_rock(rng, f"rubble_{i}", (w, d, h), _pick(rng, _TONES), (x, y, z), 16))
    return parts


def build():
    """Build the mountain massif: a rubble base + several jagged spires, merged into one rock mesh."""
    rng = random.Random(_SEED)
    parts = _base_rubble(rng, 16)
    for i, (x, y, bw, bd, ht) in enumerate(_SPIRES):
        parts.extend(_spire(rng, f"spire{i}", x, y, bw, bd, ht))

    merged = rr.join(parts, "mountain")
    # `join` keeps the first chunk as the merged root, and that chunk carries a tumble tilt — so the
    # merged object inherits a non-identity rotation. Grounding (set_origin_base_center) overestimates
    # the low extent under a rotation and floats the asset; bake the rotation into the mesh first so the
    # grounding transform is a pure translation that lands exactly on the floor (see scrap_pile.py).
    bpy.ops.object.select_all(action="DESELECT")
    merged.select_set(True)
    bpy.context.view_layer.objects.active = merged
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return merged
