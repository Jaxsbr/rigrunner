"""
reclaimer-bucket — the unearthing bucket: the digging HEAD that slots onto the Reclaimer arm.

A separate GLB (not part of the arm mesh) so the head is swappable — the restoration upgrade axis
made literal: this scoop today, a future tiller/seeder head tomorrow, both onto the same socket.

Its ORIGIN is the attach pivot (0,0,0) — the point that meets the arm's `socket_wrist` — NOT the
usual base-centre, because this asset hangs off a hinge rather than resting on the ground. The
scoop body opens forward (+Y) and down (−Z) from that pivot, so when the wrist curls it bites the
ground. Authored front-toward +Y like every other asset.

ARTICULATED: keeps its attach-pivot origin (no base-centre re-origin from build_asset.py).
"""

import rr_style as rr

ARTICULATED = True

W = 0.46          # bucket width (x)
DEPTH = 0.36      # how far the scoop reaches forward (y)
DROP = 0.34       # how far the scoop hangs below the pivot (z)
WALL = 0.05


def build():
    # Back plate at the pivot, dropping down; the scoop mouth faces forward + down from here.
    back = rr.beveled_box("bk_back", size=(W, WALL, DROP), mat="dark_metal", location=(0.0, 0.0, -DROP / 2.0))
    floor = rr.beveled_box("bk_floor", size=(W, DEPTH, WALL), mat="scrap_grey", location=(0.0, DEPTH / 2.0, -DROP + WALL / 2.0))
    left = rr.beveled_box("bk_left", size=(WALL, DEPTH, DROP * 0.8), mat="scrap_grey", location=(-(W - WALL) / 2.0, DEPTH / 2.0, -DROP * 0.6))
    right = rr.beveled_box("bk_right", size=(WALL, DEPTH, DROP * 0.8), mat="scrap_grey", location=((W - WALL) / 2.0, DEPTH / 2.0, -DROP * 0.6))
    # Toothed cutting lip along the leading edge — hazard-yellow so the business end reads.
    lip = rr.beveled_box("bk_lip", size=(W, 0.06, 0.10), mat="hazard_yellow", location=(0.0, DEPTH, -DROP + 0.05))

    bucket = rr.join([back, floor, left, right, lip], "reclaimer-bucket")
    rr.set_origin(bucket, (0.0, 0.0, 0.0))  # the attach pivot — aligns with the arm's socket_wrist
    return bucket
