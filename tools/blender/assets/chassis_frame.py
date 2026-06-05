"""
chassis-frame — the chassis's FRAME sub-part (the structural ladder / load-bearing piece).

A "Small part" on the size ladder (docs/asset-style.md): a low, flat ladder frame, ~1.0 m wide ×
~1.8 m long × ~0.24 m tall. The read is the structural backbone — two dark side rails joined by cross
members, with rig_blue mounting pads at the corners (the signature "deck builds onto this" cue) and a
hazard_yellow front marker. It's the chassis sub-part that sets load capacity. Shared by both chassis
sizes (the spec's "three models, scaled per size" default — the whole chassis still renders as its own
GLB until Phase 2b composes products from sub-parts).

Length runs along Blender +Y (→ −Z after export), so the frame points forward like the assembled rig.
A side rail is the first chunk (axis-aligned) so the merged transform stays clean; everything is
axis-aligned, joined under the rail's single bevel.
"""

import rr_style as rr

WIDTH = 1.00
LENGTH = 1.80
RAIL_T = 0.12
RAIL_H = 0.18
HALF_W = WIDTH / 2
HALF_L = LENGTH / 2


def build():
    parts = [
        # Side rails — the two dark longerons running the frame's length (the left rail is the first
        # chunk; its bevel rounds the whole join).
        rr.beveled_box("rail_l", (RAIL_T, LENGTH, RAIL_H), "dark_metal", (-(HALF_W - RAIL_T / 2), 0.0, RAIL_H / 2)),
        rr.beveled_box("rail_r", (RAIL_T, LENGTH, RAIL_H), "dark_metal", (HALF_W - RAIL_T / 2, 0.0, RAIL_H / 2)),
    ]
    # Cross members — dark rungs tying the rails into a ladder, at even spacing.
    span_x = WIDTH - RAIL_T
    for i, y in enumerate((-0.80, -0.27, 0.27, 0.80)):
        parts.append(rr.beveled_box(f"cross_{i}", (span_x, 0.12, 0.14), "scrap_grey", (0.0, y, 0.07)))
    # Mounting pads — rig_blue blocks at the four corners: the signature surface the deck builds onto.
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(
                f"pad_{sx}_{sy}", (0.22, 0.22, 0.07), "rig_blue", (sx * (HALF_W - 0.16), sy * (HALF_L - 0.16), RAIL_H + 0.02)))
    # Front marker — a hazard_yellow nub at the leading edge, so forward reads at a glance.
    parts.append(rr.beveled_box("marker", (0.30, 0.10, 0.10), "hazard_yellow", (0.0, HALF_L - 0.06, RAIL_H + 0.02)))
    return rr.join(parts, "chassis-frame")
