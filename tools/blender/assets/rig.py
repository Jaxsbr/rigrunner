"""
rig — the player's vehicle: a low drive-train chassis carrying a 2×3 mounting deck.

This is the anchor on the size ladder (docs/asset-style.md): a 2 m × 3 m footprint, ~0.75 m
tall "small buggy". It is built in two distinct pieces, on purpose:

  * "rig-body"  — chassis + skid plate + the rig_blue 2×3 deck + grid lips + front bumper,
                  all JOINED into one static object.
  * "wheel_*"   — 6 wheels, each its OWN object left UNJOINED so it survives in the GLB as a
                  separately-named node. The game's render layer looks these up by name and
                  spins them every frame, proportional to the rig's speed. We deliberately do
                  NOT bake a glTF animation: the spin is code-driven so it stays locked to the
                  felt tradeoff (a heavy, sluggish build visibly turns its wheels slower).

Footprint centred on X/Y, lowest point on Z=0. The front faces Blender +Y, which after the
+Y-up export lands as −Z in three.js — and the movement system drives "forward = −z" (see
systems/movement.ts), so the rig's bumper leads when you accelerate. The body's bounding box
reaches Z=0 (the skid plate), so finalize_and_export's base-centre origin pass is a no-op
shift and the wheels stay aligned.

Each wheel keeps its ORIGIN at its own hub centre (its `location` is never baked) so the
render layer can rotate it about its axle in place rather than orbiting the rig.
"""

import math

import bpy  # type: ignore  # Blender runtime
import rr_style as rr

# --- dimensions (metres, Blender Z-up) -------------------------------------------------
WIDTH = 2.0          # X — 2 cells
LENGTH = 3.0         # Y — 3 cells (front toward −Y)
HALF_W = WIDTH / 2
HALF_L = LENGTH / 2

WHEEL_R = 0.33       # radius → wheel bottom sits on Z=0
WHEEL_W = 0.30       # tread width (along the X axle)
WHEEL_X = 0.86       # centre offset from midline (tucked just under the deck edge)
WHEEL_Y = (-1.0, 0.0, 1.0)  # three axles down the length
HUB_DEPTH = WHEEL_W + 0.06  # hub pokes out both tyre faces

DECK_BOT = 0.50      # top deck slab
DECK_TOP = 0.66
LIP_TOP = 0.74       # raised grid ridges that draw the 2×3 cells


def _cyl(name, radius, depth, mat, verts):
    """A faceted cylinder in the RIGRUNNER finish, axle along Z (rotated to X by the caller).

    Low vertex count is intentional: the facets catch light differently as the wheel turns,
    so the spin reads even on a radially symmetric tyre.
    """
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(rr.material(mat))
    rr.apply_style(obj)
    return obj


def _wheel(name, center):
    """One wheel: faceted tyre + hub + a hazard nub on the rim (so rotation is obvious).

    Built axle-along-Z, joined, then rotated so the axle is X and that rotation is BAKED.
    Finally moved to `center` WITHOUT applying the move, leaving the origin at the hub so the
    render layer spins it in place.
    """
    parts = [
        _cyl(f"{name}_tyre", WHEEL_R, WHEEL_W, "dark_metal", 14),
        _cyl(f"{name}_hub", 0.15, HUB_DEPTH, "rust", 8),  # pokes out both faces
        rr.beveled_box(f"{name}_nub", (0.10, 0.10, 0.12), "hazard_yellow", (0.0, WHEEL_R - 0.05, 0.0)),
    ]

    # Lug nuts: a ring of dark bolts proud of each rust hub face. High contrast + off-centre,
    # so the wheel's rotation is unmistakable from either side as it turns.
    face_z = HUB_DEPTH / 2 + 0.02
    for face in (face_z, -face_z):
        for k in range(5):
            a = math.radians(72 * k)
            parts.append(rr.beveled_box(
                f"{name}_lug", (0.055, 0.055, 0.06), "dark_metal",
                (0.09 * math.cos(a), 0.09 * math.sin(a), face),
            ))

    wheel = rr.join(parts, name)

    wheel.rotation_euler = (0.0, math.radians(90), 0.0)  # axle Z → X
    bpy.ops.object.select_all(action="DESELECT")
    wheel.select_set(True)
    bpy.context.view_layer.objects.active = wheel
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    wheel.location = center  # NOT applied — origin stays at the hub for in-place spin
    return wheel


