"""
frame-1x3 — the light scout chassis FRAME: a 1×3-cell rig_blue mounting deck with 3 axle rows (6 wheel
corners). The host the 1×3 rig composes onto — the starter chassis's structural sub-part.

A 1 m × 3 m footprint anchored on the size ladder (docs/asset-style.md). Built from
frame_common.build_frame, which owns the shared frame construction + the corner-socket convention.
"""

from assets.frame_common import build_frame

# The frame floats with ground clearance, so it's exported as-authored — no base-centre re-origin (which
# would drop it to the floor). See frame_common's docstring.
ARTICULATED = True


def build():
    # The scout's smaller wheel (wheel-axle-sm, r=0.26) → a lower deck (deckY 0.70) than the 3×5 hauler.
    return build_frame(width=1.0, length=3.0, cols=1, rows=3, axle_ys=(-1.0, 0.0, 1.0), wheel_r=0.26, tread=0.24)
