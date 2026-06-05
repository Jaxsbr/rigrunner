"""
Shared builder for the RIGRUNNER chassis FRAME — the per-size host the rig composes onto.

The Frame is the chassis's structural sub-part AND its assembly host (`docs/part-identity-spec.md`
§2b): it carries the rig_blue mounting deck divided into cols×rows cells, plus the corner SOCKETS the
Wheel + Suspension units instance onto. The 1×3 scout and 3×5 hauler diverged enough that they no longer
share parts — each frame is its own size and instances its OWN wheel/suspension (the scout's smaller wheel
gives it a lower deck), so `build_frame` takes the size's `wheel_r`/`tread` and derives the deck height +
socket positions from them.

It is a FLAT frame — the deck on top, a thin dark ladder (two side rails + cross members at the axle
stations) hung just below it — with OPEN ground clearance beneath: no slab reaches the floor, so the
wheels and the suspension units show in the gap (a real-vehicle read, not a brick on wheels). Conventions:

  * "rig-body" — deck + grid lips + ladder frame + front bumper, JOINED into one static object. The deploy
    animator Y-scales THIS node to un-squash the rig; the sockets are top-level SIBLINGS of it (not
    children), so that scale never moves the wheels.
  * "socket_axle_<i>" / "socket_susp_<i>" — PLAIN_AXES empties at each wheel corner. The assembler snaps
    one Wheel unit (origin at its hub) onto every axle socket and one Suspension unit (base-centre) onto
    every suspension socket. The suspension sits INBOARD of the wheel (in the clearance gap), not under it.
  * The frame FLOATS (its lowest geometry is the ladder underside, well above Z=0), so it is exported
    AS-AUTHORED — the size modules set `ARTICULATED = True` to skip `build_asset`'s base-centre re-origin,
    which would otherwise drop the frame to the floor and erase the clearance. `rig-body`'s origin is set
    to (0,0,0) so the rig still rests right and the deploy's deck un-squash grows up from the ground.
  * Footprint centred on X/Y; front faces Blender +Y (→ −Z in-game).
  * Deck surface at deck_top = wheel_r*2 + 0.18 — the `MountGrid.deckY` the size's recipe carries. The deck
    rides clear above the wheels (its underside > the wheel tops) so it never z-fights the tucked-under
    wheels. KEEP the recipe's deckY in step with this (1×3 → 0.70, 3×5 → 0.84).
  * Cells are cellSize=1, centred on the origin, matching mounting.ts `cellLocalOffset`.
"""

import bpy  # type: ignore  # Blender runtime
import rr_style as rr

WHEEL_INSET = 0.14   # wheel corner tucked just under the deck edge (chassis_common: half_w − 0.14)
DECK_THK = 0.16      # deck slab thickness
FRAME_BAND = 0.22    # how far the ladder frame hangs below the deck (clearance starts under it)


