"""
Shared builder for the RIGRUNNER chassis FRAME — the per-size host the rig composes onto.

The Frame is the chassis's structural sub-part AND its assembly host (`docs/part-identity-spec.md`
§2b): it carries the rig_blue mounting deck divided into cols×rows cells, plus the corner SOCKETS the
shared Wheel + Suspension units instance onto. Because the frame owns the corner positions, each size
gets its own track width by construction — one shared Wheel unit fits both the 1 m scout and the 3 m
hauler (the spec's "shared axle/suspension, per-size frames" resolution of the track-width fork).

This is the body `chassis_common` used to build for the whole rig, MINUS the wheels — those are now the
instanced `wheel-axle` sub-part. Conventions are unchanged so the deck still lines up with `mounting.ts`:

  * "rig-body" — chassis + skid + deck + grid lips + bumper, JOINED into one static object. The deploy
    animator Y-scales THIS node to un-squash the rig; the sockets are top-level SIBLINGS of it (not
    children), so that scale never moves the wheels.
  * "socket_axle_<i>" / "socket_susp_<i>" — PLAIN_AXES empties at each wheel corner. The assembler snaps
    one shared Wheel unit (origin at its hub) onto every axle socket and one Suspension unit (base-centre)
    onto every suspension socket. Left as top-level siblings (the `e_casing` host pattern): the rig-body
    is already base-centred, so `finalize_and_export`'s re-origin is a no-op and the empties keep pose.
  * Footprint centred on X/Y, lowest point at Z=0; front faces Blender +Y (→ −Z in-game).
  * Deck top at DECK_TOP=0.66 — the `MountGrid.deckY` both chassis recipes carry.
  * Cells are cellSize=1, centred on the origin, matching mounting.ts `cellLocalOffset`.
"""

import bpy  # type: ignore  # Blender runtime
import rr_style as rr

WHEEL_R = 0.33       # the Wheel unit's radius → its socket sits at this hub height
WHEEL_INSET = 0.14   # wheel corner tucked just under the deck edge (chassis_common: half_w − 0.14)

DECK_BOT = 0.50      # top deck slab bottom
DECK_TOP = 0.66      # deck surface — matches both recipes' MountGrid.deckY
LIP_TOP = 0.74       # raised grid ridges that draw the cells


def build_frame(width, length, cols, rows, axle_ys):
    """Build a `width`×`length` m frame: a cols×rows mounting deck with one corner socket PAIR per entry
    in `axle_ys`. Returns the joined "rig-body"; the socket empties stay separate named nodes. `cols`/
    `rows` must equal `width`/`length` in cells (cellSize=1)."""
    half_w = width / 2
    half_l = length / 2
    wheel_x = half_w - WHEEL_INSET  # corner X — owns this size's track width

    body = []
    # Central skid plate — the lowest geometry, reaches Z=0 so the body bbox bottom is the ground.
    body.append(rr.beveled_box("skid", (width * 0.55, length * 0.80, 0.14), "dark_metal", (0.0, 0.0, 0.07)))
    # Chassis block between the wheels (narrower than the track so the wheels read on the sides).
    body.append(rr.beveled_box("chassis", (width * 0.70, length - 0.5, 0.36), "dark_metal", (0.0, 0.0, 0.32)))
    # The mounting deck — the signature rig_blue slab the player builds onto.
    body.append(rr.beveled_box("deck", (width, length, DECK_TOP - DECK_BOT), "rig_blue",
                               (0.0, 0.0, (DECK_BOT + DECK_TOP) / 2)))

    # Raised grid lips dividing the deck into cols×rows cells — dark_metal to contrast the blue so the
    # mounting grid is legible. The frame sits fully on the blue; dividers fall on cell boundaries.
    lip_z = (DECK_TOP + LIP_TOP) / 2
    lip_h = LIP_TOP - DECK_TOP
    rail = 0.12       # rail thickness (thin rails pinch under the bevel and read as broken)
    inset = rail / 2  # pull the frame in so each rail sits FULLY on the deck, not half off the edge
    span_x = width - rail
    span_y = length - rail
    edge_x = half_w - inset
    edge_y = half_l - inset
    body.append(rr.beveled_box("edge_front", (span_x, rail, lip_h), "dark_metal", (0.0, -edge_y, lip_z)))
    body.append(rr.beveled_box("edge_back", (span_x, rail, lip_h), "dark_metal", (0.0, edge_y, lip_z)))
    body.append(rr.beveled_box("edge_left", (rail, span_y, lip_h), "dark_metal", (-edge_x, 0.0, lip_z)))
    body.append(rr.beveled_box("edge_right", (rail, span_y, lip_h), "dark_metal", (edge_x, 0.0, lip_z)))
    # Interior longitudinal dividers between columns, at cell boundaries x = -half_w + c.
    for c in range(1, cols):
        body.append(rr.beveled_box(f"div_col{c}", (rail, span_y, lip_h), "dark_metal", (-half_w + c, 0.0, lip_z)))
    # Interior transverse dividers between rows, at cell boundaries y = -half_l + r.
    for r in range(1, rows):
        body.append(rr.beveled_box(f"div_row{r}", (span_x, rail, lip_h), "dark_metal", (0.0, -half_l + r, lip_z)))

    # Front bumper + headlight nubs at +Y — the in-game forward (−Z), so the bumper leads when you
    # accelerate. Tucked under the deck's front overhang so it reads as attached.
    body.append(rr.beveled_box("bumper", (width * 0.80, 0.26, 0.34), "dark_metal", (0.0, half_l - 0.10, 0.34)))
    light_x = min(0.50, half_w - 0.15)
    body.append(rr.beveled_box("light_l", (0.18, 0.12, 0.18), "hazard_yellow", (-light_x, half_l - 0.02, 0.40)))
    body.append(rr.beveled_box("light_r", (0.18, 0.12, 0.18), "hazard_yellow", (light_x, half_l - 0.02, 0.40)))

    rr.join(body, "rig-body")

    # Corner sockets — one PAIR per axle row, numbered 0..(2n−1) left-then-right. The Wheel unit (hub
    # origin) snaps onto socket_axle_* at hub height; the Suspension unit (base-centre) snaps onto
    # socket_susp_*, just inboard of the wheel and resting on the ground, so it reads as running gear
    # bridging the deck to the wheel. Left as top-level siblings of rig-body (see the module docstring).
    susp_x = wheel_x - 0.04
    for i, y in enumerate(axle_ys):
        rr.empty(f"socket_axle_{2 * i}", (-wheel_x, y, WHEEL_R))
        rr.empty(f"socket_axle_{2 * i + 1}", (wheel_x, y, WHEEL_R))
        rr.empty(f"socket_susp_{2 * i}", (-susp_x, y, 0.0))
        rr.empty(f"socket_susp_{2 * i + 1}", (susp_x, y, 0.0))

    # build() returns the object finalize_and_export normalises. The body bbox bottom is Z=0 and it is
    # centred, so the base-centre re-origin moves nothing and the separate socket empties keep their poses.
    return bpy.data.objects["rig-body"]
