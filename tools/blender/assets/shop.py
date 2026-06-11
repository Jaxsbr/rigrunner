"""
shop — a world shop: a rusty container trade post the rig drives to, to buy/sell parts.

Designed so the ENTRANCE reads from the game's elevated camera (the v1 mistake: a roof + awning that
overhung the open front, so from above you saw only the roof, and the counter beneath sat in shadow).
The fixes:

  * The roof covers only the BACK of the container — the FRONT bay is open to the sky, so the elevated
    camera looks straight down onto the counter and scene light reaches it (no more dark recess).
  * A bright service counter (scrap_grey body + bone_white top + a hazard_yellow lip) reads as "walk up
    and trade here" even at a glance.
  * A hazard_yellow gantry frames the opening like a doorway, and an EMISSIVE glow_green "open" sign +
    a glow_green beacon on a mast ABOVE the roofline mark the entrance — emissive, so they read through
    any shadow and from any camera angle, never occluded by the roof.

ARTICULATED: the back roof carries a `joint_vent` whirlybird turbine — a separate node the game spins
about its vertical axis (shop-vent-animator.ts), so the silhouette reads as occupied. So build_asset.py
exports the scene hierarchy as-is. Authored front-toward +Y, origin at base-centre, like every asset.
"""

import math

import rr_style as rr

ARTICULATED = True

# --- dimensions (metres, Blender Z-up) -------------------------------------------------
W = 3.2          # X — width
D = 2.4          # Y — depth
WALL_H = 2.0     # wall height above the floor slab
T = 0.14         # wall thickness
FLOOR_T = 0.12
ROOF_T = 0.14
ROOF_D = 1.35    # the roof covers only the BACK this deep; the rest of the front is open to the sky

HALF_W = W / 2
HALF_D = D / 2
FLOOR_TOP = FLOOR_T                       # 0.12
WALL_CZ = FLOOR_TOP + WALL_H / 2          # wall centre height
WALL_TOP = FLOOR_TOP + WALL_H             # 2.12
ROOF_TOP = WALL_TOP + ROOF_T              # 2.26

# The vent sits on the (enclosed) back roof, clear of the open front bay.
VENT_X = -0.55
VENT_Y = -0.55
VENT_BASE_CZ = ROOF_TOP + 0.07
VENT_AXIS_TOP = ROOF_TOP + 0.14


