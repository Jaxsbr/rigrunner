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

# The mound envelope: chunks scatter within a ~4 m × 2.6 m footprint (half-extents below) up to ~3 m,
# narrowing toward the top so the silhouette tapers to a crown rather than a column. Kept tight on
# purpose — a loose wide scatter reads as a debris field, not a heap you drive up to and work.
_HX = 1.95
_HY = 1.25
_H = 2.7

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


def build_variant(key):
    """Build one pile variant (`a`/`b`/`c`) — a seeded heap of small tumbled chunks + buried wheels."""
    cfg = _VARIANTS[key]
    rng = random.Random(cfg["seed"])
    weights = cfg["weights"]
    parts = []

    # A solid core: a tight cluster of mid-size chunks at the centre base gives the heap a packed heart
    # so it reads as mass, not a hollow scatter — without the wide flat slabs that used to look like furniture.
    for i in range(rng.randint(4, 5)):
        size = (rng.uniform(0.9, 1.3), rng.uniform(0.8, 1.2), rng.uniform(0.6, 0.95))
        loc = (rng.uniform(-0.7, 0.7), rng.uniform(-0.5, 0.5), rng.uniform(0.3, 0.9))
        obj = rr.beveled_box(f"{key}_core{i}", size=size, mat=_pick(rng, weights), location=loc)
        obj.rotation_euler = (_deg(rng, -14, 14), _deg(rng, -14, 14), _deg(rng, -30, 30))
        parts.append(obj)

    # The rubble: many small bits packed densely, fullest through the body and tapering to the crown,
    # tumbled to every angle. The tight envelope + count keeps them overlapping so it reads as a heap.
    for i in range(rng.randint(34, 42)):
        f = rng.random() ** 1.25  # height fraction 0..1, slightly biased toward the base
        taper = 1.0 - f * 0.72    # the footprint the chunk may land in shrinks toward the crown
        x = rng.uniform(-_HX, _HX) * taper
        y = rng.uniform(-_HY, _HY) * taper
        z = f * _H
        obj = rr.beveled_box(f"{key}_bit{i}", size=_chunk_size(rng), mat=_pick(rng, weights), location=(x, y, z))
        obj.rotation_euler = (_deg(rng, 0, 360), _deg(rng, 0, 360), _deg(rng, 0, 360))  # full tumble
        parts.append(obj)

    # A few rusted wheels half-buried around the base — silhouette + story, like the old heap kept.
    for i in range(rng.randint(2, 3)):
        ang = rng.uniform(0, math.tau)
        ring = rng.uniform(0.7, 1.4)
        radius = rng.uniform(0.5, 0.64)
        loc = (math.cos(ang) * ring, math.sin(ang) * ring, radius * rng.uniform(0.55, 0.85))  # partly sunk
        rot = (_deg(rng, 72, 108), 0.0, _deg(rng, -20, 20))
        parts.append(_wheel(f"{key}_wheel{i}", radius, rng.uniform(0.28, 0.34), rng.choice(["rust", "dark_metal"]), loc, rot))

    return rr.join(parts, f"scrap-pile-{key}")


def build():
    """Default standalone build (variant 'a'); the a/b/c wrappers are the committed entry points."""
    return build_variant("a")
