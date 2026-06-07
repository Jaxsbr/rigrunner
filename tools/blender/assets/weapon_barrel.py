"""
weapon-barrel — the weapon's BARREL sub-part (looter camps): the cannon that seats on the Mount.

A scrap_grey cannon with a hazard-yellow muzzle, authored pointing forward (+Y). Its ORIGIN is the
REAR pivot, not the base-centre — so when the assembler snaps it onto the Mount's `socket_barrel` at the
turret pivot, it extends forward from there and the render layer can swivel it about that rear point
like a real turret barrel. (Swapping this part for another barrel = a different weapon on the same Mount.)

ARTICULATED so build_asset.py exports it as-is and preserves that custom rear origin (the base-centre
re-origin would move the pivot to the barrel's middle).
"""

import math

import bpy  # type: ignore

import rr_style as rr

ARTICULATED = True  # custom rear-pivot origin — skip the base-centre re-origin


def build():
    # Cannon: a cylinder laid along +Y (Blender Z-axis cylinder rotated −90° about X), centred forward
    # of the pivot, the rotation baked so its local axes are clean.
    cannon = rr.beveled_cylinder("barrel_cannon", radius=0.06, depth=0.55, mat="scrap_grey", location=(0.0, 0.275, 0.0))
    cannon.rotation_euler = (math.radians(-90.0), 0.0, 0.0)
    bpy.ops.object.select_all(action="DESELECT")
    cannon.select_set(True)
    bpy.context.view_layer.objects.active = cannon
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    muzzle = rr.beveled_box("barrel_muzzle", size=(0.12, 0.10, 0.12), mat="hazard_yellow", location=(0.0, 0.58, 0.0))

    barrel = rr.join([cannon, muzzle], "weapon-barrel")
    rr.set_origin(barrel, (0.0, 0.0, 0.0))  # rear pivot at the origin — the point the Mount socket holds
    return barrel
