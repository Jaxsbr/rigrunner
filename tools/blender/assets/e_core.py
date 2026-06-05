"""
e-core — the electric engine's CONVERTER sub-part, the type-defining heart (⚡ vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a ~0.5 m-wide, ~0.7 m-tall reactor coil.
This is the iconic glowing piece — the part that says "electric" at a glance: a stack of glow_green
emissive coil rings around a dark_metal spindle, capped top and bottom with scrap_grey, on a
dark_metal base. The §3 cue (glow_green = energy/powered) carries the whole identity here.

Vertical form, so the cylinders sit on Blender's default Z axle (no rotation). The base cylinder is
the first chunk; its bevel rounds the whole join (the house finish). Footprint stays well under one
grid cell so it reads as a component, not a machine.
"""

import rr_style as rr


def _cyl(name, r, d, mat, z, verts=16):
    """A vertical (Z-axle) cylinder centred on the part axis at height `z`."""
    return rr.beveled_cylinder(name, r, d, mat, location=(0.0, 0.0, z), verts=verts)


def build():
    parts = [
        # Base plate — the heavy footing the coil rises from. First chunk → its bevel rounds the join.
        _cyl("base", 0.26, 0.10, "dark_metal", 0.05),
        # Spindle — the dark core the coil rings wrap, running the full height.
        _cyl("spindle", 0.07, 0.62, "dark_metal", 0.40),
        # Coil rings — four glow_green windings, the "energized" read that marks this the core.
        _cyl("coil_a", 0.19, 0.07, "glow_green", 0.18),
        _cyl("coil_b", 0.19, 0.07, "glow_green", 0.30),
        _cyl("coil_c", 0.19, 0.07, "glow_green", 0.42),
        _cyl("coil_d", 0.19, 0.07, "glow_green", 0.54),
        # Top cap — a scrap_grey crown closing the coil stack.
        _cyl("cap", 0.22, 0.08, "scrap_grey", 0.66),
    ]
    return rr.join(parts, "e-core")
