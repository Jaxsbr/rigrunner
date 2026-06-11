"""
yard-parts — a loose heap of refined mechanical components, mid-unpack: pipes, a gear-plate, a coil and a
bracket, tumbled across a dropped panel.

The shop yard's "someone is unpacking components" note — neater than the world's chaotic scrap (these are
goods, not junk), but still a casual pile, not a tidy display. Scattered around a world shop with its
siblings (features/shop/shop-yard.ts) at varied yaw/scale. Its own tumbled pieces give it an organic,
non-aligned silhouette that no amount of world-yaw could.

A static single-mesh prop (~0.6 m). World decoration, not a part — no tier, no collider. The dropped panel
is the first (axis-aligned) piece so grounding lands true; everything piled on it is tilted freely.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []
    # A dropped base panel FIRST (axis-aligned) — exact grounding, and the heap sits on it.
    parts.append(rr.beveled_box("parts_panel", size=(0.56, 0.44, 0.06), mat="dark_metal", location=(0.0, 0.0, 0.03)))

    # A couple of pipes laid across it at angles.
    p1 = rr.beveled_cylinder("parts_pipe_a", radius=0.06, depth=0.52, mat="scrap_grey", location=(-0.04, 0.02, 0.12), verts=10)
    p1.rotation_euler = _deg(0, 90, 18)
    parts.append(p1)
    p2 = rr.beveled_cylinder("parts_pipe_b", radius=0.05, depth=0.44, mat="bone_white", location=(0.06, -0.08, 0.16), verts=10)
    p2.rotation_euler = _deg(0, 90, -32)
    parts.append(p2)

    # A gear-plate leaning on the pile.
    gear = rr.beveled_cylinder("parts_gear", radius=0.16, depth=0.06, mat="dark_metal", location=(0.10, 0.10, 0.18), verts=12)
    gear.rotation_euler = _deg(74, 0, 12)
    parts.append(gear)

    # A small coil + a bracket on top.
    coil = rr.beveled_cylinder("parts_coil", radius=0.09, depth=0.14, mat="scrap_grey", location=(-0.14, 0.10, 0.20), verts=10)
    coil.rotation_euler = _deg(20, 0, 0)
    parts.append(coil)
    bracket = rr.beveled_box("parts_bracket", size=(0.16, 0.12, 0.10), mat="hazard_yellow", location=(0.0, -0.02, 0.24))
    bracket.rotation_euler = _deg(14, 22, -10)
    parts.append(bracket)

    return rr.join(parts, "yard-parts")
