"""
enemy — a looter-camp guard bot. A squat, hostile little turret-walker that rings a camp and fires on
the rig. Authored in RUST + dark metal with a hazard-yellow sensor eye so it reads instantly as a
THREAT, distinct from the rig_blue player-built parts. Front-toward +Y (its stub cannon + eye face
forward), so a spawned guard looks where it watches.

A static single-mesh prop (~0.9 m footprint, ~1.2 m tall — it fills the grey-box stand-in it replaces).
"""

import math

import bpy  # type: ignore

import rr_style as rr


def build():
    base = rr.beveled_box("enemy_base", size=(0.72, 0.62, 0.40), mat="dark_metal", location=(0.0, 0.0, 0.20))
    torso = rr.beveled_box("enemy_torso", size=(0.60, 0.50, 0.58), mat="rust", location=(0.0, 0.0, 0.69))
    eye = rr.beveled_box("enemy_eye", size=(0.30, 0.16, 0.22), mat="hazard_yellow", location=(0.0, 0.26, 0.86))
    head = rr.beveled_box("enemy_head", size=(0.34, 0.34, 0.20), mat="dark_metal", location=(0.0, 0.0, 1.04))

    # A stub cannon poking forward (+Y) — the muzzle the guard fires from.
    cannon = rr.beveled_cylinder("enemy_cannon", radius=0.06, depth=0.46, mat="scrap_grey", location=(0.0, 0.0, 0.0))
    cannon.rotation_euler = (math.radians(-90.0), 0.0, 0.0)
    bpy.ops.object.select_all(action="DESELECT")
    cannon.select_set(True)
    bpy.context.view_layer.objects.active = cannon
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cannon.location = (0.0, 0.45, 0.70)

    return rr.join([base, torso, eye, head, cannon], "enemy")
