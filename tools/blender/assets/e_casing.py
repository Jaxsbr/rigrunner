"""
e-casing — the electric engine's HOUSING sub-part (⚡ clean/abstract vocabulary).

A "Small part" on the size ladder (docs/asset-style.md): a ~0.8 m cube-ish shell that holds the
engine's internals. The read we're after is a painted *enclosure*, not a solid block: a signature
`rig_blue` case (the §3 "rig_blue = player-built parts" cue) with a dark_metal corner frame, a
recessed access panel on the FRONT, side vent slats, and a single glow_green status light — so it
reads as "the box the core lives in" the moment it's selected in the viewer or inventory.

FRONT = Blender +Y (→ −Z after the Y-up export), the one forward convention; the access panel and
status light sit on that face so the part reads head-on. Built from beveled boxes joined into one;
the first chunk's bevel rounds the whole merged shell (the house finish).
"""

import rr_style as rr


# (name, size (x,y,z) m, palette, location centre (x,y,z) m)
_CHUNKS = [
    # Painted shell — the signature rig_blue body the corner frame and panels sit on. First chunk,
    # so its bevel rounds the whole join.
    ("shell", (0.70, 0.70, 0.66), "rig_blue", (0.00, 0.00, 0.36)),
    # Mounting foot — a dark base plate so the casing reads as bolted down, not floating.
    ("foot", (0.78, 0.78, 0.08), "dark_metal", (0.00, 0.00, 0.04)),

    # Corner frame — four dark posts at the vertical edges turn the blue faces into recessed panels,
    # the "enclosure" read instead of a plain cube.
    ("post_fl", (0.10, 0.10, 0.66), "dark_metal", (-0.33, 0.33, 0.36)),
    ("post_fr", (0.10, 0.10, 0.66), "dark_metal", (0.33, 0.33, 0.36)),
    ("post_bl", (0.10, 0.10, 0.66), "dark_metal", (-0.33, -0.33, 0.36)),
    ("post_br", (0.10, 0.10, 0.66), "dark_metal", (0.33, -0.33, 0.36)),

    # Front access panel — a darker inset on the +Y face: where you'd open the case to swap the core.
    ("panel", (0.46, 0.06, 0.46), "scrap_grey", (0.00, 0.34, 0.34)),
    # Status light — a small glow_green nub above the panel, the "powered" cue read off the front.
    ("status", (0.18, 0.05, 0.06), "glow_green", (0.00, 0.37, 0.58)),

    # Side vent slats — three thin dark louvres proud of the +X face: cooling, and it stops the side
    # reading as a blank panel.
    ("vent_a", (0.05, 0.42, 0.04), "dark_metal", (0.37, 0.00, 0.26)),
    ("vent_b", (0.05, 0.42, 0.04), "dark_metal", (0.37, 0.00, 0.38)),
    ("vent_c", (0.05, 0.42, 0.04), "dark_metal", (0.37, 0.00, 0.50)),
]


def build():
    parts = [rr.beveled_box(name, size=size, mat=mat, location=loc) for name, size, mat, loc in _CHUNKS]
    return rr.join(parts, "e-casing")
