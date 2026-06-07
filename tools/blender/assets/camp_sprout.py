"""
camp-sprout — the lasting RestorableSite marker a cleared looter camp leaves behind. A thick, low cut
stump with a single thin new branch sprouting from it, tipped with green leaves: old growth cut down,
new life pushing back — the hopeful scar the world-restoration work (M4) later grows out.

Deliberately a clear, chunky silhouette so it reads instantly from the top-down camera. It sits directly
on the ground (NO soil disc) — the cleared camp's stains carry the disturbed-earth context.

A static single-mesh prop (~1 m footprint, ~0.8 m tall). World decoration, not a part — no tier,
no collider. Authored 'front' toward +Y by convention (it isn't directional).
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # The thick, low cut trunk — sawn off near the ground (wider than tall, so it reads as a stump).
    trunk = rr.beveled_cylinder("sprout_trunk", radius=0.48, depth=0.36, mat="rust",
                                location=(0.0, 0.0, 0.18), verts=10)
    parts.append(trunk)
    # The pale sawn face, slightly inset so a rust bark rim shows around it.
    cut = rr.beveled_cylinder("sprout_cut", radius=0.40, depth=0.06, mat="bone_white",
                              location=(0.0, 0.0, 0.37), verts=10)
    parts.append(cut)

    # A thin new branch sprouting from the top, angled up and out toward +X.
    branch = rr.beveled_cylinder("sprout_branch", radius=0.05, depth=0.52, mat="rust",
                                 location=(0.27, 0.0, 0.53), verts=6)
    branch.rotation_euler = _deg(0, 42, 0)
    parts.append(branch)

    # Green leaves at the branch tip — the living signal that pops from the top-down camera. A larger
    # leaf and a smaller one, splayed to either side and tipped up.
    tip = (0.46, 0.0, 0.74)
    leaf_a = rr.beveled_box("sprout_leaf_a", size=(0.34, 0.18, 0.035), mat="nature_green",
                            location=tip)
    leaf_a.rotation_euler = _deg(0, -28, 32)
    parts.append(leaf_a)
    leaf_b = rr.beveled_box("sprout_leaf_b", size=(0.24, 0.13, 0.035), mat="nature_green",
                            location=(tip[0] - 0.04, tip[1], tip[2] - 0.02))
    leaf_b.rotation_euler = _deg(0, -22, -46)
    parts.append(leaf_b)

    return rr.join(parts, "camp-sprout")
