"""
RIGRUNNER asset style kit.

The single source of visual consistency for RIGRUNNER 3D assets. EVERY asset is built by
calling into this module, so they all share one palette, one scale, one orientation, one
origin convention, and one set of edge/finish modifiers. Consistency comes from reuse here
— NOT from re-describing the style in each prompt.

Runs in two places with no changes:
  * Headless / reproducible:   blender --background --python tools/blender/build_asset.py -- <asset>
  * Interactive via MCP:       call these helpers from blender-mcp `execute_code`

Conventions (mirrored in docs/asset-style.md — keep them in sync):
  * SCALE        1 Blender unit = 1 metre = 1 grid cell. Author at real size.
  * UP           Blender is Z-up; the GLB export converts to glTF/three Y-up automatically.
  * FORWARD      Model the asset's FRONT facing Blender +Y. After +Y-up export that lands as
                 -Z in three.js — the direction the rig drives (systems/movement.ts: forward = -z).
  * ORIGIN       Base-centre (centre of the footprint, on the ground plane) so the asset
                 rests on y=0 in-game with no per-asset offset.
  * FINISH       Chunky industrial bevel + smooth-shade w/ weighted normals; low-poly.
"""

from __future__ import annotations

import json
import os

import bpy  # type: ignore  # provided by Blender's Python runtime
from mathutils import Vector  # type: ignore

# --------------------------------------------------------------------------------------
# Scale
# --------------------------------------------------------------------------------------

UNIT = 1.0  # 1 Blender unit == 1 metre == 1 grid cell. Author assets at real-world size.

# --------------------------------------------------------------------------------------
# Palette  (sRGB hex — the ONLY colours assets may use)
# --------------------------------------------------------------------------------------
# SINGLE SOURCE OF TRUTH: shared/palette.json. The same file feeds the TS side (viewer
# swatches, future game UI), so Blender and the app can never drift. To change/add a
# colour, edit that JSON — never hard-code one here. (Post-apocalyptic-but-healing: dusty
# scrap metals, signature RIGRUNNER blue for built parts, neon green for energy/tier fill,
# living green for restoration.)

_PALETTE_JSON = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shared", "palette.json")
)
with open(_PALETTE_JSON, encoding="utf-8") as _f:
    _PAL = json.load(_f)

PALETTE = {name: entry["hex"] for name, entry in _PAL.items()}

# Materials that should read as emissive (self-lit) rather than lit surfaces.
_EMISSIVE = {name for name, entry in _PAL.items() if entry.get("emissive")}


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _hex_to_linear_rgba(hex_str: str) -> tuple[float, float, float, float]:
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (_srgb_to_linear(r), _srgb_to_linear(g), _srgb_to_linear(b), 1.0)


def material(name: str):
    """Get-or-create the shared Principled material for a palette key.

    Shared by name, so two assets using `rig_blue` get the *same* material — identical
    colour, metalness, roughness. Never build an ad-hoc material; add a palette key instead.
    """
    if name not in PALETTE:
        raise KeyError(f"'{name}' is not in PALETTE. Allowed: {sorted(PALETTE)}")

    mat_name = f"RR_{name}"
    existing = bpy.data.materials.get(mat_name)
    if existing:
        return existing

    mat = bpy.data.materials.new(mat_name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    rgba = _hex_to_linear_rgba(PALETTE[name])
    bsdf.inputs["Base Color"].default_value = rgba

    if name in _EMISSIVE:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = 3.0
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.4
    elif name == "rig_blue":
        bsdf.inputs["Metallic"].default_value = 0.2   # painted, not bare metal
        bsdf.inputs["Roughness"].default_value = 0.5
    elif name == "nature_green":
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.8
    else:  # the metals
        bsdf.inputs["Metallic"].default_value = 0.9
        bsdf.inputs["Roughness"].default_value = 0.6

    return mat


# --------------------------------------------------------------------------------------
# Scene lifecycle
# --------------------------------------------------------------------------------------

def reset_scene() -> None:
    """Empty the scene so each build starts clean (safe headless and interactive)."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


# --------------------------------------------------------------------------------------
# Primitive builders  (use these instead of bpy.ops directly, so style stays uniform)
# --------------------------------------------------------------------------------------

def beveled_box(
    name: str,
    size: tuple[float, float, float],
    mat: str,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
):
    """A box in the RIGRUNNER finish: real-size, palette material, chunky bevel + smooth.

    `size` is (x, y, z) in metres; `location` is the centre in metres.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    # primitive_cube_add(size=1.0) is a 1 m cube, so scale by `size` to land on `size` metres.
    # (Was size/2, which silently halved every box — assets rendered at half their stated metres.)
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material(mat))
    apply_style(obj)
    return obj


