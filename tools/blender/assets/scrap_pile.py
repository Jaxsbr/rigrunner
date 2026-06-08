"""
scrap-pile — the big rummageable junk heap the Reclaimer digs into (Option C / PR4).

A "Large" object on the size ladder (docs/asset-style.md): a rough ~5 m × 3 m footprint, ~3 m
tall mound of tumbled wreckage — big enough to read as a landmark you drive up to and work, not
a pickup. Built as a HEAP OF MANY SMALL tumbled bits (crushed shards, bars, plates) — denser and
lower at the base, tapering to a crown — with a few rusted WHEELS half-buried for silhouette and
story. The tone is a balanced weathered MIX (no single colour dominates) so the heap reads as
accumulated scavenged junk rather than a stack of slabs.

This module is the single SEEDED generator: `build_variant(key)` builds one of three distinct
piles (`a`/`b`/`c`) — each a different chunk layout AND tone bias — from a fixed seed, so the GLBs
are reproducible. The thin `scrap_pile_a/b/c.py` wrappers are the buildable entry points
(`build_asset.py` runs those → `scrap-pile-{a,b,c}.glb`); `spawnScrapPile` picks one at random.

NOT to be confused with `loose-scrap` (the hand-sized pickup): this is the source, those are
what burst out of it as it's rummaged.

Piles aren't strongly directional, but we still author with the "front" toward −Y by convention
so orientation is consistent with every other asset.

Note on the finish: each `beveled_box`/`beveled_cylinder` adds a bevel + weighted-normal
modifier, but `join` keeps only the first chunk's modifiers — and that single bevel then rounds
the *whole* merged heap, so the chunky catch-light edge comes for free across every piece.
"""

import math
import random

import rr_style as rr

# The heap is built in BANDS up its height. Big, slightly-flattened chunks pack a WIDE, dense base, and
# the chunk size + the spread both shrink with height to a small crown — so the pile carries its weight
# at the bottom (the natural settle of heaped scrap) and tapers like a real mound, instead of reading as
# a floating column of cubes. `_FOOT_*` are the base footprint half-extents (~4.4 m × 3 m); the peak
# lands ~2.2 m, so the heap is wider than tall — a heap, not a tower.
_FOOT_X = 2.2
_FOOT_Y = 1.5

# (spread_frac of the footprint, z centre m, size_min, size_max, count_min, count_max, max_tilt deg,
#  oblate: squash the height so base chunks settle flat rather than stand as cubes; shardy: allow bars/
#  plates/shards for upper scrap variety). Bands overlap in z so the mass reads as one packed mound.
_BANDS = [
    (1.00, 0.18, 0.70, 1.30, 12, 15, 18, True, False),   # base — wide, dense, big, settled flat
    (0.74, 0.66, 0.52, 1.00, 10, 12, 30, False, False),  # lower body
    (0.50, 1.22, 0.40, 0.80, 7, 9, 360, False, True),    # mid — full tumble, some shards
    (0.29, 1.74, 0.28, 0.56, 4, 6, 360, False, True),    # crown — small shards
]

# Per-variant identity: a fixed seed (reproducible mesh) + a weighted tone mix. Every variant uses
# all four weathered tones, but leans a different way so the three read as different heaps — 'a'
# balanced, 'b' rustier, 'c' greyer/darker.
_VARIANTS = {
    "a": {"seed": 11, "weights": [("scrap_grey", 40), ("rust", 30), ("dark_metal", 25), ("bone_white", 5)]},
    "b": {"seed": 23, "weights": [("rust", 44), ("scrap_grey", 26), ("dark_metal", 20), ("bone_white", 10)]},
    "c": {"seed": 37, "weights": [("dark_metal", 40), ("scrap_grey", 38), ("rust", 17), ("bone_white", 5)]},
}


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


