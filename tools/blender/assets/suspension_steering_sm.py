"""
suspension-steering-sm — the 1×3 scout chassis's smaller SUSPENSION unit.

A scaled-down `suspension_steering` for the light 1×3 rig (the 3×5 keeps the full-size part). Same read —
a coil-spring damper + A-arm + hazard tie-rod stub — at ~0.7× scale to suit the scout's smaller wheels and
lower frame, so it bridges the wheel up to the 1×3 frame underside without towering over it. Base-centre
origin, front (+Y) carries the tie-rod, exactly like the full-size unit.
"""

import math

import rr_style as rr


def build():
    parts = [
        # Coil-spring damper — a scrap_grey shaft wrapped with rust coil rings, sized to reach the 1×3
        # frame underside (~0.32) from the ground.
        rr.beveled_cylinder("damper", 0.06, 0.32, "scrap_grey", location=(0.0, 0.0, 0.18), verts=10),
    ]
    for i, z in enumerate((0.09, 0.15, 0.21, 0.27, 0.33)):
        parts.append(rr.beveled_cylinder(f"coil_{i}", 0.09, 0.03, "rust", location=(0.0, 0.0, z), verts=12))
    # Wheel-hub upright — a dark block at the base where the wheel mounts.
    parts.append(rr.beveled_box("hub", (0.10, 0.12, 0.16), "dark_metal", (0.0, 0.0, 0.08)))
    # A-arm link — angling out + down from the damper toward the wheel hub.
    arm = rr.beveled_box("arm", (0.24, 0.05, 0.05), "dark_metal", (0.0, 0.0, 0.14))
    arm.rotation_euler = (0.0, math.radians(35), 0.0)
    parts.append(arm)
    # Steering tie-rod stub — the hazard_yellow cue on the FRONT (+Y) face.
    parts.append(rr.beveled_box("tie_rod", (0.16, 0.04, 0.04), "hazard_yellow", (0.0, 0.11, 0.21)))
    return rr.join(parts, "suspension-steering")
