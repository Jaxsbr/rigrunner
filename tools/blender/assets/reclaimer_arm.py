"""
reclaimer-arm — the articulated manipulator arm that gates scrap-pile rummaging (Option C).

RIGRUNNER's FIRST articulated asset: instead of one static mesh it exports a parented chain of
named nodes the game/viewer rotate at runtime (see docs/asset-style.md "Articulated assets").

The motion rig (each `joint_*` origin sits on the axis it turns about):

    reclaimer-arm            root — the chassis mount (rig_blue, player-built). Origin = base-centre,
    │                              on the ground (y=0 in-game), like every other asset.
    └─ joint_yaw             turntable drum — swings the whole arm left/right (about vertical).
       └─ joint_boom         the boom — raises/lowers to reach down into a pile (about the X axis).
          └─ joint_wrist     the wrist hinge at the boom tip — curls the head to scoop (about X).
             └─ socket_wrist attach point: the separate `reclaimer-bucket` head parents here, so
                             the head inherits yaw + boom + curl and moves as one with the arm.

`socket_wrist` is the restoration upgrade axis made literal: today the unearthing bucket attaches
here; a future tiller/seeder head is the same attach, a different GLB.

A "Small part" on the size ladder (docs/asset-style.md): ~0.6 m mount footprint, reaching ~1.2 m
forward — sized to bolt onto the 2×3-cell rig. Authored front-toward +Y (forward) by convention.

ARTICULATED: build_asset.py exports the scene hierarchy as-is (no single-object re-origin).
"""

import rr_style as rr

ARTICULATED = True

# Key heights/reach (metres), authored in the rest pose (boom horizontal, forward = +Y).
BASE_TOP = 0.30      # top of the chassis mount; the yaw turntable spins here
SHOULDER_Z = 0.50    # the boom's hinge height (just above the turntable)
WRIST_Y = 1.18       # how far forward the boom tip / wrist reaches
SHOULDER = (0.0, 0.0, SHOULDER_Z)
WRIST = (0.0, WRIST_Y, SHOULDER_Z)


def _base():
    """The chassis mount: a chunky rig_blue block (a player-built part) with a dark collar the
    turntable sits in. One joined mesh; its origin is dropped to base-centre on the ground."""
    block = rr.beveled_box("mount_block", size=(0.62, 0.70, 0.26), mat="rig_blue", location=(0.0, 0.0, 0.13))
    collar = rr.beveled_box("mount_collar", size=(0.44, 0.44, 0.10), mat="dark_metal", location=(0.0, 0.0, 0.30))
    base = rr.join([block, collar], "reclaimer-arm")
    rr.set_origin(base, (0.0, 0.0, 0.0))  # base-centre, on the ground — the in-game origin convention
    return base


def _yaw():
    """The turntable drum that swings the arm. Origin at the base-top centre so it spins flat."""
    drum = rr.beveled_box("yaw_drum", size=(0.40, 0.40, 0.16), mat="dark_metal", location=(0.0, 0.0, BASE_TOP + 0.08))
    post = rr.beveled_box("yaw_post", size=(0.20, 0.20, 0.14), mat="rig_blue", location=(0.0, 0.0, BASE_TOP + 0.20))
    yaw = rr.join([drum, post], "joint_yaw")
    rr.set_origin(yaw, (0.0, 0.0, BASE_TOP))
    return yaw


def _boom():
    """The boom arm reaching forward from the shoulder, with a hydraulic line + hazard band for
    read. Origin at the shoulder hinge so raising/lowering pivots there."""
    arm = rr.beveled_box("boom_arm", size=(0.16, WRIST_Y, 0.16), mat="scrap_grey", location=(0.0, WRIST_Y / 2.0, SHOULDER_Z))
    ram = rr.beveled_box("boom_ram", size=(0.08, 0.70, 0.08), mat="dark_metal", location=(0.0, 0.42, SHOULDER_Z + 0.13))
    band = rr.beveled_box("boom_band", size=(0.18, 0.10, 0.18), mat="hazard_yellow", location=(0.0, 0.18, SHOULDER_Z))
    knuckle = rr.beveled_box("boom_knuckle", size=(0.20, 0.16, 0.20), mat="dark_metal", location=(0.0, WRIST_Y, SHOULDER_Z))
    boom = rr.join([arm, ram, band, knuckle], "joint_boom")
    rr.set_origin(boom, SHOULDER)
    return boom


def build():
    base = _base()
    yaw = _yaw()
    boom = _boom()
    wrist = rr.empty("joint_wrist", WRIST)          # the curl hinge at the boom tip
    socket = rr.empty("socket_wrist", WRIST)        # where the bucket head attaches

    rr.parent_keep(yaw, base)
    rr.parent_keep(boom, yaw)
    rr.parent_keep(wrist, boom)
    rr.parent_keep(socket, wrist)
    return base