def _chunk_size(rng):
    """A small tumbled bit, weighted toward the low end. Mostly crushed cubes/shards, with some
    long bars (rebar/struts) and flat plates (torn panels) mixed in for varied wreckage."""
    roll = rng.random()
    if roll < 0.2:  # bar: long in one axis, thin in the other two
        dims = [rng.uniform(0.7, 1.3), rng.uniform(0.12, 0.26), rng.uniform(0.12, 0.26)]
        rng.shuffle(dims)
        return tuple(dims)
    if roll < 0.32:  # plate: two moderate sides, one thin (a buckled sheet)
        dims = [rng.uniform(0.4, 0.8), rng.uniform(0.4, 0.8), rng.uniform(0.08, 0.18)]
        rng.shuffle(dims)
        return tuple(dims)
    # crushed cube / shard: small, biased toward the low end of 0.3–0.9 m
    s = lambda: 0.3 + (rng.random() ** 1.6) * 0.6
    return (s(), s(), s())


def _wheel(name, radius, depth, mat, loc, rot):
    """A faceted tyre with a contrasting hub, joined into one chunk before it joins the heap."""
    tyre = rr.beveled_cylinder(f"{name}_tyre", radius, depth, mat, location=(0, 0, 0), verts=16)
    hub = rr.beveled_cylinder(f"{name}_hub", radius * 0.3, depth + 0.06, "dark_metal",
                              location=(0, 0, 0), verts=8)
    wheel = rr.join([tyre, hub], name)
    wheel.location = loc
    wheel.rotation_euler = rot  # baked when the heap-wide join() pulls it in
    return wheel


def _band_chunk(rng, name, band, weights):
    """One chunk placed within a height band — scattered across that band's share of the footprint
    (denser toward the centre), sized in the band's range, tilted by the band's character."""
    spread, zc, smin, smax, _, _, tilt, oblate, shardy = band
    ang = rng.uniform(0, math.tau)
    dist = math.sqrt(rng.random())  # sqrt keeps the scatter even out to the band's reach
    x = math.cos(ang) * dist * _FOOT_X * spread
    y = math.sin(ang) * dist * _FOOT_Y * spread
    z = zc + rng.uniform(-0.12, 0.12)

    if shardy and rng.random() < 0.32:
        size = _chunk_size(rng)  # an occasional bar/plate/shard for scrap variety up the heap
    else:
        sz_scale = 0.62 if oblate else 1.0  # base chunks settle flat (squashed), not standing cubes
        size = (smin + (smax - smin) * rng.random(),
                smin + (smax - smin) * rng.random(),
                (smin + (smax - smin) * rng.random()) * sz_scale)

    obj = rr.beveled_box(name, size=size, mat=_pick(rng, weights), location=(x, y, z))
    if tilt >= 360:
        obj.rotation_euler = (_deg(rng, 0, 360), _deg(rng, 0, 360), _deg(rng, 0, 360))  # full tumble
    else:
        obj.rotation_euler = (_deg(rng, -tilt, tilt), _deg(rng, -tilt, tilt), _deg(rng, -tilt, tilt))
    return obj


def build_variant(key):
    """Build one pile variant (`a`/`b`/`c`) — a seeded mound that packs its weight into a wide base and
    tapers to a small crown, plus a few half-buried wheels for silhouette + story."""
    cfg = _VARIANTS[key]
    rng = random.Random(cfg["seed"])
    weights = cfg["weights"]
    parts = []

    i = 0
    for band in _BANDS:
        for _ in range(rng.randint(band[4], band[5])):
            parts.append(_band_chunk(rng, f"{key}_b{i}", band, weights))
            i += 1

    # A few rusted wheels half-buried in the base — silhouette + story, like the old heap kept.
    for w in range(rng.randint(2, 3)):
        ang = rng.uniform(0, math.tau)
        ring = rng.uniform(0.8, 1.6)
        radius = rng.uniform(0.5, 0.64)
        loc = (math.cos(ang) * ring, math.sin(ang) * ring, radius * rng.uniform(0.45, 0.7))  # mostly sunk
        rot = (_deg(rng, 74, 106), 0.0, _deg(rng, -20, 20))
        parts.append(_wheel(f"{key}_wheel{w}", radius, rng.uniform(0.28, 0.34), rng.choice(["rust", "dark_metal"]), loc, rot))

    return rr.join(parts, f"scrap-pile-{key}")


def build():
    """Default standalone build (variant 'a'); the a/b/c wrappers are the committed entry points."""
    return build_variant("a")
