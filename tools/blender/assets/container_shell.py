"""
container-shell — the storage container's BODY sub-part AND the container's assembly HOST.

A "Small part" on the size ladder (docs/asset-style.md): a 1×1-cell, ~0.85 m-tall open-top box. The
read is the signature `rig_blue` cargo hold — the §3 "rig_blue = containers/player-built" cue — a
thick-walled tub with an open mouth (so the scrap inside is visible in game) and dark_metal corner
posts + base skids. It is the assembly HOST: its GLB carries a `socket_rim` empty at the mouth, and the
shared assembler snaps the partner `container-rim` collar onto it at its own tier (`docs/asset-style.md`
"Assembly sockets") — together they compose the whole container. This piece is the body WITHOUT the rim.

Built as one solid block with the cavity BOOLEAN-cut out (open from the floor up through the top),
then beveled once so only true edges round — the continuous tub surface, the same technique the
whole-container `storage.py` uses. The body is the first join chunk; its single live bevel rounds the
merged shell (corner posts + skids included) on export.
"""

import bpy  # type: ignore  # Blender runtime

import rr_style as rr

OUTER = 1.00     # outer footprint: 1 grid cell square
HEIGHT = 0.85    # body height (the rim adds its own crown on top)
WALL_T = 0.10    # chunky walls — thick enough to read as a hold, not a thin bin
CAVITY = OUTER - 2 * WALL_T  # 0.80 m clear interior


def _raw_box(name, size, mat, location):
    """A plain palette box with NO per-box bevel — an operand for the boolean below (so the cavity
    cuts cleanly before the one finishing bevel rounds the whole shell)."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(rr.material(mat))
    return obj


def _difference(target, cutter):
    """Boolean-subtract `cutter` from `target` in place, then delete the cutter."""
    mod = target.modifiers.new("RR_cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier="RR_cut")
    bpy.data.objects.remove(cutter, do_unlink=True)


def build():
    # Body — a solid rig_blue block with the cavity carved from the floor up and out through the top.
    body = _raw_box("body", (OUTER, OUTER, HEIGHT), "rig_blue", (0.0, 0.0, HEIGHT / 2.0))
    _difference(body, _raw_box("cavity", (CAVITY, CAVITY, 1.0), "rig_blue", (0.0, 0.0, WALL_T + 0.5)))
    rr.apply_style(body)  # one live bevel on the body → rounds the whole join on export

    parts = [body]
    # Corner posts — dark reinforcements at the four vertical edges, the rugged-crate read.
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(
                f"post_{sx}_{sy}", (0.10, 0.10, HEIGHT), "dark_metal", (sx * 0.45, sy * 0.45, HEIGHT / 2.0)))
    # Base skids — two dark runners under the hold so it reads as sitting on feet, not flush.
    parts.append(rr.beveled_box("skid_l", (0.16, 0.90, 0.10), "dark_metal", (-0.34, 0.0, 0.05)))
    parts.append(rr.beveled_box("skid_r", (0.16, 0.90, 0.10), "dark_metal", (0.34, 0.0, 0.05)))

    body = rr.join(parts, "container-shell")

    # Assembly socket — the mouth, where the Rim collar's base seats (its origin snaps here at runtime).
    # The body is base-centred (skid bottoms on Z=0), so the base-centre re-origin is a no-op and this
    # top-level sibling empty keeps its position (the `chassis_common` pattern).
    rr.empty("socket_rim", (0.0, 0.0, HEIGHT))
    return body
