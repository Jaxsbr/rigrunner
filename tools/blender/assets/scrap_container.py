"""
scrap-container — the signature RIGRUNNER storage container (Tier 1).

A nod to the prototype's blue cubes: a rig-blue body in a dark-metal frame, with a
glow-green fill pane on the front. ~1 grid cell footprint, ~1.2 m tall. Built entirely
from rr_style helpers, so it shares the project palette / scale / finish automatically.

This is also the reference example for the `blender-asset` skill: copy its shape to make a
new asset generator.
"""

import rr_style as rr


def build():
    parts = []

    # Body — the rig-blue tank itself.
    parts.append(
        rr.beveled_box("body", size=(0.90, 0.90, 1.00), mat="rig_blue", location=(0, 0, 0.55))
    )

    # Corner frame posts — dark metal, the "built" framing.
    post = (0.12, 0.12, 1.20)
    for sx in (-0.44, 0.44):
        for sy in (-0.44, 0.44):
            parts.append(
                rr.beveled_box(f"post_{sx}_{sy}", size=post, mat="dark_metal", location=(sx, sy, 0.60))
            )

    # Glow-green fill pane on the FRONT face (-Y by convention) — reads as "powered/filling".
    parts.append(
        rr.beveled_box("fill", size=(0.50, 0.06, 0.62), mat="glow_green", location=(0, -0.46, 0.55))
    )

    return rr.join(parts, "scrap-container")
