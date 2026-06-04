"""
chassis-3x5 — the heavy hauler foundation: a 3×5-cell rig_blue mounting deck on a low drive-train
with 8 wheels (4 axles). The larger chassis (3–6 engines), built from the same kit as the 1×3 scout.

A 3 m × 5 m footprint — a much bigger silhouette than the scout. Built from
chassis_common.build_chassis, which owns the shared chassis construction + conventions.
"""

from assets.chassis_common import build_chassis


def build():
    return build_chassis(width=3.0, length=5.0, cols=3, rows=5, axle_ys=(-1.8, -0.6, 0.6, 1.8))
