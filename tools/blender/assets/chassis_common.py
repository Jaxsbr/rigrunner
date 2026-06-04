"""
Shared builder for the RIGRUNNER chassis family — the player's vehicle foundation.

Both sizes (1×3 scout, 3×5 hauler) share one construction: a low drive-train chassis carrying a
rig_blue mounting deck divided into cols×rows cells, riding on a set of code-spun wheels. This
parameterises rig.py's authoring so the two sizes stay visually consistent and differ only in
footprint + wheel count.

Conventions (identical to rig.py):
  * "rig-body" — chassis + skid + deck + grid lips + bumper, JOINED into one static object.
  * "wheel_*"  — each wheel its OWN unjoined object so it survives in the GLB as a named node the
                 render layer spins by the rig's speed. Origin stays at the hub for in-place spin.
  * Footprint centred on X/Y, lowest point at Z=0. The front faces Blender +Y, which after +Y-up
    export lands as −Z in three.js — the in-game forward (movement.ts drives forward = −z).
  * Deck top at DECK_TOP=0.66 — the `MountGrid.deckY` both chassis recipes carry.
  * Cells are cellSize=1, centred on the origin, matching mounting.ts `cellLocalOffset`, so the
    visible grid lips line up exactly with where parts snap.
"""

import math

import bpy  # type: ignore  # Blender runtime
import rr_style as rr

WHEEL_R = 0.33       # radius → wheel bottom sits on Z=0
WHEEL_W = 0.30       # tread width (along the X axle)
HUB_DEPTH = WHEEL_W + 0.06  # hub pokes out both tyre faces

DECK_BOT = 0.50      # top deck slab
DECK_TOP = 0.66      # deck surface — matches both recipes' MountGrid.deckY
LIP_TOP = 0.74       # raised grid ridges that draw the cells


def _cyl(name, radius, depth, mat, verts):
    """A faceted cylinder in the RIGRUNNER finish, axle along Z (rotated to X by the caller)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(rr.material(mat))
    rr.apply_style(obj)
    return obj


def _wheel(name, center):
    """One wheel: faceted tyre + hub + a hazard nub + lug ring, built axle-along-Z then rotated so
    the axle is X (baked). Finally moved to `center` WITHOUT applying the move, leaving the origin at
    the hub so the render layer spins it in place."""
    parts = [
        _cyl(f"{name}_tyre", WHEEL_R, WHEEL_W, "dark_metal", 14),
        _cyl(f"{name}_hub", 0.15, HUB_DEPTH, "rust", 8),
        rr.beveled_box(f"{name}_nub", (0.10, 0.10, 0.12), "hazard_yellow", (0.0, WHEEL_R - 0.05, 0.0)),
    ]
    # Lug nuts: a ring of dark bolts proud of each rust hub face — high contrast + off-centre, so the
    # wheel's rotation is unmistakable from either side as it turns.
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


def build_chassis(width, length, cols, rows, axle_ys):
    """Build a chassis of `width`×`length` metres with a cols×rows mounting grid and one wheel pair
    per entry in `axle_ys` (each a Blender-Y axle position). Returns the joined "rig-body"; wheels
    stay separate named nodes. `cols`/`rows` must equal `width`/`length` in cells (cellSize=1)."""
    half_w = width / 2
    half_l = length / 2
    wheel_x = half_w - 0.14  # tucked just under the deck edge (rig.py: 0.86 under HALF_W 1.0)

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

    # Wheels — left unjoined so each stays an addressable node the render layer can spin.
    for i, y in enumerate(axle_ys):
        _wheel(f"wheel_l{i}", (-wheel_x, y, WHEEL_R))
        _wheel(f"wheel_r{i}", (wheel_x, y, WHEEL_R))

    # build() returns the object finalize_and_export normalises. The body bbox bottom is Z=0 and it is
    # centred, so the base-centre origin pass moves nothing and the separate wheels keep their poses.
    return bpy.data.objects["rig-body"]
