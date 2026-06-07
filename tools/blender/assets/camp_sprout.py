"""
camp-sprout — the lasting RestorableSite marker a cleared looter camp leaves behind. A small green
sprout pushing up through a patch of disturbed soil: the first sign that life can return to the cleared
ground. It carries its OWN small soil base, so the camp's stains can fully fade and the sprout still
reads as planted — the hopeful scar the world-restoration work (M4) later grows out.

Deliberately a clear, distinct silhouette (a slender twig + broad green leaves) so it reads instantly
from the top-down camera and never reads as camp junk.

A static single-mesh prop (~1 m soil footprint, ~0.6 m tall). World decoration, not a part — no tier,
no collider. Authored 'front' toward +Y by convention (it isn't directional).
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # A small patch of disturbed dark soil — just enough to ground the sprout, not a dominant mound.
    soil = rr.beveled_cylinder("sprout_soil", radius=0.52, depth=0.09, mat="dark_metal",
                               location=(0.0, 0.0, 0.045), verts=10)
    parts.append(soil)

    # The slender twig stem (old bark) rising from the soil.
    stem = rr.beveled_cylinder("sprout_stem", radius=0.05, depth=0.50, mat="rust",
                               location=(0.0, 0.0, 0.30), verts=6)
    parts.append(stem)

    # Three broad green leaves splaying from near the top — the clear, distinguishing feature: a living
    # green that pops from the top-down camera against the dusty, contaminated ground.
    for i, ang in enumerate((25, 150, 265)):
        leaf = rr.beveled_box(f"sprout_leaf_{i}", size=(0.42, 0.22, 0.04), mat="nature_green",
                              location=(math.cos(math.radians(ang)) * 0.16,
                                        math.sin(math.radians(ang)) * 0.16, 0.48))
        leaf.rotation_euler = _deg(0, -32, ang)  # tilt the outer tip up, then yaw it to its direction
        parts.append(leaf)

    return rr.join(parts, "camp-sprout")
