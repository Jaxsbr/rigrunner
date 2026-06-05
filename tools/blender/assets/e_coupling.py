"""
e-coupling — the electric engine's TRANSMIT sub-part: links the core to the drive (⚡ vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a low ~0.5 m connector. The read is a shaft
*coupling* — two dark flanged discs joined by a scrap_grey shaft with a hazard_yellow alignment
collar at the centre, sitting in a mounting saddle. It deliberately reads quieter than the core: a
plumbing/transmission piece, not a glowing one.

The shaft runs front-to-back along Blender +Y (the drive direction → −Z after export), so the
coupling faces the way power flows. The saddle box is the first chunk (axis-aligned, identity
rotation) so the merged object's transform stays clean; the laid-over cylinders are rotated 90° about
X to lie along Y, and `join` bakes those rotations in.
"""

import math

import rr_style as rr


def _cyl_y(name, r, d, mat, loc, verts=16):
    """A cylinder laid along Blender +Y (axle rotated from Z to Y). Never the first join chunk, so
    its rotation bakes in cleanly when the asset is merged."""
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj


def build():
    parts = [
        # Mounting saddle — the axis-aligned base the coupling rests in (first chunk; its bevel rounds
        # the whole join and its identity rotation keeps the merged transform clean).
        rr.beveled_box("saddle", (0.50, 0.46, 0.12), "dark_metal", (0.0, 0.0, 0.06)),
        # Shaft — the scrap_grey spindle power runs along.
        _cyl_y("shaft", 0.10, 0.52, "scrap_grey", (0.0, 0.0, 0.34)),
        # Flanges — two dark discs bolting the coupling to the core (back) and the drive (front).
        _cyl_y("flange_front", 0.22, 0.08, "dark_metal", (0.0, 0.24, 0.34)),
        _cyl_y("flange_back", 0.22, 0.08, "dark_metal", (0.0, -0.24, 0.34)),
        # Alignment collar — a hazard_yellow band at the centre, the one bright cue on a quiet part.
        _cyl_y("collar", 0.13, 0.08, "hazard_yellow", (0.0, 0.0, 0.34)),
    ]
    return rr.join(parts, "e-coupling")
