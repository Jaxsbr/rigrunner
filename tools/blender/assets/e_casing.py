"""
e-casing — the electric engine's HOUSING sub-part AND the engine's assembly HOST (⚡ vocabulary).

An OPEN rig_blue frame the engine's internals seat into — the §2b "open frame holding its located
internals" read (`docs/part-identity-spec.md`). It is the assembly HOST: its GLB carries
`socket_core` / `socket_coupling` / `socket_regulator` empties at the internal stations, and the
shared assembler snaps each sub-part onto its socket at its own tier (`docs/asset-style.md` "Assembly
sockets"). Built open on the sides — a base deck + dark corner posts + a top rail frame — so the
graded internals read straight through it, with a glow_green status nub and hazard front marker so
"powered" + forward read at a glance. The signature rig_blue deck is the §3 "player-built" cue.

FRONT = Blender +Y (→ −Z after export); the internals are authored front-toward +Y too, so a coupling
snapped to its socket already faces the drive. The deck is base-centred (footprint centred on X/Y,
lowest point at Z=0), so `build_asset.py`'s base-centre re-origin is a no-op and the socket empties —
left as top-level siblings, the `chassis_common` pattern — keep their authored positions.
"""

import rr_style as rr

W = 1.25          # frame width (X) — compact, ~1 deck cell (electric reads tighter than bulky steam)
L = 1.20          # frame depth (Y, front +Y) — Core at the back, Coupling + Regulator across the front
DECK_H = 0.10     # base deck thickness; internals seat on its top
POST_H = 0.62     # corner-post height (the open cage)
HALF_W = W / 2
HALF_L = L / 2
DECK_TOP = DECK_H
TOP_Z = DECK_H + POST_H


def build():
    parts = [
        # Base deck — the signature rig_blue floor the internals bolt onto (first chunk; its bevel
        # rounds the whole join).
        rr.beveled_box("deck", (W, L, DECK_H), "rig_blue", (0.0, 0.0, DECK_H / 2)),
    ]
    # Corner posts — dark uprights at the four corners: an open cage, not a closed box.
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rr.beveled_box(
                f"post_{sx}_{sy}", (0.09, 0.09, POST_H), "dark_metal",
                (sx * (HALF_W - 0.06), sy * (HALF_L - 0.06), DECK_H + POST_H / 2)))
    # Top rails — a dark frame tying the post tops, sides left open so the internals show through.
    parts.append(rr.beveled_box("rail_l", (0.09, L, 0.09), "dark_metal", (-(HALF_W - 0.06), 0.0, TOP_Z)))
    parts.append(rr.beveled_box("rail_r", (0.09, L, 0.09), "dark_metal", (HALF_W - 0.06, 0.0, TOP_Z)))
    parts.append(rr.beveled_box("rail_f", (W, 0.09, 0.09), "dark_metal", (0.0, HALF_L - 0.06, TOP_Z)))
    parts.append(rr.beveled_box("rail_b", (W, 0.09, 0.09), "dark_metal", (0.0, -(HALF_L - 0.06), TOP_Z)))
    # Status light — a glow_green nub on the front rail, the "powered" cue read off the front.
    parts.append(rr.beveled_box("status", (0.16, 0.05, 0.06), "glow_green", (0.0, HALF_L - 0.02, TOP_Z)))
    # Front marker — a hazard_yellow nub on the deck's leading edge, so forward reads at a glance.
    parts.append(rr.beveled_box("marker", (0.24, 0.07, 0.06), "hazard_yellow", (0.0, HALF_L - 0.04, DECK_H + 0.04)))

    body = rr.join(parts, "e-casing")

    # Assembly sockets — where each internal's base seats on the deck (its origin snaps here at runtime).
    # A triangle that fits a ~1-cell frame: the tall Core at the back (the heart), the Coupling and
    # Regulator across the front where their control faces read off the engine's front.
    rr.empty("socket_core", (0.0, -0.28, DECK_TOP))
    rr.empty("socket_coupling", (-0.30, 0.24, DECK_TOP))
    rr.empty("socket_regulator", (0.30, 0.24, DECK_TOP))
    return body
