"""
container-rim — the storage container's RIM sub-part: the reinforced collar around the open mouth.

A "Small part" on the size ladder (docs/asset-style.md): a 1×1-cell square hoop, ~0.18 m tall. The
read is a `hazard_yellow` reinforced rim — a rolled square ring with dark_metal corner bolts — the
piece that crowns `container-shell`'s mouth (together they compose the whole container in Phase 2b).
On its own it reads as a collar/frame, not a lid: the centre is open.

Built as an outer block with the inner mouth BOOLEAN-cut out (so the opening stays clear), beveled
once. The ring is the first join chunk; its single live bevel rounds the merged hoop + bolts on export.
"""

import bpy  # type: ignore  # Blender runtime

import rr_style as rr

OUTER = 1.06     # a touch wider than the shell so the collar overhangs the mouth
HEIGHT = 0.18    # crown height
HOLE = 0.80      # clear opening — matches the shell's cavity


def _raw_box(name, size, mat, location):
    """A plain palette box with NO per-box bevel — an operand for the boolean below."""
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
    # Ring — a hazard_yellow square hoop: outer block minus the mouth hole, so the centre stays open.
    ring = _raw_box("ring", (OUTER, OUTER, HEIGHT), "hazard_yellow", (0.0, 0.0, HEIGHT / 2.0))
    _difference(ring, _raw_box("hole", (HOLE, HOLE, 1.0), "hazard_yellow", (0.0, 0.0, HEIGHT / 2.0)))
    rr.apply_style(ring)  # one live bevel → rounds the whole join on export

    parts = [ring]
    # Corner bolts — dark nubs straddling the ring's outer corner (centred on the edge at ±OUTER/2 so
    # they stand proud, never coplanar with the ring's outer face — that coplanarity z-fought).
    edge = OUTER / 2.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(
                f"bolt_{sx}_{sy}", (0.12, 0.12, 0.10), "dark_metal", (sx * edge, sy * edge, HEIGHT - 0.04)))

    return rr.join(parts, "container-rim")
