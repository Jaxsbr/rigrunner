"""
s-driveshaft — the steam engine's TRANSMIT sub-part: carries the piston's force to the drive (♨).

A "Small part" on the size ladder (docs/asset-style.md): a low, ~0.9 m-long shaft assembly. The read
is a *driveshaft with a flywheel*: a scrap_grey shaft resting in two dark pillow-block bearings, a
heavy dark_metal flywheel disc near the FRONT, rust collars along its length, and a hazard_yellow key
mark. The big flywheel is the steam counterpart to the electric Coupling's flanges — same "transmit"
role, industrial reading.

The shaft runs front-to-back along Blender +Y (→ −Z after export). A pillow-block box is the first
chunk (axis-aligned) so the merged transform stays clean; the shaft/flywheel/collars are laid along
+Y and `join` bakes those rotations in.
"""

import math

import rr_style as rr


def _cyl_y(name, r, d, mat, loc, verts=16):
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj


def build():
    parts = [
        # Pillow blocks — the two dark bearing pedestals the shaft sits in. The front one is the first
        # chunk (axis-aligned) so the merged transform stays clean; its bevel rounds the whole join.
        rr.beveled_box("bearing_front", (0.16, 0.14, 0.24), "dark_metal", (0.0, 0.30, 0.12)),
        rr.beveled_box("bearing_back", (0.16, 0.14, 0.24), "dark_metal", (0.0, -0.30, 0.12)),
        # Shaft — the scrap_grey spindle running the full length through the bearings.
        _cyl_y("shaft", 0.07, 0.92, "scrap_grey", (0.0, 0.0, 0.24)),
        # Flywheel — the heavy dark disc near the front: the part's signature mass.
        _cyl_y("flywheel", 0.26, 0.07, "dark_metal", (0.0, 0.13, 0.24)),
        # Collars — rust rings keying the shaft, the worn-machinery read.
        _cyl_y("collar_a", 0.11, 0.06, "rust", (0.0, -0.10, 0.24)),
        _cyl_y("collar_b", 0.11, 0.06, "rust", (0.0, -0.30, 0.24)),
        # Key mark — a hazard_yellow nub on the flywheel rim, the one bright cue.
        rr.beveled_box("key", (0.06, 0.06, 0.08), "hazard_yellow", (0.0, 0.13, 0.48)),
    ]
    return rr.join(parts, "s-driveshaft")
