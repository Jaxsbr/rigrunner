"""
chassis-1x3 — the light scout foundation: a 1×3-cell rig_blue mounting deck on a low drive-train
with 6 wheels (3 axles). The starter chassis, replacing the deprecated 2×3 rig.

A 1 m × 3 m footprint anchored on the size ladder (docs/asset-style.md). Built from
chassis_common.build_chassis, which owns the shared chassis construction + conventions.
"""

from assets.chassis_common import build_chassis


def build():
    return build_chassis(width=1.0, length=3.0, cols=1, rows=3, axle_ys=(-1.0, 0.0, 1.0))
