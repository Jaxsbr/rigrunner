"""
weapon-mount — the weapon's BASE sub-part AND the weapon's assembly HOST (looter camps).

A "Small part" (docs/asset-style.md): a 1-cell rig_blue chassis mount topped by a dark turret drum —
the directional base the gun sits on. It is the assembly HOST: its GLB carries a `socket_barrel` empty
at the turret pivot, and the shared assembler seats the partner `weapon-barrel` there (each at its own
tier). The render layer SWIVELS that socket node so the barrel tracks its target (`@features/camps/
weapon-animator`). This piece is the mount WITHOUT the barrel.

Authored front-toward +Y (forward) by convention, so the mounted weapon's facing IS its fire cone. The
body bottoms at Z=0 so the base-centre re-origin is a no-op and the top-level `socket_barrel` empty
keeps its authored position (the `container-shell` host pattern).
"""

import rr_style as rr

PIVOT_Z = 0.34  # the barrel swivel height — the turret top, where socket_barrel sits


def build():
    base = rr.beveled_box("mount_base", size=(0.55, 0.50, 0.22), mat="rig_blue", location=(0.0, 0.0, 0.11))
    drum = rr.beveled_box("mount_drum", size=(0.34, 0.34, 0.12), mat="dark_metal", location=(0.0, 0.0, 0.28))
    body = rr.join([base, drum], "weapon-mount")

    # Assembly socket — the turret pivot the Barrel's rear seats on (its origin snaps here at runtime,
    # and the animator rotates this node to swivel the barrel). The base bottoms at Z=0, so the
    # base-centre re-origin is a no-op and this top-level sibling empty keeps its authored position.
    rr.empty("socket_barrel", (0.0, 0.0, PIVOT_Z))
    return body