def build_frame(width, length, cols, rows, axle_ys, wheel_r, tread):
    """Build a `width`×`length` m frame for a wheel of radius `wheel_r`/`tread`: a cols×rows mounting deck
    on a flat ladder, with one corner socket PAIR per entry in `axle_ys`. Returns the joined "rig-body";
    the socket empties stay separate named nodes. `cols`/`rows` must equal `width`/`length` in cells."""
    half_w = width / 2
    half_l = length / 2
    wheel_x = half_w - WHEEL_INSET  # corner X — owns this size's track width

    deck_bot = wheel_r * 2 + 0.02   # deck underside, just clear of the wheel tops
    deck_top = deck_bot + DECK_THK  # deck surface — this size's MountGrid.deckY
    lip_top = deck_top + 0.08
    frame_bot = deck_bot - FRAME_BAND  # ladder underside; open ground clearance below this

    body = []
    # The mounting deck — the signature rig_blue slab the player builds onto, riding clear above the wheels.
    body.append(rr.beveled_box("deck", (width, length, deck_top - deck_bot), "rig_blue",
                               (0.0, 0.0, (deck_bot + deck_top) / 2)))

    # Raised grid lips dividing the deck into cols×rows cells — dark_metal to contrast the blue so the
    # mounting grid is legible. The frame sits fully on the blue; dividers fall on cell boundaries.
    lip_z = (deck_top + lip_top) / 2
    lip_h = lip_top - deck_top
    lip = 0.12        # lip thickness (thin lips pinch under the bevel and read as broken)
    inset = lip / 2   # pull the frame in so each lip sits FULLY on the deck, not half off the edge
    span_x = width - lip
    span_y = length - lip
    edge_x = half_w - inset
    edge_y = half_l - inset
    body.append(rr.beveled_box("edge_front", (span_x, lip, lip_h), "dark_metal", (0.0, -edge_y, lip_z)))
    body.append(rr.beveled_box("edge_back", (span_x, lip, lip_h), "dark_metal", (0.0, edge_y, lip_z)))
    body.append(rr.beveled_box("edge_left", (lip, span_y, lip_h), "dark_metal", (-edge_x, 0.0, lip_z)))
    body.append(rr.beveled_box("edge_right", (lip, span_y, lip_h), "dark_metal", (edge_x, 0.0, lip_z)))
    for c in range(1, cols):
        body.append(rr.beveled_box(f"div_col{c}", (lip, span_y, lip_h), "dark_metal", (-half_w + c, 0.0, lip_z)))
    for r in range(1, rows):
        body.append(rr.beveled_box(f"div_row{r}", (span_x, lip, lip_h), "dark_metal", (0.0, -half_l + r, lip_z)))

    # Flat ladder frame UNDER the deck — two dark side rails running the length + a cross member at each
    # axle station, hung just below the deck with open clearance below. The rails sit INBOARD of the wheel
    # tread so they never intersect the wheels; the wheels + suspension read in the gap on the outside.
    frame_h = deck_bot - frame_bot
    frame_cz = (frame_bot + deck_bot) / 2
    rail_t = 0.14
    rail_x = max(0.14, wheel_x - 0.24)  # inboard of the wheel tread (clear of the wheels)
    body.append(rr.beveled_box("rail_l", (rail_t, length - 0.3, frame_h), "dark_metal", (-rail_x, 0.0, frame_cz)))
    body.append(rr.beveled_box("rail_r", (rail_t, length - 0.3, frame_h), "dark_metal", (rail_x, 0.0, frame_cz)))
    cross_w = 2 * rail_x + rail_t
    for i, y in enumerate(axle_ys):
        body.append(rr.beveled_box(f"cross_{i}", (cross_w, 0.12, frame_h), "dark_metal", (0.0, y, frame_cz)))

    # Front bumper + headlight nubs at +Y — the in-game forward (−Z), riding at the frame line so they
    # read as the leading edge of the chassis.
    body.append(rr.beveled_box("bumper", (width * 0.80, 0.22, frame_h * 0.9), "dark_metal", (0.0, half_l - 0.10, frame_cz)))
    light_x = min(0.50, half_w - 0.15)
    body.append(rr.beveled_box("light_l", (0.18, 0.12, 0.14), "hazard_yellow", (-light_x, half_l - 0.02, frame_cz + 0.05)))
    body.append(rr.beveled_box("light_r", (0.18, 0.12, 0.14), "hazard_yellow", (light_x, half_l - 0.02, frame_cz + 0.05)))

    rr.join(body, "rig-body")
    # Ground origin so the rig rests right and the deploy's deck un-squash grows up from the floor. The
    # frame floats (lowest geometry at frame_bot), so it is exported AS-AUTHORED (ARTICULATED in the size
    # modules) — NOT base-centred, which would drop it to Z=0 and erase the clearance.
    rr.set_origin(bpy.data.objects["rig-body"], (0.0, 0.0, 0.0))

    # Corner sockets — one PAIR per axle row, numbered 0..(2n−1) left-then-right. The Wheel unit (hub
    # origin) snaps onto socket_axle_* at hub height. The Suspension unit (base-centre) snaps onto
    # socket_susp_*, sitting on the ground just INBOARD of each wheel's inner face — visible running gear
    # in the clearance gap, NOT hidden under the wheel. Top-level siblings of rig-body (see the docstring).
    susp_x = wheel_x - tread / 2 - 0.12
    for i, y in enumerate(axle_ys):
        rr.empty(f"socket_axle_{2 * i}", (-wheel_x, y, wheel_r))
        rr.empty(f"socket_axle_{2 * i + 1}", (wheel_x, y, wheel_r))
        rr.empty(f"socket_susp_{2 * i}", (-susp_x, y, 0.0))
        rr.empty(f"socket_susp_{2 * i + 1}", (susp_x, y, 0.0))

    return bpy.data.objects["rig-body"]
