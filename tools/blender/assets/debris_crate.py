"""
debris-crate — a broken supply crate, one of the bits of wreckage that litter a looter camp (the
'damage' half of the camp's environmental mess). A splintered body with a sprung lid knocked askew and
a loose plank fallen alongside, so it reads as ransacked rather than stacked. Spawns scattered around
the camp and sinks into the ground when the camp is cleared.

A static single-mesh prop (~0.9 m). World decoration, not a part — no tier, no collider. Authored
'front' toward +Y by convention.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # The cracked body, tipped a little off level.
    body = rr.beveled_box("crate_body", size=(0.70, 0.62, 0.50), mat="rust", location=(0.0, 0.0, 0.27))
    body.rotation_euler = _deg(0, 0, 8)
    parts.append(body)
    # A dark band wrapping it.
    band = rr.beveled_box("crate_band", size=(0.74, 0.12, 0.54), mat="dark_metal", location=(0.0, 0.0, 0.27))
    band.rotation_euler = _deg(0, 0, 8)
    parts.append(band)
    # The sprung lid, knocked askew and tipped off one edge.
    lid = rr.beveled_box("crate_lid", size=(0.74, 0.66, 0.08), mat="bone_white", location=(0.20, 0.0, 0.60))
    lid.rotation_euler = _deg(0, 28, 8)
    parts.append(lid)
    # A loose plank fallen flat alongside.
    plank = rr.beveled_box("crate_plank", size=(0.82, 0.14, 0.06), mat="bone_white", location=(-0.46, 0.22, 0.04))
    plank.rotation_euler = _deg(0, 0, 35)
    parts.append(plank)

    return rr.join(parts, "debris-crate")
