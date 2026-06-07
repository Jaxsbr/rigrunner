"""
trap-boom — the trap arm's BASE sub-part AND the trap arm's assembly HOST (looter camps Phase 2).

The directional arm that bolts onto a rig deck cell and carries the disarm head out front. It is the
assembly HOST: its GLB carries a `socket_head` empty at the arm TIP, and the shared assembler seats the
partner `disarm-head` there (each at its own tier). The render layer rocks that socket node so the head
idles/probes (`@features/camps/trap-arm-animator`). This piece is the arm WITHOUT the head.

Read as PRECISE tooling — a slim manipulator boom, distinct from the Reclaimer's chunky dig arm: a
rig_blue chassis mount, a scrap_grey boom with a dark_metal strut + a hazard_yellow read band, ending in
a fine wrist knuckle. Authored front-toward +Y (forward) by convention (→ −Z in-game), so the mounted
arm reaches off the deck like the Reclaimer it mirrors.

ARTICULATED: build_asset.py exports the scene hierarchy as-is (no single-object re-origin), so the
parented boom + the `socket_head` empty survive with their authored positions (the reclaimer-arm pattern).
"""

import rr_style as rr

ARTICULATED = True

SHOULDER_Z = 0.42  # the boom height — it reaches forward at this height off the deck
WRIST_Y = 0.86     # how far forward the boom tip / wrist reaches
SOCKET = (0.0, 0.92, SHOULDER_Z)  # the arm tip — where the Disarm Head seats and the animator rocks


def _base():
    """The chassis mount: a rig_blue player-built block with a dark collar. One joined mesh, its origin
    dropped to base-centre on the ground (the in-game mount origin convention)."""
    block = rr.beveled_box("mount_block", size=(0.55, 0.55, 0.24), mat="rig_blue", location=(0.0, 0.0, 0.12))
    collar = rr.beveled_box("mount_collar", size=(0.34, 0.34, 0.12), mat="dark_metal", location=(0.0, 0.0, 0.28))
    base = rr.join([block, collar], "trap-boom")
    rr.set_origin(base, (0.0, 0.0, 0.0))
    return base


def _boom():
    """The slim manipulator boom reaching forward, with a support strut, a hazard read band, and a fine
    wrist knuckle at the tip — the precise-tooling silhouette (no scoop shoulder)."""
    arm = rr.beveled_box("boom_arm", size=(0.12, 0.80, 0.12), mat="scrap_grey", location=(0.0, 0.46, SHOULDER_Z))
    strut = rr.beveled_box("boom_strut", size=(0.07, 0.50, 0.07), mat="dark_metal", location=(0.0, 0.28, SHOULDER_Z + 0.12))
    band = rr.beveled_box("boom_band", size=(0.15, 0.10, 0.15), mat="hazard_yellow", location=(0.0, 0.14, SHOULDER_Z))
    knuckle = rr.beveled_box("boom_knuckle", size=(0.16, 0.14, 0.16), mat="dark_metal", location=(0.0, WRIST_Y, SHOULDER_Z))
    return rr.join([arm, strut, band, knuckle], "boom")


def build():
    base = _base()
    boom = _boom()
    socket = rr.empty("socket_head", SOCKET)  # where the Disarm Head attaches; the animator rocks it

    rr.parent_keep(boom, base)
    rr.parent_keep(socket, boom)
    return base
