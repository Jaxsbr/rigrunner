"""
storage — an open-top cargo tank the player mounts on the rig to hold collected scrap.

A "Small part" on the size ladder (docs/asset-style.md): a 1×1-cell footprint, ~0.9 m tall. The
read we're after is a rugged industrial *tank*: a chunky, heavily-rounded steel body with a raised
reinforced rim around the open mouth — not a thin-walled bin. No lid, so the scrap collecting inside
is visible (the game draws a fill block rising in the cavity; this asset is just the empty shell).

Built as ONE solid block with the cavity *boolean-cut* out (rather than four wall panels, which read
as loose plates), beveled once so only the true edges round — giving the continuous tank surface.

Colour: a `rust` body (weathered tank) deliberately OFF the `rig_blue` of the rig deck so the two
don't blend, with a `hazard_yellow` rim collar for visibility and the industrial-hazard read. The
game's scrap fill stays grey, contrasting the rust interior.
"""

import bpy  # type: ignore  # Blender runtime
import bmesh  # type: ignore  # Blender runtime

import rr_style as rr


OUTER = 1.00     # outer footprint: 1 grid cell square
HEIGHT = 0.90    # overall body height
WALL_T = 0.10    # chunky walls — thick enough to read as a tank and take a big round
CAVITY = OUTER - 2 * WALL_T  # 0.80 m clear interior (kept in sync with RenderView fill constants)
BEVEL_W = 0.05   # generous edge round for the soft tank surface (incl. the inner corners)
BEVEL_SEG = 3    # multiple segments → a smooth curve, not a single chamfer
RIM_BEVEL_W = 0.08   # the rim collar rounds MORE than the body — soft, rolled outer corners
RIM_BEVEL_SEG = 4


def _raw_box(name, size, mat, location):
    """A plain palette-coloured box with NO per-box bevel — an operand for the booleans below.

    (We can't use rr.beveled_box: its per-box bevel is what makes separate pieces read as separate
    plates. We bevel ONCE, on the finished merged shell, via rr.apply_style + the override below.)
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(rr.material(mat))
    return obj


def _bake_finish(obj, width, segments):
    """Smooth-shade + bevel + weighted-normal, then BAKE the modifiers into the mesh.

    Baking per-piece (instead of relying on join keeping one object's modifiers) lets the rim carry
    a bigger round than the body — join can't, since it would force one shared bevel on everything.
    """
    rr.apply_style(obj)
    obj.modifiers["RR_bevel"].width = width
    obj.modifiers["RR_bevel"].segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="RR_bevel")
    if "RR_wn" in obj.modifiers:
        bpy.ops.object.modifier_apply(modifier="RR_wn")


def _finish_rim(obj):
    """Round only the rim's OUTER corners — a soft, rolled outer profile — while leaving the inner
    opening crisp. A uniform (angle-limited) bevel would round the inner edges too and visually
    close the mouth, so we bevel just the outer-perimeter edges directly with bmesh.
    """
    # Outer verts sit at ±(OUTER+0.06)/2 ≈ 0.53; inner (hole) verts at ±CAVITY/2 = 0.40. An edge is
    # "outer" when BOTH its ends are out past this threshold — that's the outer box, not the opening.
    outer_min = (OUTER + 0.06) / 2.0 - 0.04
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    outer_edges = [
        e for e in bm.edges
        if all(max(abs(v.co.x), abs(v.co.y)) > outer_min for v in e.verts)
    ]
    bmesh.ops.bevel(
        bm, geom=outer_edges, offset=RIM_BEVEL_W, segments=RIM_BEVEL_SEG,
        affect="EDGES", profile=0.5, clamp_overlap=True,
    )
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()

    wn = obj.modifiers.new("RR_wn", "WEIGHTED_NORMAL")  # clean catch-light, baked in
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=wn.name)


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
    # Body: solid rust block with the cavity carved from the floor up and out through the top.
    body = _raw_box("body", (OUTER, OUTER, HEIGHT), "rust", (0.0, 0.0, HEIGHT / 2.0))
    _difference(body, _raw_box("cavity", (CAVITY, CAVITY, 1.0), "rust", (0.0, 0.0, WALL_T + 0.5)))

    # Rim collar: a hazard-yellow hoop standing proud around the open mouth — the tank's reinforced
    # opening. A ring = outer block minus the same cavity hole, so the mouth stays clear.
    rim = _raw_box("rim", (OUTER + 0.06, OUTER + 0.06, 0.14), "hazard_yellow", (0.0, 0.0, HEIGHT))
    _difference(rim, _raw_box("rim_hole", (CAVITY, CAVITY, 0.4), "hazard_yellow", (0.0, 0.0, HEIGHT)))

    _bake_finish(body, BEVEL_W, BEVEL_SEG)  # the tank body's soft surface (uniform round is fine here)
    _finish_rim(rim)                        # the rim: round only the OUTER corners, opening kept open

    return rr.join([body, rim], "storage")
