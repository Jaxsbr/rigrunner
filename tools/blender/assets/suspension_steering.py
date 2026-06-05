"""
suspension-steering — the chassis's SUSPENSION & STEERING unit (the turning/handling piece).

ONE corner of running gear: a coil-spring damper standing on a dark wheel-hub upright, an A-arm link
angling out toward the wheel, and a hazard_yellow steering tie-rod stub on the FRONT face. The chassis
Frame instances this single unit at every corner socket (just inboard of each wheel), so it reads as the
linkage bridging the deck to each wheel. It is the chassis sub-part that sets turning; the springs + the
bright tie-rod do the identifying work.

FRONT = Blender +Y (→ −Z after export): the steering stub sits on that face. Base-centre origin (rests on
the ground), so the Frame's `socket_susp_<i>` empties (placed on the ground beside each wheel) seat it at
the corner. The damper is the first chunk (axis-aligned) so the merged transform stays clean.
"""

import math

import rr_style as rr


def build():
    parts = [
        # Coil-spring damper — a scrap_grey shaft wrapped with rust coil rings, standing tall enough to
        # bridge the wheel up to the frame underside (~0.46) so it reads as connected running gear.
        rr.beveled_cylinder("damper", 0.07, 0.46, "scrap_grey", location=(0.0, 0.0, 0.25), verts=10),
    ]
    for i, z in enumerate((0.12, 0.21, 0.30, 0.39, 0.46)):
        parts.append(rr.beveled_cylinder(f"coil_{i}", 0.12, 0.04, "rust", location=(0.0, 0.0, z), verts=12))
    # Wheel-hub upright — a dark block at the base where the wheel mounts.
    parts.append(rr.beveled_box("hub", (0.14, 0.16, 0.22), "dark_metal", (0.0, 0.0, 0.11)))
    # A-arm link — angling out + down from the damper toward the wheel hub.
    arm = rr.beveled_box("arm", (0.34, 0.07, 0.07), "dark_metal", (0.0, 0.0, 0.20))
    arm.rotation_euler = (0.0, math.radians(35), 0.0)
    parts.append(arm)
    # Steering tie-rod stub — the hazard_yellow cue on the FRONT (+Y) face.
    parts.append(rr.beveled_box("tie_rod", (0.22, 0.05, 0.05), "hazard_yellow", (0.0, 0.16, 0.30)))
    return rr.join(parts, "suspension-steering")
