"""
frame-3x5 — the heavy hauler chassis FRAME: a 3×5-cell rig_blue mounting deck with 4 axle rows (8 wheel
corners). The host the 3×5 rig composes onto — a much wider track than the scout, set by this frame's
own corner positions (the single shared Wheel unit fits both by construction).

A 3 m × 5 m footprint — a much bigger silhouette than the scout. Built from
frame_common.build_frame, which owns the shared frame construction + the corner-socket convention.
"""

from assets.frame_common import build_frame

# The frame floats with ground clearance, so it's exported as-authored — no base-centre re-origin (which
# would drop it to the floor). See frame_common's docstring.
ARTICULATED = True


def build():
    # The hauler keeps the full-size wheel (wheel-axle, r=0.33) → the taller deck (deckY 0.84).
    return build_frame(width=3.0, length=5.0, cols=3, rows=5, axle_ys=(-1.8, -0.6, 0.6, 1.8), wheel_r=0.33, tread=0.28)
