"""
tent — the looter camp's shelter (part of the level-1 camp silhouette). A simple canvas teepee in
bone_white with a dark entrance flap and a rust ground tarp, so the camp reads as a lived-in scrap
hideout. Front-toward +Y (the entrance faces forward).

A static single-mesh prop (~2.2 m footprint). World decoration, not a part — no tier, no collider.
"""

import bpy  # type: ignore

import rr_style as rr


def _cone(name: str, radius: float, depth: float, mat: str, z: float):
    """A faceted cone (the teepee body) — a primitive the style kit has no dedicated builder for, so
    add it directly, then apply the shared finish/material like any other piece."""
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=radius, radius2=0.0, depth=depth, location=(0.0, 0.0, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(rr.material(mat))
    rr.apply_style(obj)
    return obj


def build():
    tarp = rr.beveled_box("tent_tarp", size=(2.1, 2.1, 0.08), mat="rust", location=(0.0, 0.0, 0.04))
    canvas = _cone("tent_canvas", radius=1.05, depth=1.7, mat="bone_white", z=0.85)
    flap = rr.beveled_box("tent_flap", size=(0.42, 0.10, 0.80), mat="dark_metal", location=(0.0, 0.92, 0.40))
    return rr.join([tarp, canvas, flap], "tent")
