"""
chassis-kit — the packed / flat-pack form of a chassis as it sits on the workshop deck before the
player hauls it out and it assembles into a drivable rig. A scrap-metal crate that fills the 2×2
deck block (~1.6 m square body), braced with dark-metal corner posts + a lid rim, wearing a rig_blue
placard (the player-built signature), with chassis parts poking out — a wheel half-buried in each
side and a couple of frame rails jutting from the top — so it reads as "a chassis in a box".

Deliberately a CRATE, not a vehicle: low, boxy, and STATIC — one joined object, with no separate
spinnable wheel nodes (unlike the unfolded chassis-1x3 / chassis-3x5 GLBs). The front faces Blender
+Y per the orientation contract; both chassis sizes pack into this same 2×2 kit.
"""

import math

import bpy  # type: ignore  # Blender runtime
import rr_style as rr

CRATE_W = 1.6       # crate body footprint (X and Y), in metres — fills the 2×2 deck block
CRATE_H = 0.80      # crate body height — low enough to read as a crate, not a vehicle
HALF = CRATE_W / 2
WHEEL_R = 0.33      # matches the chassis wheels, so the poking-out wheel reads as the same part


def _wheel_stub(name, center):
    """A simple wheel/axle stub — a dark_metal tyre + a proud rust hub, axle along X — to poke out a
    crate side. Built axle-along-Z then turned to X; returned as a list for joining into the static
    crate (no in-place-spin origin, unlike the chassis wheels)."""
    tyre = rr.beveled_cylinder(f"{name}_tyre", WHEEL_R, 0.28, "dark_metal", center, verts=14)
    hub = rr.beveled_cylinder(f"{name}_hub", 0.13, 0.40, "rust", center, verts=8)
    for part in (tyre, hub):
        part.rotation_euler = (0.0, math.radians(90), 0.0)  # axle Z → X (baked on join)
    return [tyre, hub]


def build():
    parts = []

    # The crate body — the scrap-metal box. Lowest point at Z=0 so the kit rests on the deck.
    parts.append(rr.beveled_box("crate", (CRATE_W, CRATE_W, CRATE_H), "scrap_grey", (0.0, 0.0, CRATE_H / 2)))

    # Dark-metal bracing: corner posts (down to the ground, proud of the lid) + a lid rim, so it reads
    # as a braced shipping crate rather than a plain cube.
    post = 0.15
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(
                f"post_{sx}_{sy}", (post, post, CRATE_H + 0.06), "dark_metal",
                (sx * (HALF - post / 2), sy * (HALF - post / 2), (CRATE_H + 0.06) / 2),
            ))
    parts.append(rr.beveled_box("lid", (CRATE_W + 0.08, CRATE_W + 0.08, 0.10), "dark_metal", (0.0, 0.0, CRATE_H)))

    # rig_blue — the player-built signature, the same blue as the deck: a placard on the front (+Y)
    # face for side-on views, and a band running front-to-back across the lid so the signature also
    # reads from the workshop's top-down deck view.
    parts.append(rr.beveled_box("placard", (0.7, 0.06, 0.34), "rig_blue", (0.0, HALF + 0.02, CRATE_H * 0.55)))
    parts.append(rr.beveled_box("band", (0.42, CRATE_W + 0.06, 0.07), "rig_blue", (0.0, 0.0, CRATE_H + 0.07)))

    # Chassis parts poking out — a wheel half-buried in each side, toward the back...
    parts += _wheel_stub("wheel_l", (-HALF, -0.35, WHEEL_R))
    parts += _wheel_stub("wheel_r", (HALF, -0.35, WHEEL_R))

    # ...and a pair of frame rails jutting up out of the top at a careless lean (lower half embedded
    # in the crate, upper half proud).
    rail_l = rr.beveled_box("rail_l", (0.14, 0.14, 1.0), "dark_metal", (-0.28, 0.30, CRATE_H + 0.30))
    rail_l.rotation_euler = (math.radians(-14), 0.0, math.radians(6))
    parts.append(rail_l)
    rail_r = rr.beveled_box("rail_r", (0.12, 0.12, 0.78), "dark_metal", (0.22, 0.46, CRATE_H + 0.18))
    rail_r.rotation_euler = (math.radians(-22), 0.0, math.radians(-8))
    parts.append(rail_r)

    return rr.join(parts, "chassis-kit")