def _body():
    """The container shell with an OPEN, lit front bay: three walls + floor, a back-only roof, the
    service counter, the hazard doorway frame, and the emissive open-sign + beacon. One joined mesh,
    origin dropped to base-centre on the ground."""
    parts = []

    # Floor + back wall + full-height side walls; the front (+Y) is open.
    parts.append(rr.beveled_box("floor", (W, D, FLOOR_T), "dark_metal", (0.0, 0.0, FLOOR_TOP / 2)))
    parts.append(rr.beveled_box("wall_back", (W, T, WALL_H), "rust", (0.0, -(HALF_D - T / 2), WALL_CZ)))
    parts.append(rr.beveled_box("wall_left", (T, D, WALL_H), "rust", (-(HALF_W - T / 2), 0.0, WALL_CZ)))
    parts.append(rr.beveled_box("wall_right", (T, D, WALL_H), "rust", (HALF_W - T / 2, 0.0, WALL_CZ)))

    # Roof over the BACK only — its front edge stops short, leaving the front bay open to the sky so the
    # elevated camera sees down onto the counter and light reaches it.
    roof_y = -HALF_D + ROOF_D / 2
    parts.append(rr.beveled_box("roof", (W + 0.12, ROOF_D, ROOF_T), "scrap_grey", (0.0, roof_y, WALL_TOP + ROOF_T / 2)))

    # Corrugation ribs down the back wall — the shipping-container read.
    for i, x in enumerate((-1.15, -0.6, -0.05, 0.5, 1.05)):
        parts.append(rr.beveled_box(f"rib_{i}", (0.08, 0.06, WALL_H - 0.24), "dark_metal",
                                    (x, -(HALF_D + 0.02), WALL_CZ)))

    # The bright service counter across the open front — body + a light top + a hazard front lip.
    parts.append(rr.beveled_box("counter", (W - 0.4, 0.42, 0.9), "scrap_grey", (0.0, HALF_D - 0.30, FLOOR_TOP + 0.45)))
    parts.append(rr.beveled_box("counter_top", (W - 0.36, 0.48, 0.06), "bone_white", (0.0, HALF_D - 0.30, FLOOR_TOP + 0.93)))
    parts.append(rr.beveled_box("counter_lip", (W - 0.36, 0.06, 0.14), "hazard_yellow", (0.0, HALF_D - 0.04, FLOOR_TOP + 0.83)))

    # A hazard doorway frame around the opening — two corner posts + a thin top beam (kept slim so it
    # barely occludes from above) that read the front as an entrance, not just a missing wall.
    parts.append(rr.beveled_box("post_left", (0.16, 0.16, WALL_H), "hazard_yellow", (-(HALF_W - 0.08), HALF_D - 0.08, WALL_CZ)))
    parts.append(rr.beveled_box("post_right", (0.16, 0.16, WALL_H), "hazard_yellow", (HALF_W - 0.08, HALF_D - 0.08, WALL_CZ)))
    parts.append(rr.beveled_box("gantry", (W, 0.16, 0.18), "hazard_yellow", (0.0, HALF_D - 0.08, WALL_TOP - 0.09)))

    # The EMISSIVE markers — read through shadow and from any angle. The "open" sign hangs on the gantry
    # facing out; the beacon rides a mast ABOVE the roofline so it's never occluded by the roof.
    parts.append(rr.beveled_box("open_sign", (1.5, 0.05, 0.30), "glow_green", (0.0, HALF_D + 0.04, WALL_TOP - 0.22)))
    parts.append(rr.beveled_box("beacon_mast", (0.08, 0.08, 0.70), "dark_metal", (HALF_W - 0.28, HALF_D - 0.22, WALL_TOP + 0.35)))
    parts.append(rr.beveled_box("beacon_lamp", (0.20, 0.20, 0.20), "glow_green", (HALF_W - 0.28, HALF_D - 0.22, WALL_TOP + 0.82)))

    # The fixed collar the roof ventilator turns inside (part of the body, not the spinning node).
    parts.append(rr.beveled_cylinder("vent_base", 0.24, 0.14, "dark_metal", (VENT_X, VENT_Y, VENT_BASE_CZ)))

    body = rr.join(parts, "shop")
    rr.set_origin(body, (0.0, 0.0, 0.0))  # base-centre, on the ground — the in-game origin convention
    return body


def _vent():
    """The roof whirlybird turbine — a hub + six angled vanes + a cap, joined into `joint_vent`, its
    origin on the vertical spin axis so the game's spin (about three.js +Y) turns it cleanly in place."""
    parts = []
    hub_cz = VENT_AXIS_TOP + 0.16
    parts.append(rr.beveled_cylinder("vent_hub", 0.10, 0.32, "bone_white", (VENT_X, VENT_Y, hub_cz)))
    parts.append(rr.beveled_cylinder("vent_cap", 0.13, 0.06, "scrap_grey", (VENT_X, VENT_Y, hub_cz + 0.19)))
    for i in range(6):
        a = i * (math.pi / 3.0)
        bx = VENT_X + 0.17 * math.cos(a)
        by = VENT_Y + 0.17 * math.sin(a)
        vane = rr.beveled_box(f"vent_vane_{i}", (0.04, 0.15, 0.30), "bone_white", (bx, by, hub_cz))
        vane.rotation_euler = (math.radians(24), 0.0, a + math.pi / 2)  # tilt + face tangential
        parts.append(vane)

    vent = rr.join(parts, "joint_vent")
    rr.set_origin(vent, (VENT_X, VENT_Y, hub_cz))  # on the spin axis
    return vent


def build():
    body = _body()
    vent = _vent()
    rr.parent_keep(vent, body)
    return body
