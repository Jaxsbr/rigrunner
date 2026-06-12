"""
yard-drum — a fuel/oil drum: a ribbed barrel with a hazard band, a lid and an off-centre bung.

The shop yard's "materials on hand" note — the kind of thing stacked by a working trade post. Scattered
around a world shop with its siblings (features/shop/shop-yard.ts), yaw-varied and scaled so a few read as
a row of drums. The grime under the yard (shop-stains.ts) sells the "fuel/oil gets spilled here" story.

A static single-mesh prop (~0.92 m tall). World decoration, not a part — no tier, no collider. The body
cylinder is the first (axis-aligned) piece so grounding lands true.
"""

import rr_style as rr

R, HGT = 0.30, 0.92


def build():
    parts = []
    # Body FIRST (upright, axis-aligned).
    parts.append(rr.beveled_cylinder("drum_body", radius=R, depth=HGT, mat="rust", location=(0.0, 0.0, HGT / 2), verts=16))
    # Two rib rings + a hazard band around the middle.
    parts.append(rr.beveled_cylinder("drum_rib_lo", radius=R + 0.02, depth=0.06, mat="dark_metal", location=(0.0, 0.0, 0.22), verts=16))
    parts.append(rr.beveled_cylinder("drum_rib_hi", radius=R + 0.02, depth=0.06, mat="dark_metal", location=(0.0, 0.0, HGT - 0.22), verts=16))
    parts.append(rr.beveled_cylinder("drum_band", radius=R + 0.015, depth=0.12, mat="hazard_yellow", location=(0.0, 0.0, HGT / 2), verts=16))
    # Lid + an off-centre bung cap.
    parts.append(rr.beveled_cylinder("drum_lid", radius=R, depth=0.05, mat="dark_metal", location=(0.0, 0.0, HGT), verts=16))
    parts.append(rr.beveled_cylinder("drum_bung", radius=0.06, depth=0.05, mat="scrap_grey", location=(0.12, 0.06, HGT + 0.03), verts=8))
    return rr.join(parts, "yard-drum")
