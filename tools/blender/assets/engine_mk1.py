"""
engine-mk1 — the basic, tier-1 powerplant. Slow and weak: the starter engine.

A "Small" part on the size ladder (docs/asset-style.md): a 1×1×1 grid cell — a chunky
single-cell block that drops into one cell of the rig's 2×3 deck. An engine makes the rig
drivable and its attributes (see components/engine-spec.ts) set how fast and how hard it pulls;
Mk1 is the humble end of that range. Built as a heap of beveled boxes so it reads as a
self-contained motor block:

  * dark_metal main mass + scrap_grey valve head — the bulk.
  * a single glow_green core strip on the part's FRONT face — the "powered" energy read.
  * two exhaust stacks with rust caps on the BACK face, and hazard_yellow trim — junkyard motor.

FRONT = the part's local −Z, authored as Blender +Y (→ −Z after the Y-up export). This is the one
"forward" convention used everywhere: the direction the game drives (systems/movement.ts), the
direction the viewer's green arrow points, and the part's decorated/meaningful face. The 'outward'
MountFacing rule (components/mount-facing.ts) aims this front away from the rig centre, so the
glowing intake points off the rig on whatever cell it lands; the exhausts on the back face inward.

Whole-cell footprint: everything stays within x∈[−0.5,0.5], y∈[−0.5,0.5], z∈[0,1] so the block
occupies exactly one 1 m grid cell. Mk2 (engine_mk2.py) shares this footprint but is visibly more
illuminated, to read as the stronger, more special engine.
"""

import rr_style as rr


# (name, size (x,y,z) m, palette, location centre (x,y,z) m)
_CHUNKS = [
    # Main mass — the engine block. Sits on the deck (z from 0), tops out below the head.
    ("block", (0.88, 0.84, 0.64), "dark_metal", (0.00, 0.00, 0.32)),
    # Valve head — a lighter cap so the block reads as a stacked motor, not a plain cube.
    ("head", (0.74, 0.74, 0.16), "scrap_grey", (0.00, 0.00, 0.72)),

    # Powered core — glow_green strip on the FRONT face (Blender +Y → local −Z): the "live" read
    # that the 'outward' facing rule aims off the rig, and where the viewer's forward arrow points.
    ("core", (0.52, 0.10, 0.34), "glow_green", (0.00, 0.41, 0.40)),
    # Hazard trim framing the core, top and bottom — junkyard warning paint.
    ("trim_top", (0.62, 0.08, 0.07), "hazard_yellow", (0.00, 0.44, 0.61)),
    ("trim_bot", (0.62, 0.08, 0.07), "hazard_yellow", (0.00, 0.44, 0.19)),

    # Exhaust stacks on the BACK face (Blender −Y → local +Z) — two pipes with rust caps poking up.
    ("exhaust_l", (0.15, 0.15, 0.52), "dark_metal", (-0.22, -0.34, 0.60)),
    ("exhaust_r", (0.15, 0.15, 0.52), "dark_metal", (0.22, -0.34, 0.60)),
    ("cap_l", (0.20, 0.20, 0.09), "rust", (-0.22, -0.34, 0.90)),
    ("cap_r", (0.20, 0.20, 0.09), "rust", (0.22, -0.34, 0.90)),

    # Side mount bosses — little dark nubs so the block looks bolted to its cell.
    ("boss_l", (0.10, 0.46, 0.20), "scrap_grey", (-0.45, 0.00, 0.26)),
    ("boss_r", (0.10, 0.46, 0.20), "scrap_grey", (0.45, 0.00, 0.26)),
]


def build():
    parts = [rr.beveled_box(name, size=size, mat=mat, location=loc) for name, size, mat, loc in _CHUNKS]
    return rr.join(parts, "engine-mk1")
