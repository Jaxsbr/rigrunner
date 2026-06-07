"""
disarm-head — the trap arm's HEAD sub-part (looter camps Phase 2): the disarm tool that seats on the Boom.

A compact lockpick/probe head — a dark housing with a cluster of fine scrap_grey prongs and a glow_green
pick tip (the "active" business end). It reads as delicate trap-defusing tooling, deliberately NOT a
digger bucket (a clearly different silhouette from reclaimer-bucket). Swapping this part for another head
= a different disarm tool on the same Boom.

Its ORIGIN is the REAR attach point (not the base-centre) — so when the assembler snaps it onto the
Boom's `socket_head` at the arm tip, it extends FORWARD (+Y) from there and the render layer can rock it
about that rear point. Authored pointing forward (+Y → −Z in-game).

ARTICULATED so build_asset.py exports it as-is and preserves that custom rear origin (the base-centre
re-origin would move the pivot to the head's middle). The weapon-barrel pattern.
"""

import rr_style as rr

ARTICULATED = True  # custom rear-pivot origin — skip the base-centre re-origin


def build():
    # Housing: a dark block just forward of the rear pivot — the body that clamps to the arm tip.
    housing = rr.beveled_box("head_housing", size=(0.16, 0.18, 0.16), mat="dark_metal", location=(0.0, 0.10, 0.0))

    # Fine probes — a three-prong cluster reaching forward (the tools that work the lock).
    prong_l = rr.beveled_box("head_prong_l", size=(0.03, 0.22, 0.03), mat="scrap_grey", location=(-0.05, 0.30, 0.03))
    prong_r = rr.beveled_box("head_prong_r", size=(0.03, 0.22, 0.03), mat="scrap_grey", location=(0.05, 0.30, 0.03))
    prong_c = rr.beveled_box("head_prong_c", size=(0.03, 0.26, 0.03), mat="scrap_grey", location=(0.0, 0.32, -0.03))

    # The active pick tip — a glow_green nub that reads as the working end.
    tip = rr.beveled_box("head_tip", size=(0.05, 0.06, 0.05), mat="glow_green", location=(0.0, 0.46, -0.03))

    head = rr.join([housing, prong_l, prong_r, prong_c, tip], "disarm-head")
    rr.set_origin(head, (0.0, 0.0, 0.0))  # rear pivot at the origin — the point the Boom socket holds
    return head
