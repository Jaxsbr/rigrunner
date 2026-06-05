"""
wheel-axle-sm — the 1×3 scout chassis's smaller WHEEL unit.

A scaled-down `wheel_axle` for the light 1×3 rig: a smaller radius gives the scout a lower overall stance
than the 3×5 hauler (which keeps the full-size `wheel_axle`). The 1×3 and 3×5 diverged enough that they no
longer share a wheel — each frame instances its own size. Same construction + conventions as the big wheel
(hub-origin so the render layer spins it in place, axle along +X, ARTICULATED, root named `wheel*`).
"""

import math

import rr_style as rr

ARTICULATED = True

WHEEL_R = 0.26       # smaller than the 3×5's 0.33 → a lower 1×3 deck
TREAD = 0.24         # tyre width along the X axle
HUB_W = TREAD + 0.08  # rust hub pokes out both tyre faces


def _cyl_x(name, radius, depth, mat, verts=16):
    """A cylinder laid along Blender +X (the axle/track), centred on the hub at the origin."""
    obj = rr.beveled_cylinder(name, radius, depth, mat, location=(0.0, 0.0, 0.0), verts=verts)
    obj.rotation_euler = (0.0, math.radians(90), 0.0)  # axle Z → X (baked on join)
    return obj


def build():
    parts = [
        _cyl_x("wheel_tyre", WHEEL_R, TREAD, "dark_metal", verts=16),
        _cyl_x("wheel_hub", 0.11, HUB_W, "rust", verts=10),
        # A hazard nub proud of the tread, off-centre, so the spin reads from the side.
        rr.beveled_box("wheel_nub", (0.07, 0.07, 0.08), "hazard_yellow", (0.0, WHEEL_R - 0.05, 0.0)),
    ]
    # Lug bolts: a ring on each hub face — high-contrast points so the rotation reads from either side.
    face_x = HUB_W / 2 + 0.02
    for fx in (face_x, -face_x):
        for k in range(5):
            a = math.radians(72 * k)
            parts.append(rr.beveled_box(
                "wheel_lug", (0.05, 0.04, 0.04), "dark_metal",
                (fx, 0.07 * math.cos(a), 0.07 * math.sin(a)),
            ))

    wheel = rr.join(parts, "wheel-axle")
    rr.set_origin(wheel, (0.0, 0.0, 0.0))  # hub pivot — aligns with the Frame's socket_axle_* + spins in place
    return wheel
