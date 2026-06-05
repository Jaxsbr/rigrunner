"""
s-boiler — the steam engine's HOUSING sub-part AND the engine's assembly HOST (♨ industrial vocabulary).

The steam counterpart to the electric Casing: an open dark_metal skid carrying a riveted rust boiler
drum at the back, that the engine's internals (Piston, Driveshaft, Throttle) seat into in front — the
§2b "open frame holding its located internals" read (`docs/part-identity-spec.md`). It is the assembly
HOST: its GLB carries `socket_piston` / `socket_driveshaft` / `socket_throttle` empties at the internal
stations, and the shared assembler snaps each sub-part onto its socket at its own tier
(`docs/asset-style.md` "Assembly sockets"). The warm rust drum + hazard pressure band are the §3 steam
cast — heat at the back, the working gear in front.

FRONT = Blender +Y (→ −Z after export); internals are authored front-toward +Y, so a driveshaft snapped
to its socket already points the way power flows. The skid is base-centred (footprint centred on X/Y,
lowest point at Z=0), so the base-centre re-origin is a no-op and the socket empties — top-level siblings
(the `chassis_common` pattern) — keep their authored positions.
"""

import math

import rr_style as rr

W = 1.60          # skid width (X) — three internals seat in a row across it
L = 1.30          # skid depth (Y) — long enough for the Driveshaft (~0.9 m) in front of the drum
DECK_H = 0.10
HALF_W = W / 2
HALF_L = L / 2
DECK_TOP = DECK_H
DRUM_Y = -0.46    # the boiler drum sits across the back of the skid
DRUM_R = 0.24
DRUM_Z = DECK_H + 0.30


def _cyl_x(name, r, d, mat, loc, verts=18):
    """A cylinder laid along Blender +X (the drum spans the skid's width)."""
    obj = rr.beveled_cylinder(name, r, d, mat, location=loc, verts=verts)
    obj.rotation_euler = (0.0, math.radians(90), 0.0)
    return obj


def build():
    parts = [
        # Skid deck — the dark base the drum and internals bolt onto (first chunk; bevel rounds the join).
        rr.beveled_box("deck", (W, L, DECK_H), "dark_metal", (0.0, 0.0, DECK_H / 2)),
        # Boiler drum — the rust pressure vessel across the back: the part's bulk and its warm steam cue.
        _cyl_x("drum", DRUM_R, 1.10, "rust", (0.0, DRUM_Y, DRUM_Z)),
        # Reinforcing bands — scrap_grey hoops proud of the drum, the riveted-boiler read.
        _cyl_x("band_l", DRUM_R + 0.02, 0.05, "scrap_grey", (-0.40, DRUM_Y, DRUM_Z)),
        _cyl_x("band_r", DRUM_R + 0.02, 0.05, "scrap_grey", (0.40, DRUM_Y, DRUM_Z)),
        # Pressure band — a hazard_yellow hoop at the centre of the drum, the warning cue.
        _cyl_x("press_band", DRUM_R + 0.015, 0.05, "hazard_yellow", (0.0, DRUM_Y, DRUM_Z)),
        # Saddle blocks — two dark cradles the drum rests in, so it reads as seated, not floating.
        rr.beveled_box("saddle_l", (0.12, 0.30, 0.24), "dark_metal", (-0.42, DRUM_Y, DECK_H + 0.12)),
        rr.beveled_box("saddle_r", (0.12, 0.30, 0.24), "dark_metal", (0.42, DRUM_Y, DECK_H + 0.12)),
    ]
    # Side rails — low dark kerbs along the skid's long edges, framing the internals bay.
    parts.append(rr.beveled_box("rail_l", (0.08, L, 0.10), "dark_metal", (-(HALF_W - 0.05), 0.0, DECK_H + 0.05)))
    parts.append(rr.beveled_box("rail_r", (0.08, L, 0.10), "dark_metal", (HALF_W - 0.05, 0.0, DECK_H + 0.05)))
    # Front marker — a hazard_yellow nub on the leading edge, so forward reads at a glance.
    parts.append(rr.beveled_box("marker", (0.24, 0.07, 0.06), "hazard_yellow", (0.0, HALF_L - 0.04, DECK_H + 0.04)))

    body = rr.join(parts, "s-boiler")

    # Assembly sockets — where each internal's base seats on the skid in front of the drum (origin snaps
    # here at runtime). A row across the bay: Piston (left), Driveshaft centred (it runs fore-aft), Throttle (right).
    rr.empty("socket_piston", (-0.55, 0.12, DECK_TOP))
    rr.empty("socket_driveshaft", (0.0, 0.20, DECK_TOP))
    rr.empty("socket_throttle", (0.56, 0.16, DECK_TOP))
    return body
