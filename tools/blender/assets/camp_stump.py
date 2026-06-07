"""
camp-stump — the lasting RestorableSite marker a cleared looter camp leaves behind. A dead, broken
tree stump on a patch of churned, scorched soil: the blight the land still bears once the camp itself
has dissolved away. The stump carries its OWN soil base, so the camp's stains can fully fade and the
stump still reads as planted in the ground — the scar the world-restoration work (M4) later heals.

A static single-mesh prop (~2.4 m soil footprint, ~0.8 m tall). World decoration, not a part — no
tier, no collider. Authored 'front' toward +Y by convention (it isn't directional).
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # Churned soil: a low dark disc with a rust scorch patch on top — disturbed, burnt earth that
    # stays distinct from the dusty ground once the camp's stains have faded.
    soil = rr.beveled_cylinder("stump_soil", radius=1.20, depth=0.14, mat="dark_metal",
                               location=(0.0, 0.0, 0.07), verts=12)
    parts.append(soil)
    scorch = rr.beveled_cylinder("stump_scorch", radius=0.82, depth=0.10, mat="rust",
                                 location=(0.10, -0.05, 0.15), verts=10)
    parts.append(scorch)

    # The broken trunk — a chunky faceted column of old bark (rust) sitting on the soil, capped by a
    # paler bone_white cut face: the exposed inner wood where the tree snapped off.
    trunk = rr.beveled_cylinder("stump_trunk", radius=0.42, depth=0.60, mat="rust",
                                location=(0.0, 0.0, 0.45), verts=8)
    parts.append(trunk)
    cut = rr.beveled_cylinder("stump_cut", radius=0.40, depth=0.10, mat="bone_white",
                              location=(0.06, 0.04, 0.78), verts=8)
    cut.rotation_euler = _deg(7, 5, 0)  # the snap sits at a slight angle — a jagged, uneven break
    parts.append(cut)

    # A few broken roots splaying from the base, half-sunk into the soil, for silhouette + story.
    for i, (ang, length) in enumerate([(20, 0.72), (140, 0.62), (250, 0.66), (320, 0.56)]):
        a = math.radians(ang)
        root = rr.beveled_box(f"stump_root_{i}", size=(length, 0.16, 0.14), mat="rust",
                              location=(math.cos(a) * 0.42, math.sin(a) * 0.42, 0.12))
        root.rotation_euler = _deg(0, 0, ang)  # point the long axis radially outward
        parts.append(root)

    return rr.join(parts, "camp-stump")
