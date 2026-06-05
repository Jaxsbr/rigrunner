"""
s-throttle — the steam engine's OUTPUT-CONTROL sub-part (♨ industrial vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a compact ~0.4 m valve body crowned with a
~0.65 m-tall hand-wheel. The read is a *throttle valve*: a dark valve block with a rust steam pipe
through it, a scrap_grey bonnet rising to a hazard_yellow spoked hand-wheel, and a side lever. The
hand-wheel is the unmistakable steam-control cue — the counterpart to the electric Regulator's dial.

The pipe runs along Blender +Y (→ −Z after export). The valve block is the first chunk (axis-aligned)
so the merged transform stays clean; the pipe and wheel rim are laid/rotated and `join` bakes those in.
"""

import math

import rr_style as rr


def _cyl_y(name, r, d, mat, loc, verts=16):
    """A cylinder laid along Blender +Y (the steam pipe)."""
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj


def build():
    parts = [
        # Valve block — the dark control body (first chunk; bevel rounds the join, identity rotation
        # keeps the merged transform clean).
        rr.beveled_box("block", (0.34, 0.34, 0.34), "dark_metal", (0.0, 0.0, 0.17)),
        # Steam pipe — a rust line running through the valve, front to back.
        _cyl_y("pipe", 0.10, 0.50, "rust", (0.0, 0.0, 0.17)),
        # Bonnet — the scrap_grey neck rising from the valve to the hand-wheel.
        rr.beveled_cylinder("bonnet", 0.08, 0.24, "scrap_grey", location=(0.0, 0.0, 0.46), verts=12),
        # Hand-wheel rim — a flat hazard_yellow ring on top: the iconic steam-valve control.
        rr.beveled_cylinder("wheel_rim", 0.18, 0.045, "hazard_yellow", location=(0.0, 0.0, 0.60), verts=20),
        # Hub + spokes — a dark centre and a crossed pair of bars so the wheel reads as spoked, turnable.
        rr.beveled_cylinder("wheel_hub", 0.05, 0.07, "dark_metal", location=(0.0, 0.0, 0.61), verts=10),
        rr.beveled_box("spoke_x", (0.34, 0.04, 0.025), "dark_metal", (0.0, 0.0, 0.605)),
        rr.beveled_box("spoke_y", (0.04, 0.34, 0.025), "dark_metal", (0.0, 0.0, 0.605)),
        # Lever — a hazard_yellow handle off the side of the valve block.
        rr.beveled_box("lever", (0.28, 0.05, 0.05), "hazard_yellow", (0.20, 0.0, 0.30)),
    ]
    return rr.join(parts, "s-throttle")