def build():
    body = []

    # Central skid plate — the lowest geometry, reaches Z=0 so the body bbox bottom is the
    # ground (keeps the base-centre origin pass a zero shift; wheels stay aligned).
    body.append(rr.beveled_box("skid", (1.10, 2.40, 0.14), "dark_metal", (0.0, 0.0, 0.07)))

    # Chassis block between the wheels (narrower than the track so the wheels read on the sides).
    body.append(rr.beveled_box("chassis", (1.40, 2.50, 0.36), "dark_metal", (0.0, 0.0, 0.32)))

    # The 2×3 mounting deck — the signature rig_blue slab the player builds onto.
    body.append(rr.beveled_box("deck", (WIDTH, LENGTH, DECK_TOP - DECK_BOT), "rig_blue",
                               (0.0, 0.0, (DECK_BOT + DECK_TOP) / 2)))

    # Raised grid lips dividing the deck into 2 (X) × 3 (Y) cells — dark_metal to contrast the
    # blue so the mounting grid is legible even before slot logic exists.
    lip_z = (DECK_TOP + LIP_TOP) / 2
    lip_h = LIP_TOP - DECK_TOP
    rail = 0.12  # doubled — thin rails pinched under the bevel and read as broken at junctions
    inset = rail / 2  # pull the frame in so each rail sits FULLY on the deck, not half off the edge
    span_x = WIDTH - rail   # rail extents that meet the corners without overhanging the deck
    span_y = LENGTH - rail
    edge_x = HALF_W - inset
    edge_y = HALF_L - inset
    # Closed perimeter frame, fully on the blue — the outer border that was hanging off the edge.
    body.append(rr.beveled_box("edge_front", (span_x, rail, lip_h), "dark_metal", (0.0, -edge_y, lip_z)))
    body.append(rr.beveled_box("edge_back", (span_x, rail, lip_h), "dark_metal", (0.0, edge_y, lip_z)))
    body.append(rr.beveled_box("edge_left", (rail, span_y, lip_h), "dark_metal", (-edge_x, 0.0, lip_z)))
    body.append(rr.beveled_box("edge_right", (rail, span_y, lip_h), "dark_metal", (edge_x, 0.0, lip_z)))
    # Interior dividers → 2×3. Sized to meet the frame and each other, so the grid reads closed.
    body.append(rr.beveled_box("div_long", (rail, span_y, lip_h), "dark_metal", (0.0, 0.0, lip_z)))
    body.append(rr.beveled_box("div_t1", (span_x, rail, lip_h), "dark_metal", (0.0, -0.5, lip_z)))
    body.append(rr.beveled_box("div_t2", (span_x, rail, lip_h), "dark_metal", (0.0, 0.5, lip_z)))

    # Front bumper + headlight nubs at +Y — the in-game forward (−Z), so the bumper leads when
    # you accelerate. Tucked under the deck's front overhang so it reads as attached.
    body.append(rr.beveled_box("bumper", (1.60, 0.26, 0.34), "dark_metal", (0.0, HALF_L - 0.10, 0.34)))
    body.append(rr.beveled_box("light_l", (0.18, 0.12, 0.18), "hazard_yellow", (-0.50, HALF_L - 0.02, 0.40)))
    body.append(rr.beveled_box("light_r", (0.18, 0.12, 0.18), "hazard_yellow", (0.50, HALF_L - 0.02, 0.40)))

    rr.join(body, "rig-body")

    # Wheels — left unjoined so each stays an addressable node the render layer can spin.
    for i, y in enumerate(WHEEL_Y):
        _wheel(f"wheel_l{i}", (-WHEEL_X, y, WHEEL_R))
        _wheel(f"wheel_r{i}", (WHEEL_X, y, WHEEL_R))

    # build() must return the object finalize_and_export normalises. Return the body: its bbox
    # bottom is Z=0 and it is centred, so the base-centre origin pass moves nothing and the
    # separate wheels keep their authored positions.
    return bpy.data.objects["rig-body"]
