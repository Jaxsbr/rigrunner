"""
s-boiler — the steam engine's HOUSING sub-part (♨ industrial vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a ~0.6 m-wide, ~0.8 m-long pressure tank.
The read is a riveted *boiler*: a rust capsule lying in a dark_metal cradle, wrapped with scrap_grey
reinforcing bands and a hazard_yellow pressure band, a domed end cap toward the FRONT, and a small
gauge + valve stack on top. Its warm rust mass is the steam counterpart to the electric Casing's
cool blue — the §3 type cast carried by colour and shape.

The tank lies along Blender +Y (→ −Z after export). The cradle box is the first chunk (axis-aligned)
so the merged transform stays clean; the tank/bands/cap are laid along +Y and `join` bakes those
rotations in.
"""

import math

import rr_style as rr


def _cyl_y(name, r, d, mat, loc, verts=20):
    """A cylinder laid along Blender +Y (the tank axis)."""
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj


def build():
    parts = [
        # Cradle — the dark saddle the tank rests in (first chunk; bevel rounds the join, identity
        # rotation keeps the merged transform clean).
        rr.beveled_box("cradle", (0.60, 0.66, 0.14), "dark_metal", (0.0, 0.0, 0.07)),
        # Tank body — the rust pressure vessel, the part's bulk and its warm steam cue.
        _cyl_y("tank", 0.30, 0.74, "rust", (0.0, 0.0, 0.40)),
        # Reinforcing bands — scrap_grey hoops proud of the tank, the riveted-boiler read.
        _cyl_y("band_front", 0.32, 0.05, "scrap_grey", (0.0, 0.22, 0.40)),
        _cyl_y("band_back", 0.32, 0.05, "scrap_grey", (0.0, -0.22, 0.40)),
        # Pressure band — a hazard_yellow hoop at the centre, the warning cue.
        _cyl_y("press_band", 0.315, 0.05, "hazard_yellow", (0.0, 0.0, 0.40)),
        # Domed end cap — a scrap_grey dome closing the FRONT of the tank.
        _cyl_y("cap", 0.28, 0.10, "scrap_grey", (0.0, 0.40, 0.40)),
        # Gauge + valve stack on top — a small dark gauge with a bone_white face and a stubby valve,
        # so the crown reads as a working boiler, not a plain drum.
        rr.beveled_cylinder("gauge", 0.07, 0.05, "dark_metal", location=(0.0, 0.16, 0.71), verts=12),
        rr.beveled_box("gauge_face", (0.07, 0.07, 0.02), "bone_white", (0.0, 0.16, 0.74)),
        rr.beveled_box("valve", (0.09, 0.09, 0.16), "dark_metal", (0.0, -0.16, 0.74)),
    ]
    return rr.join(parts, "s-boiler")
