"""
weapon-gun — the mountable auto-fire weapon (looter camps). A single buildable part the player buys,
builds, and mounts like the Reclaimer; it auto-fires at any enemy inside its forward cone + range.

Authored as an ARTICULATED asset for ONE reason: the render layer swivels the `barrel` node to track
the target it's firing on (`@features/camps/weapon-animator`). So the model is a static rig_blue mount
+ turret with a `barrel` empty whose children (the cannon + muzzle) sweep when that node rotates.

    weapon-gun        root — the rig_blue chassis mount + dark turret drum. Origin = base-centre, on
    │                        the ground (y=0 in-game), like every asset.
    └─ barrel         the swivel node at the turret top — the animator yaws this to aim; the cannon
                      barrel + hazard muzzle parent here and sweep with it.

A "Small part" on the size ladder (docs/asset-style.md): ~0.55 m mount footprint, a barrel reaching
~0.6 m forward — sized to bolt onto one rig deck cell. Authored front-toward +Y (forward) by
convention, so the barrel rests pointing down the part's mount facing.

ARTICULATED: build_asset.py exports the scene hierarchy as-is (the `barrel` node must survive).
"""

import math

import bpy  # type: ignore

import rr_style as rr

ARTICULATED = True

PIVOT_Z = 0.34  # the barrel swivel height — the turret top


def _body():
    """The rig_blue chassis mount (a player-built part) topped by a dark turret drum the barrel
    swivels on. One joined mesh; origin dropped to base-centre on the ground."""
    mount = rr.beveled_box("mount", size=(0.55, 0.50, 0.22), mat="rig_blue", location=(0.0, 0.0, 0.11))
    drum = rr.beveled_box("turret", size=(0.34, 0.34, 0.12), mat="dark_metal", location=(0.0, 0.0, 0.28))
    body = rr.join([mount, drum], "weapon-gun")
    rr.set_origin(body, (0.0, 0.0, 0.0))
    return body


def _barrel_cannon():
    """The cannon barrel: a scrap_grey cylinder laid forward (+Y), baked so its local axes are clean
    for the swivel node to parent and rotate."""
    cyl = rr.beveled_cylinder("barrel_cannon", radius=0.06, depth=0.55, mat="scrap_grey", location=(0.0, 0.0, 0.0))
    cyl.rotation_euler = (math.radians(-90.0), 0.0, 0.0)  # Z-axis cylinder → points +Y (forward)
    bpy.ops.object.select_all(action="DESELECT")
    cyl.select_set(True)
    bpy.context.view_layer.objects.active = cyl
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cyl.location = (0.0, 0.30, PIVOT_Z)  # extend forward of the pivot
    return cyl


def build():
    body = _body()
    cannon = _barrel_cannon()
    muzzle = rr.beveled_box("muzzle", size=(0.12, 0.10, 0.12), mat="hazard_yellow", location=(0.0, 0.58, PIVOT_Z))
    barrel = rr.empty("barrel", (0.0, 0.0, PIVOT_Z))  # the swivel node the animator yaws

    rr.parent_keep(barrel, body)
    rr.parent_keep(cannon, barrel)
    rr.parent_keep(muzzle, barrel)
    return body
