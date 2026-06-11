"""
shop — a world shop: a rusty shipping-container shopfront the rig drives to, to buy/sell parts.

Reads as a scavenger-world trade post: a rust container box with three solid walls + roof, its long
FRONT (+Y) cut open into a counter under a dark lintel and a forward awning — so it's unmistakably a
place you walk up to and trade, distinct from the workshop platform and the camp tents. A
hazard_yellow sign band + a glow_green "open" light mark it as live; corrugation ribs give the
container read.

ARTICULATED: the roof carries a `joint_vent` whirlybird turbine — a separate node the game spins about
its vertical axis (shop-vent-animator.ts), so the silhouette reads as occupied from across the bowl. So
build_asset.py exports the scene hierarchy as-is (the body root is already at base-centre on the ground;
the vent stays its own node). Authored front-toward +Y, origin at base-centre, like every asset.
"""

import math

import rr_style as rr

ARTICULATED = True

# --- dimensions (metres, Blender Z-up) -------------------------------------------------
W = 3.2          # X — width
D = 2.2          # Y — depth
WALL_H = 2.0     # wall height above the floor slab
T = 0.14         # wall thickness
FLOOR_T = 0.12
ROOF_T = 0.14

HALF_W = W / 2
HALF_D = D / 2
FLOOR_TOP = FLOOR_T                       # 0.12
WALL_CZ = FLOOR_TOP + WALL_H / 2          # wall centre height
WALL_TOP = FLOOR_TOP + WALL_H             # 2.12
ROOF_CZ = WALL_TOP + ROOF_T / 2           # 2.19
ROOF_TOP = WALL_TOP + ROOF_T              # 2.26

# Where the roof ventilator sits (offset back-right so it doesn't crown the opening).
VENT_X = 0.7
VENT_Y = -0.45
VENT_BASE_CZ = ROOF_TOP + 0.07            # the fixed collar centre, on the roof
VENT_AXIS_TOP = ROOF_TOP + 0.14           # top of the collar = bottom of the spinning turbine


def _body():
    """The container shell (three walls + floor + roof), the open front framing, the counter, the
    awning and the signage — one joined mesh, origin dropped to base-centre on the ground."""
    parts = []

    # Floor + three solid walls (back, left, right); the front (+Y) is left open.
    parts.append(rr.beveled_box("floor", (W, D, FLOOR_T), "dark_metal", (0.0, 0.0, FLOOR_TOP / 2)))
    parts.append(rr.beveled_box("wall_back", (W, T, WALL_H), "rust", (0.0, -(HALF_D - T / 2), WALL_CZ)))
    parts.append(rr.beveled_box("wall_left", (T, D, WALL_H), "rust", (-(HALF_W - T / 2), 0.0, WALL_CZ)))
    parts.append(rr.beveled_box("wall_right", (T, D, WALL_H), "rust", (HALF_W - T / 2, 0.0, WALL_CZ)))
    parts.append(rr.beveled_box("roof", (W + 0.12, D + 0.12, ROOF_T), "scrap_grey", (0.0, 0.0, ROOF_CZ)))

    # Corrugation ribs down the back wall — the shipping-container read.
    for i, x in enumerate((-1.15, -0.6, -0.05, 0.5, 1.05)):
        parts.append(rr.beveled_box(f"rib_{i}", (0.08, 0.06, WALL_H - 0.24), "dark_metal",
                                    (x, -(HALF_D + 0.02), WALL_CZ)))

    # The open FRONT: two corner posts + a header lintel frame the cut-open face.
    parts.append(rr.beveled_box("post_left", (0.18, 0.30, WALL_H), "dark_metal", (-(HALF_W - 0.09), HALF_D - 0.15, WALL_CZ)))
    parts.append(rr.beveled_box("post_right", (0.18, 0.30, WALL_H), "dark_metal", (HALF_W - 0.09, HALF_D - 0.15, WALL_CZ)))
    parts.append(rr.beveled_box("lintel", (W, 0.30, 0.34), "dark_metal", (0.0, HALF_D - 0.15, WALL_TOP - 0.17)))

    # The trade counter across the lower half of the opening.
    parts.append(rr.beveled_box("counter", (W - 0.5, 0.34, 0.86), "scrap_grey", (0.0, HALF_D - 0.18, FLOOR_TOP + 0.43)))
    parts.append(rr.beveled_box("counter_lip", (W - 0.5, 0.06, 0.10), "hazard_yellow", (0.0, HALF_D + 0.01, FLOOR_TOP + 0.83)))

    # A forward awning over the counter + a signage band and an "open" light on the lintel.
    parts.append(rr.beveled_box("awning", (W + 0.2, 0.6, 0.08), "rust", (0.0, HALF_D + 0.26, WALL_TOP - 0.06)))
    parts.append(rr.beveled_box("sign", (1.7, 0.05, 0.24), "hazard_yellow", (-0.25, HALF_D + 0.02, WALL_TOP - 0.17)))
    parts.append(rr.beveled_box("open_light", (0.16, 0.08, 0.16), "glow_green", (HALF_W - 0.45, HALF_D + 0.02, WALL_TOP - 0.17)))

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
    # Six vanes around the hub, each tilted so the turbine reads as a wind-driven scoop.
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
