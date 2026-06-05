"""
suspension-steering — the chassis's SUSPENSION & STEERING sub-part (the turning/handling piece).

A "Small part" on the size ladder (docs/asset-style.md): a ~1.0 m-wide linkage assembly, ~0.5 m tall.
The read is mechanical *running gear*: a dark cross-beam carrying two coil-spring dampers, A-arm
links angling down to the wheel hubs, and a hazard_yellow steering tie-rod across the FRONT. It's the
most abstract chassis piece, so the springs + the bright tie-rod do the identifying work. Shared by
both chassis sizes (the spec's "three models, scaled per size" default).

FRONT = Blender +Y (→ −Z after export): the steering tie-rod sits on that face. The cross-beam is the
first chunk (axis-aligned) so the merged transform stays clean; the A-arm links are rotated and `join`
bakes those in.
"""

import math

import rr_style as rr


def _spring(side, x):
    """A coil-spring damper: a scrap_grey shaft wrapped with rust coil rings, standing vertically."""
    parts = [rr.beveled_cylinder(f"damper_{side}", 0.06, 0.34, "scrap_grey", location=(x, 0.0, 0.23), verts=10)]
    for i, z in enumerate((0.12, 0.20, 0.28, 0.36)):
        parts.append(rr.beveled_cylinder(f"coil_{side}_{i}", 0.10, 0.035, "rust", location=(x, 0.0, z), verts=12))
    return parts


def _arm(side, x):
    """An A-arm link angling from the beam end down to the wheel hub (rotated about +Y)."""
    obj = rr.beveled_box(f"arm_{side}", (0.34, 0.06, 0.06), "dark_metal", (x, 0.0, 0.20))
    obj.rotation_euler = (0.0, math.radians(38 if side == "l" else -38), 0.0)
    return obj


def build():
    parts = [
        # Cross-beam — the dark sub-frame the whole linkage hangs from (first chunk; bevel rounds join,
        # identity rotation keeps the merged transform clean).
        rr.beveled_box("beam", (1.00, 0.12, 0.12), "dark_metal", (0.0, 0.0, 0.45)),
        # Wheel-hub uprights — dark blocks at each end where a wheel would mount.
        rr.beveled_box("hub_l", (0.12, 0.14, 0.20), "dark_metal", (-0.46, 0.0, 0.12)),
        rr.beveled_box("hub_r", (0.12, 0.14, 0.20), "dark_metal", (0.46, 0.0, 0.12)),
        # Steering tie-rod — the hazard_yellow link across the FRONT, the unmistakable steering cue.
        rr.beveled_box("tie_rod", (0.78, 0.05, 0.05), "hazard_yellow", (0.0, 0.18, 0.30)),
    ]
    parts += _spring("l", -0.30)
    parts += _spring("r", 0.30)
    parts.append(_arm("l", -0.30))
    parts.append(_arm("r", 0.30))
    return rr.join(parts, "suspension-steering")
