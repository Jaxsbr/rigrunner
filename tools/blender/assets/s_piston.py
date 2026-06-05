"""
s-piston — the steam engine's CONVERTER sub-part, the type-defining workhorse (♨ vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a ~0.55 m-wide, ~0.85 m-tall piston
assembly. The read is a steam *cylinder*: a scrap_grey bore on a dark mounting flange, a polished
dark_metal piston rod thrusting out the top into a rust crosshead cap, with a steam inlet pipe off
the side and a hazard_yellow band on the bore. The exposed rod + crosshead is what marks this the
piston — the moving heart of a steam engine — the counterpart to the electric Core's glow.

Vertical form, so the bore/rod sit on Blender's default Z axle (no rotation). The bore is the first
chunk; its bevel rounds the join. The inlet pipe is laid along +Y and `join` bakes its rotation in.
"""

import math

import rr_style as rr


def build():
    parts = [
        # Bore — the scrap_grey steam cylinder, the part's main mass (first chunk; bevel rounds join).
        rr.beveled_cylinder("bore", 0.22, 0.50, "scrap_grey", location=(0.0, 0.0, 0.30), verts=18),
        # Base flange — the dark disc the cylinder bolts down through.
        rr.beveled_cylinder("flange", 0.28, 0.08, "dark_metal", location=(0.0, 0.0, 0.05), verts=18),
        # Hazard band — a warning hoop around the bore.
        rr.beveled_cylinder("band", 0.225, 0.05, "hazard_yellow", location=(0.0, 0.0, 0.32), verts=18),
        # Piston rod — the polished dark shaft thrusting out the top: the moving read.
        rr.beveled_cylinder("rod", 0.06, 0.40, "dark_metal", location=(0.0, 0.0, 0.62), verts=12),
        # Crosshead cap — the rust block the rod drives, riding above the bore.
        rr.beveled_box("crosshead", (0.26, 0.16, 0.10), "rust", (0.0, 0.0, 0.83)),
        # Steam inlet — a rust pipe feeding the bore from the side (laid along +Y).
        _cyl_y("inlet", 0.05, 0.24, "rust", (0.0, 0.20, 0.46)),
    ]
    return rr.join(parts, "s-piston")


def _cyl_y(name, r, d, mat, loc, verts=12):
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj
