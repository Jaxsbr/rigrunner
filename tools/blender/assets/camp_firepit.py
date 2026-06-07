"""
camp-firepit — the looter camp's dead cookfire: a ring of stones around a bed of cold ash with a
couple of charred logs laid across it. The 'damage' half of the camp's environmental mess, and the
clearest 'someone lived here' signal in the silhouette. Spawns near the camp and sinks into the ground
when the camp is cleared.

A static single-mesh prop (~1.1 m footprint, low). World decoration, not a part — no tier, no
collider. Authored 'front' toward −Y by convention (it isn't directional).
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # The cold ash bed — a low dark disc the stones ring.
    ash = rr.beveled_cylinder("pit_ash", radius=0.46, depth=0.08, mat="dark_metal",
                              location=(0.0, 0.0, 0.04), verts=12)
    parts.append(ash)

    # A ring of fire-stones around the rim, varied in size so the ring reads as gathered rubble.
    for i in range(7):
        a = (i / 7) * (2 * math.pi)
        s = 0.15 + (i % 3) * 0.03
        stone = rr.beveled_box(f"pit_stone_{i}", size=(s, s * 0.9, s * 0.85), mat="scrap_grey",
                               location=(math.cos(a) * 0.50, math.sin(a) * 0.50, s * 0.42))
        stone.rotation_euler = _deg(0, 0, i * 27)
        parts.append(stone)

    # Two charred logs laid across the ash (cylinders rotated onto their sides).
    log_a = rr.beveled_cylinder("pit_log_a", radius=0.07, depth=0.84, mat="rust",
                                location=(0.0, 0.06, 0.14), verts=6)
    log_a.rotation_euler = _deg(0, 90, 12)
    parts.append(log_a)
    log_b = rr.beveled_cylinder("pit_log_b", radius=0.06, depth=0.72, mat="dark_metal",
                                location=(0.05, -0.10, 0.18), verts=6)
    log_b.rotation_euler = _deg(0, 90, 75)
    parts.append(log_b)

    return rr.join(parts, "camp-firepit")
