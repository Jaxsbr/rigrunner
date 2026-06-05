"""
e-regulator — the electric engine's OUTPUT-CONTROL sub-part (⚡ vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a compact ~0.5 m control module. The read
is a *control unit* — a scrap_grey box with a rig_blue face panel carrying a round dial, a row of
glow_green indicator lights, and a hazard_yellow trim strip. It's the busiest small face in the
electric set: where you'd "read the output", the §3 control cue.

FRONT = Blender +Y (→ −Z after export): the panel, dial, lights and trim all sit on that face so the
module reads head-on. The body box is the first chunk (axis-aligned) so the merged transform stays
clean; the dial cylinder is laid along +Y and `join` bakes its rotation in.
"""

import math

import rr_style as rr


def build():
    parts = [
        # Body — the scrap_grey module mass (first chunk; its bevel rounds the join).
        rr.beveled_box("body", (0.50, 0.42, 0.50), "scrap_grey", (0.0, 0.0, 0.27)),
        # Mounting foot — a dark base plate so it reads as bolted down.
        rr.beveled_box("foot", (0.54, 0.46, 0.06), "dark_metal", (0.0, 0.0, 0.03)),
        # Face panel — a rig_blue plate on the FRONT, the surface the controls are set into.
        rr.beveled_box("panel", (0.42, 0.05, 0.42), "rig_blue", (0.0, 0.215, 0.29)),
        # Hazard trim — a warning strip along the top of the panel.
        rr.beveled_box("trim", (0.42, 0.04, 0.05), "hazard_yellow", (0.0, 0.23, 0.47)),
        # Indicator lights — three glow_green pips across the bottom of the panel: the output read-out.
        rr.beveled_box("led_l", (0.05, 0.04, 0.05), "glow_green", (-0.13, 0.235, 0.13)),
        rr.beveled_box("led_m", (0.05, 0.04, 0.05), "glow_green", (0.00, 0.235, 0.13)),
        rr.beveled_box("led_r", (0.05, 0.04, 0.05), "glow_green", (0.13, 0.235, 0.13)),
        # Dial body + needle — a dark gauge ring with a bone_white pointer, the control's centrepiece.
        _dial("dial", 0.12, (0.0, 0.245, 0.32)),
        rr.beveled_box("needle", (0.02, 0.04, 0.14), "bone_white", (0.0, 0.255, 0.36)),
    ]
    return rr.join(parts, "e-regulator")


def _dial(name, r, loc):
    """A gauge dial: a shallow cylinder laid flat against the FRONT (+Y) face."""
    obj = rr.beveled_cylinder(name, r, 0.06, "dark_metal", location=loc, verts=16)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    return obj
