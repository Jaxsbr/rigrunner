"""
yard-pallet — a loaded delivery pallet: a slatted deck carrying a strapped stack of crates and a sack,
a batched shipment mid-handling.

The shop yard's "deliveries in and out" note — the clearest "this place is trading" signal in the scatter.
Placed around a world shop with its siblings (features/shop/shop-yard.ts) at varied yaw/scale.

A static single-mesh prop (~0.72 m). World decoration, not a part — no tier, no collider. The deck is the
first (axis-aligned) piece so grounding lands true.
"""

import math

import rr_style as rr


def _deg(x, y, z):
    return (math.radians(x), math.radians(y), math.radians(z))


DECK_Z = 0.10


def build():
    parts = []
    # The pallet deck FIRST (axis-aligned).
    parts.append(rr.beveled_box("pallet_deck", size=(0.94, 0.74, 0.08), mat="dark_metal", location=(0.0, 0.0, 0.04 + 0.02)))
    # Slat detail across the deck.
    for i, y in enumerate((-0.26, 0.0, 0.26)):
        parts.append(rr.beveled_box(f"pallet_slat_{i}", size=(0.94, 0.14, 0.05), mat="scrap_grey", location=(0.0, y, DECK_Z - 0.01)))
    # Two feet blocks under the deck (front pair, so the side reads as a pallet).
    for sx in (-1, 1):
        parts.append(rr.beveled_box(f"pallet_foot_{sx}", size=(0.12, 0.70, 0.06), mat="dark_metal", location=(sx * 0.36, 0.0, 0.03)))

    # The load: a strapped stack of two crates + a sack tucked beside.
    parts.append(rr.beveled_box("pallet_box_a", size=(0.42, 0.40, 0.36), mat="rust", location=(-0.12, 0.04, DECK_Z + 0.18)))
    box_b = rr.beveled_box("pallet_box_b", size=(0.38, 0.34, 0.32), mat="rig_blue", location=(-0.10, 0.02, DECK_Z + 0.52))
    box_b.rotation_euler = _deg(0, 0, 9)  # the top crate sits a touch askew
    parts.append(box_b)
    sack = rr.beveled_box("pallet_sack", size=(0.30, 0.32, 0.30), mat="bone_white", location=(0.26, -0.04, DECK_Z + 0.16))
    sack.rotation_euler = _deg(6, -8, 16)
    parts.append(sack)
    # A hazard strap over the stack.
    parts.append(rr.beveled_box("pallet_strap", size=(0.10, 0.46, 0.46), mat="hazard_yellow", location=(-0.12, 0.04, DECK_Z + 0.30)))

    return rr.join(parts, "yard-pallet")
