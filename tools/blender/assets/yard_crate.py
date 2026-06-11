"""
yard-crate — an INTACT supply crate of shop stock: a banded box with corner posts and a stencil mark.

The shop yard's "kept in order" note — deliberately the opposite of `debris-crate` (which is splintered and
ransacked). Scattered (with siblings) in the 8 tiles around a world shop by features/shop/shop-yard.ts,
duplicated/rotated/scaled and sometimes stacked, so a handful of small props read as a busy goods yard.

A static single-mesh prop (~0.8 m). World decoration, not a part — no tier, no collider. The first joined
piece is axis-aligned so the grounded origin lands true (see rr_style.set_origin_base_center). Front has no
meaning here (a crate is symmetric); authored upright like every prop.
"""

import rr_style as rr

W, D, H = 0.80, 0.70, 0.72
HALF_W, HALF_D = W / 2, D / 2


def build():
    parts = []
    # The body FIRST (axis-aligned) so the merged object carries no rotation → exact grounding.
    parts.append(rr.beveled_box("crate_body", size=(W, D, H), mat="rust", location=(0.0, 0.0, H / 2)))
    # Two dark banding straps low + high.
    parts.append(rr.beveled_box("crate_band_lo", size=(W + 0.04, D + 0.04, 0.08), mat="dark_metal", location=(0.0, 0.0, 0.18)))
    parts.append(rr.beveled_box("crate_band_hi", size=(W + 0.04, D + 0.04, 0.08), mat="dark_metal", location=(0.0, 0.0, H - 0.16)))
    # Corner posts — the crate-frame read.
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(f"crate_post_{sx}_{sy}", size=(0.08, 0.08, H), mat="dark_metal",
                                        location=(sx * (HALF_W - 0.04), sy * (HALF_D - 0.04), H / 2)))
    # A bone-white stencil panel on the +Y face — "marked inventory".
    parts.append(rr.beveled_box("crate_stencil", size=(0.34, 0.04, 0.30), mat="bone_white", location=(0.0, HALF_D, H / 2 + 0.04)))
    return rr.join(parts, "yard-crate")
