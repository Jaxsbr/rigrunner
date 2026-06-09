"""
stump-healer — the restoration HEAD that swaps onto the Reclaimer arm in place of the digging bucket.

A bucket-like vessel (a rounded pail) cradling a small green seedling: where the bucket bites the
ground to rummage scrap, this carries new life to a cleared site and grows its stump into a young tree
(`@features/restoration`). The seedling + the rig_blue built-part pail read it instantly as "restoration
tool", distinct from the bucket's grey angular scoop with hazard-yellow teeth.

Its ORIGIN is the attach pivot (0,0,0) — the point that meets the arm's `socket_wrist` — NOT the usual
base-centre, because this asset hangs off a hinge rather than resting on the ground (mirrors
reclaimer_bucket.py). The pail hangs below + forward of the pivot; the seedling leans up and forward out
of it (away from the arm). Authored front-toward +Y like every other asset.

ARTICULATED: keeps its attach-pivot origin (no base-centre re-origin from build_asset.py).
"""

import math

import rr_style as rr

ARTICULATED = True

R = 0.17          # pail radius
DROP = 0.30       # how far the pail hangs below the pivot (z)
FWD = 0.06        # how far forward the pail sits from the pivot (y) — it reaches ahead like the bucket


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


def build():
    parts = []

    # The pail body — a rounded rig_blue pail (the signature built-part colour), hanging below the pivot
    # and opening upward toward it. Low vert count keeps the faceted-scrap finish.
    body = rr.beveled_cylinder("sh_body", radius=R, depth=DROP, mat="rig_blue",
                               location=(0.0, FWD, -DROP / 2.0), verts=12)
    parts.append(body)
    # A dark rim collar around the open top, so the mouth reads as a vessel, not a solid drum.
    rim = rr.beveled_cylinder("sh_rim", radius=R + 0.02, depth=0.045, mat="dark_metal",
                              location=(0.0, FWD, -0.03), verts=12)
    parts.append(rim)
    # A short pour spout angling up + forward off the front lip — the watering-can read that says
    # "tend/heal", kept small so it stays a detail and never reads as a second limb.
    spout = rr.beveled_cylinder("sh_spout", radius=0.04, depth=0.16, mat="scrap_grey",
                                location=(0.0, FWD + R + 0.01, -0.08), verts=8)
    spout.rotation_euler = _deg(62, 0, 0)
    parts.append(spout)
    # A band of dark soil inside the pail mouth (the seedling roots in it), inset just below the rim.
    soil = rr.beveled_cylinder("sh_soil", radius=R - 0.03, depth=0.04, mat="rust",
                               location=(0.0, FWD, -0.07), verts=12)
    parts.append(soil)

    # The seedling — a thin rust stem standing up out of the soil with a slight forward lean, tipped with a
    # tidy cluster of green leaves splayed up + to either side (the camp-sprout leaf language, which reads
    # cleanly from the top-down camera). Centred over the pail so the sprout reads as one upright shoot.
    stem = rr.beveled_cylinder("sh_stem", radius=0.028, depth=0.22, mat="rust",
                               location=(0.0, FWD + 0.02, 0.06), verts=6)
    stem.rotation_euler = _deg(-14, 0, 0)  # a gentle forward lean, away from the arm
    parts.append(stem)

    tip = (0.0, FWD + 0.07, 0.18)
    leaf_a = rr.beveled_box("sh_leaf_a", size=(0.24, 0.13, 0.03), mat="nature_green", location=tip)
    leaf_a.rotation_euler = _deg(0, -24, 34)
    parts.append(leaf_a)
    leaf_b = rr.beveled_box("sh_leaf_b", size=(0.24, 0.13, 0.03), mat="nature_green",
                            location=(tip[0], tip[1], tip[2] - 0.015))
    leaf_b.rotation_euler = _deg(0, -24, -34)
    parts.append(leaf_b)
    leaf_c = rr.beveled_box("sh_leaf_c", size=(0.18, 0.10, 0.03), mat="nature_green",
                            location=(tip[0], tip[1] + 0.02, tip[2] + 0.03))
    leaf_c.rotation_euler = _deg(-18, 0, 0)
    parts.append(leaf_c)

    healer = rr.join(parts, "stump-healer")
    rr.set_origin(healer, (0.0, 0.0, 0.0))  # the attach pivot — aligns with the arm's socket_wrist
    return healer
