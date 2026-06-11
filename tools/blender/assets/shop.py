"""
shop — a world shop: a rusty container trade post the rig drives to, to buy/sell parts.

Two jobs beyond "be a container". First, the ENTRANCE must read from the game's elevated camera (the
roof covers only the BACK so the front bay is open to the sky and lit; a bright counter + a hazard
doorway frame + a warm lamp panel + a warm beacon on a mast mark it as a place you walk up and trade).

Second — and this is the design intent — the shop is a **sign of life** in a barren world. Where an enemy
camp reads as ruined and worthless, a shop reads as tended and valuable: a leafy pot plant by the door
and vines creeping up the container show green still clings on here; a neat crate stack and a pallet of
laid-out wares show someone keeps stock in order (refined, not the chaotic scrap strewn across the world).
That contrast is a navigation cue — in an empty landscape, the one spot with greenery and order is worth
driving to. (The worked-ground oil staining is added in-engine, not here — features/shop/shop-stains.ts.)

This is the RUSTY tier's asset. Higher tiers get their OWN asset (iron = posh clean metal; future tiers =
grand and futuristic) — the design consideration is recorded in game/src/features/shop/CLAUDE.md.

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


def _shell():
    """The container shell with an OPEN, lit front bay: three walls + floor, a back-only roof, the
    service counter, the hazard doorway frame, and the emissive warm lamp panel + beacon."""
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

    # The warm lamp markers — a lived-in glow that reads through shadow and from any angle. The lamp panel
    # hangs on the gantry facing out; the beacon rides a mast ABOVE the roofline so it's never occluded.
    parts.append(rr.beveled_box("lamp_panel", (1.5, 0.05, 0.30), "glow_warm", (0.0, HALF_D + 0.04, WALL_TOP - 0.22)))
    parts.append(rr.beveled_box("beacon_mast", (0.08, 0.08, 0.70), "dark_metal", (HALF_W - 0.28, HALF_D - 0.22, WALL_TOP + 0.35)))
    parts.append(rr.beveled_box("beacon_lamp", (0.20, 0.20, 0.20), "glow_warm", (HALF_W - 0.28, HALF_D - 0.22, WALL_TOP + 0.82)))

    # The fixed collar the roof ventilator turns inside (part of the body, not the spinning node).
    parts.append(rr.beveled_cylinder("vent_base", 0.24, 0.14, "dark_metal", (VENT_X, VENT_Y, VENT_BASE_CZ)))

    return parts


def _pot_plant(cx, cy):
    """A leafy plant in a planter — greenery at the entrance, the clearest sign life clings on here."""
    parts = []
    parts.append(rr.beveled_box("planter", (0.44, 0.44, 0.40), "rust", (cx, cy, 0.20)))
    parts.append(rr.beveled_box("planter_rim", (0.50, 0.50, 0.07), "dark_metal", (cx, cy, 0.40)))
    parts.append(rr.beveled_box("plant_stem", (0.07, 0.07, 0.34), "nature_green", (cx, cy, 0.55)))
    # A bushy clump of angled leaf slabs so the foliage reads full from the elevated camera.
    leaves = [
        ((0.30, 0.18, 0.20), (cx - 0.10, cy - 0.04, 0.62), (0.35, 0.0, 0.4)),
        ((0.18, 0.30, 0.22), (cx + 0.10, cy + 0.06, 0.66), (0.2, 0.3, 1.0)),
        ((0.26, 0.24, 0.22), (cx - 0.02, cy + 0.08, 0.74), (-0.25, 0.2, 0.6)),
        ((0.20, 0.20, 0.20), (cx + 0.06, cy - 0.08, 0.78), (0.25, -0.2, 1.4)),
        ((0.16, 0.16, 0.18), (cx - 0.06, cy + 0.02, 0.86), (0.1, 0.4, -0.5)),
    ]
    for i, (size, loc, rot) in enumerate(leaves):
        leaf = rr.beveled_box(f"leaf_{i}", size, "nature_green", loc)
        leaf.rotation_euler = rot
        parts.append(leaf)
    return parts


def _vines(wall_x):
    """Vines creeping up the LEFT container wall — green reclaiming the rust, a quiet pulse of life. A
    couple of strands with leaf tufts, flush against the exterior face (`wall_x` just outside the wall)."""
    parts = []
    strands = [(-0.30, 1.45), (0.34, 1.05)]  # (centre Y along the wall, height climbed)
    for s, (sy, h) in enumerate(strands):
        parts.append(rr.beveled_box(f"vine_{s}", (0.05, 0.05, h), "nature_green", (wall_x, sy, FLOOR_TOP + h / 2)))
        # leaf tufts stepping up the strand
        for k in range(3):
            lz = FLOOR_TOP + 0.35 + k * (h / 3.2)
            dy = 0.10 if k % 2 == 0 else -0.10
            parts.append(rr.beveled_box(f"vine_{s}_leaf_{k}", (0.05, 0.16, 0.10), "nature_green",
                                        (wall_x - 0.02, sy + dy, lz)))
    return parts


def _crates(cx, cy):
    """A NEAT stack of two marked crates — kept stock, in order. The bone-white stencil + hazard band read
    them as inventoried goods, not the chaotic scrap strewn across the world."""
    parts = []
    # base crate
    parts.append(rr.beveled_box("crate_a", (0.72, 0.72, 0.72), "rust", (cx, cy, 0.36)))
    parts.append(rr.beveled_box("crate_a_band", (0.74, 0.10, 0.10), "hazard_yellow", (cx, cy + 0.37, 0.52)))
    # smaller crate stacked on top, tidily offset
    parts.append(rr.beveled_box("crate_b", (0.56, 0.56, 0.56), "rust", (cx - 0.06, cy - 0.05, 0.72 + 0.28)))
    parts.append(rr.beveled_box("crate_b_label", (0.30, 0.04, 0.22), "bone_white", (cx - 0.06, cy - 0.05 + 0.29, 1.00)))
    return parts


def _wares(cx, cy):
    """A pallet of laid-out wares beside the counter — refined parts on display: a couple of canisters, a
    module box and a coil, set out in a tidy row (the orderly counterpoint to world scrap)."""
    parts = []
    parts.append(rr.beveled_box("pallet", (0.95, 0.70, 0.12), "dark_metal", (cx, cy, 0.06)))
    parts.append(rr.beveled_cylinder("ware_canister_a", 0.13, 0.34, "scrap_grey", (cx - 0.26, cy - 0.06, 0.12 + 0.17)))
    parts.append(rr.beveled_cylinder("ware_canister_b", 0.11, 0.30, "scrap_grey", (cx - 0.02, cy + 0.10, 0.12 + 0.15)))
    parts.append(rr.beveled_box("ware_module", (0.26, 0.22, 0.22), "dark_metal", (cx + 0.22, cy - 0.10, 0.12 + 0.11)))
    coil = rr.beveled_cylinder("ware_coil", 0.10, 0.24, "bone_white", (cx + 0.20, cy + 0.12, 0.12 + 0.10))
    coil.rotation_euler = (0.0, math.pi / 2, 0.0)  # lay it on its side
    parts.append(coil)
    return parts


def _body():
    """The whole static shop: the lit container shell plus the sign-of-life dressing around it, joined
    into one mesh `shop` with its origin dropped to base-centre on the ground (the in-game convention)."""
    parts = _shell()
    parts += _pot_plant(-1.92, 0.95)          # front-left, flanking the entrance
    parts += _vines(-(HALF_W + 0.03))         # up the left exterior wall
    parts += _crates(2.05, -0.15)             # tidy stack off the right side
    parts += _wares(1.78, 0.92)               # pallet of wares to the right of the counter

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
