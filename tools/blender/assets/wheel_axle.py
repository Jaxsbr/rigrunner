"""
wheel-axle — the chassis's WHEEL unit (the drive contact / top-speed piece).

ONE wheel: a faceted dark tyre on a rust hub, with a ring of lug bolts on each face + a hazard nub so
its rotation reads unmistakably. The chassis Frame instances this single unit at every corner socket, so
one model fits both the 1 m scout and the 3 m hauler tracks — the Frame owns the spacing
(`docs/part-identity-spec.md` §2b "shared Wheel + Suspension, per-size Frames"). It is the chassis
sub-part that sets top speed.

Its ORIGIN is the HUB (0,0,0) — its pivot, NOT base-centre — because the render layer spins it in place
about its axle (`features/drive/wheel-spin.ts` rotates `wheel*` nodes about local X). The axle runs along
Blender +X (the track), matching the whole-chassis convention. The Frame's `socket_axle_<i>` empties sit
at hub height (Z = WHEEL_R), so the snapped wheel's tyre just kisses the ground.

ARTICULATED: keeps its hub-pivot origin (no base-centre re-origin from build_asset.py). The joined root
is named `wheel-axle` (a `wheel*` name) so the spin/deploy animators find every instanced clone.
"""

import math

import rr_style as rr

ARTICULATED = True

WHEEL_R = 0.33       # radius — matches the Frame's socket hub height
TREAD = 0.28         # tyre width along the X axle
HUB_W = TREAD + 0.10  # rust hub pokes out both tyre faces


def _cyl_x(name, radius, depth, mat, verts=16):
    """A cylinder laid along Blender +X (the axle/track), centred on the hub at the origin."""
    obj = rr.beveled_cylinder(name, radius, depth, mat, location=(0.0, 0.0, 0.0), verts=verts)
    obj.rotation_euler = (0.0, math.radians(90), 0.0)  # axle Z → X (baked on join)
    return obj


def build():
    parts = [
        _cyl_x("wheel_tyre", WHEEL_R, TREAD, "dark_metal", verts=16),
        _cyl_x("wheel_hub", 0.14, HUB_W, "rust", verts=10),
        # A hazard nub proud of the tread, off-centre, so the spin reads from the side.
        rr.beveled_box("wheel_nub", (0.08, 0.08, 0.10), "hazard_yellow", (0.0, WHEEL_R - 0.06, 0.0)),
    ]
    # Lug bolts: a ring on each hub face — high-contrast, off-centre points so the rotation is
    # unmistakable from either side (the wheel is instanced at both left and right corners).
    face_x = HUB_W / 2 + 0.02
    for fx in (face_x, -face_x):
        for k in range(5):
            a = math.radians(72 * k)
            parts.append(rr.beveled_box(
                "wheel_lug", (0.06, 0.05, 0.05), "dark_metal",
                (fx, 0.09 * math.cos(a), 0.09 * math.sin(a)),
            ))

    wheel = rr.join(parts, "wheel-axle")
    rr.set_origin(wheel, (0.0, 0.0, 0.0))  # hub pivot — aligns with the Frame's socket_axle_* + spins in place
    return wheel
