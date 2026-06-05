"""
frame-3x5 — the heavy hauler chassis FRAME: a 3×5-cell rig_blue mounting deck with 4 axle rows (8 wheel
corners). The host the 3×5 rig composes onto — a much wider track than the scout, set by this frame's
own corner positions (the single shared Wheel unit fits both by construction).

A 3 m × 5 m footprint — a much bigger silhouette than the scout. Built from
frame_common.build_frame, which owns the shared frame construction + the corner-socket convention.
"""

from assets.frame_common import build_frame


def build():
    return build_frame(width=3.0, length=5.0, cols=3, rows=5, axle_ys=(-1.8, -0.6, 0.6, 1.8))
