"""
engine-mk2 — the tier-2 powerplant. Faster and stronger than Mk1, and visibly so.

Same 1×1×1 grid-cell footprint and same FRONT/forward convention as Mk1 (engine_mk1.py — read it
for the orientation contract), but deliberately MORE ILLUMINATED so it reads at a glance as the
special, higher-output engine: a bigger glowing intake, a glowing crown ring on the head, glowing
side vents down both flanks, and glow_green exhaust tips instead of rust caps. The extra glow is
pure visual language for "this one is stronger" — its actual performance lives in its EngineSpec
(content/engines.ts), not in the model.

Footprint stays within x∈[−0.5,0.5], y∈[−0.5,0.5], z∈[0,1].
"""

import rr_style as rr


# (name, size (x,y,z) m, palette, location centre (x,y,z) m)
_CHUNKS = [
    # Main mass + valve head — same bulk as Mk1.
    ("block", (0.88, 0.84, 0.62), "dark_metal", (0.00, 0.00, 0.31)),
    ("head", (0.74, 0.74, 0.14), "scrap_grey", (0.00, 0.00, 0.69)),
    # Glowing crown — a thin glow ring sitting on top of the head: the unmistakable Mk2 tell.
    ("crown", (0.60, 0.60, 0.06), "glow_green", (0.00, 0.00, 0.79)),

    # Powered core — a TALLER, wider glow panel on the FRONT face than Mk1's.
    ("core", (0.56, 0.10, 0.46), "glow_green", (0.00, 0.41, 0.40)),
    ("trim_top", (0.66, 0.08, 0.07), "hazard_yellow", (0.00, 0.44, 0.66)),
    ("trim_bot", (0.66, 0.08, 0.07), "hazard_yellow", (0.00, 0.44, 0.14)),

    # Glowing side vents down both flanks — extra illumination Mk1 doesn't have.
    ("vent_l", (0.07, 0.46, 0.34), "glow_green", (-0.44, 0.00, 0.40)),
    ("vent_r", (0.07, 0.46, 0.34), "glow_green", (0.44, 0.00, 0.40)),

    # Exhaust stacks on the BACK face — with hazard_yellow tips. (Not glow_green: sitting right by
    # the glowing crown, green tips washed together with it; gold reads as a clear, separate detail.)
    ("exhaust_l", (0.16, 0.16, 0.50), "dark_metal", (-0.22, -0.34, 0.58)),
    ("exhaust_r", (0.16, 0.16, 0.50), "dark_metal", (0.22, -0.34, 0.58)),
    ("tip_l", (0.20, 0.20, 0.10), "hazard_yellow", (-0.22, -0.34, 0.86)),
    ("tip_r", (0.20, 0.20, 0.10), "hazard_yellow", (0.22, -0.34, 0.86)),
]


def build():
    parts = [rr.beveled_box(name, size=size, mat=mat, location=loc) for name, size, mat, loc in _CHUNKS]
    return rr.join(parts, "engine-mk2")