def beveled_cylinder(
    name: str,
    radius: float,
    depth: float,
    mat: str,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    verts: int = 16,
):
    """A cylinder in the RIGRUNNER finish: palette material, chunky bevel + smooth, low-poly.

    The axle runs along Z by default; set the returned object's `rotation_euler` to lean/lay it,
    then `join` bakes that rotation in (same pattern as `beveled_box`). A low vertex count is
    deliberate — the facets catch light so a round form still reads as faceted scrap, not plastic.
    `radius`/`depth` are metres; `location` is the centre in metres.
    """
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material(mat))
    apply_style(obj)
    return obj


def apply_style(obj) -> None:
    """The uniform finish: smooth shade, weighted normals, a small catch-light bevel.

    Modifiers are left unbaked here; `export_glb(apply_modifiers=True)` bakes them on the
    way out so the source stays editable but the GLB is final.
    """
    for poly in obj.data.polygons:
        poly.use_smooth = True

    if "RR_bevel" not in obj.modifiers:
        bevel = obj.modifiers.new("RR_bevel", "BEVEL")
        bevel.width = 0.03 * UNIT
        bevel.segments = 2
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = 0.785398  # 45°
    if "RR_wn" not in obj.modifiers:
        obj.modifiers.new("RR_wn", "WEIGHTED_NORMAL")


def join(objects, name: str):
    """Join several objects into one, named `name`. Returns the merged object."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    merged = bpy.context.active_object
    merged.name = name
    return merged


# --------------------------------------------------------------------------------------
# Articulation  (multi-node, animatable assets — see docs/asset-style.md "Articulated assets")
# --------------------------------------------------------------------------------------
# Most assets are one static GLB. An *articulated* asset (e.g. the Reclaimer arm) is instead
# a parented hierarchy of named nodes the GAME/VIEWER rotates at runtime. The convention:
#   * `joint_<name>` nodes are motion handles — the app rotates these about their origin.
#   * `socket_<name>` empties are attach points — the app parents a separate head GLB here.
#   * A node's ORIGIN is its pivot, so set each joint's origin to the axis it turns about.
# A module that builds one of these sets `ARTICULATED = True` so build_asset.py exports the
# scene hierarchy as-is (no single-object base-centre re-origin, which would flatten the rig).


def empty(name: str, location: tuple[float, float, float] = (0.0, 0.0, 0.0), size: float = 0.08):
    """A PLAIN_AXES empty at `location` — used for joints and attach sockets. Its location IS
    its pivot/origin, so no `set_origin` is needed. Exports to glTF as a transform-only node."""
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    e = bpy.context.active_object
    e.name = name
    e.empty_display_size = size
    return e


def set_origin(obj, location: tuple[float, float, float]) -> None:
    """Move a mesh object's origin (its pivot) to a world `location`, leaving the mesh in place.
    Rotating the object then turns its geometry about that point — how a joint hinges."""
    cursor = bpy.context.scene.cursor
    saved = tuple(cursor.location)
    cursor.location = location
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    cursor.location = saved


def parent_keep(child, parent) -> None:
    """Parent `child` under `parent` while preserving the child's current world transform, so
    the authored rest pose is unchanged. Build at rest pose, set origins, then chain with this."""
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


# --------------------------------------------------------------------------------------
# Orientation + origin conventions  (call ONCE, just before export)
# --------------------------------------------------------------------------------------

def set_origin_base_center(obj) -> None:
    """Move the object's origin to the centre of its footprint at its lowest point, then
    sit it on the ground (Blender Z=0). After +Y-up export the asset rests on y=0 in-game.
    """
    bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_z = min(v.z for v in bbox)
    cx = sum(v.x for v in bbox) / 8.0
    cy = sum(v.y for v in bbox) / 8.0

    cursor = bpy.context.scene.cursor
    saved = tuple(cursor.location)
    cursor.location = (cx, cy, min_z)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    cursor.location = saved

    obj.location = (0.0, 0.0, 0.0)


# --------------------------------------------------------------------------------------
# Export  (locked settings — do not vary per asset)
# --------------------------------------------------------------------------------------

def export_glb(filepath: str, apply_modifiers: bool = True) -> None:
    """Export the whole scene to a GLB with RIGRUNNER's locked settings.

    Y-up (three.js/glTF standard), modifiers baked, materials embedded, no cameras/lights.
    """
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_yup=True,
        export_apply=apply_modifiers,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        use_selection=False,
    )


def finalize_and_export(obj, filepath: str) -> None:
    """Convenience: apply origin/orientation conventions to `obj` then export the scene."""
    set_origin_base_center(obj)
    export_glb(filepath)
