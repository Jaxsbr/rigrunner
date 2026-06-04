"""
workshop — the home-base build fixture: a 3×3 mounting platform that sits flat on the ground.

It is the workshop counterpart to the rig's deck (see rig.py): the SAME mounting grid mechanism,
but a static fixture rather than a vehicle, so it is deliberately built to read differently:

  * ground-hugging (no wheels, low skirt) — it never moves; the rig drives up beside it.
  * a distinct deck colour — `scrap_grey` deck, NOT the rig's signature `rig_blue`, so the player
    never confuses "the workshop's cells" with "my rig's cells".
  * `hazard_yellow` grid lips — strong marked cells that read as an industrial work zone.

Footprint: 3 m × 3 m = a 3×3 grid of 1 m cells (cellSize 1, matching the rig). Centred on X/Y,
lowest point on Z=0, deck surface at Z=0.20 — this MUST equal the MountGrid.deckY the game spawns
the workshop with (see game/src/features/workshop/workshop.ts), so mounted parts rest exactly on the deck.

Front faces Blender +Y (→ −Z in three.js) by convention; a platform has no real "front", but the
convention keeps origin/orientation handling identical to every other asset.
"""

import rr_style as rr

# --- dimensions (metres, Blender Z-up) -------------------------------------------------
WIDTH = 3.0          # X — 3 cells
LENGTH = 3.0         # Y — 3 cells
HALF_W = WIDTH / 2
HALF_L = LENGTH / 2

SKIRT_TOP = 0.10     # low base slab: a slightly wider skirt grounding the platform
DECK_BOT = 0.10      # deck slab sits on the skirt …
DECK_TOP = 0.20      # … its top is the surface parts mount onto (== MountGrid.deckY)
LIP_TOP = 0.28       # raised grid ridges that draw the 3×3 cells


def build():
    body = []

    # Base skirt — the lowest geometry (reaches Z=0 so the base-centre origin pass is a no-op
    # shift), a touch wider than the deck so the platform reads as planted on the ground.
    body.append(rr.beveled_box("skirt", (WIDTH + 0.2, LENGTH + 0.2, SKIRT_TOP), "dark_metal",
                               (0.0, 0.0, SKIRT_TOP / 2)))

    # The 3×3 mounting deck slab — scrap_grey, deliberately NOT rig_blue (that's the rig's signature).
    body.append(rr.beveled_box("deck", (WIDTH, LENGTH, DECK_TOP - DECK_BOT), "scrap_grey",
                               (0.0, 0.0, (DECK_BOT + DECK_TOP) / 2)))

    # Raised grid lips dividing the deck into 3 (X) × 3 (Y) cells — hazard_yellow against the grey
    # deck so the mounting grid is unmistakable (mirrors the rig's lip approach in rig.py, but the
    # rig divides into 2×3 and uses dark_metal; here it's 3×3 hazard markings for the work zone).
    lip_z = (DECK_TOP + LIP_TOP) / 2
    lip_h = LIP_TOP - DECK_TOP
    rail = 0.12          # rail thickness (matches rig.py — thinner pinches under the bevel)
    inset = rail / 2     # pull the perimeter frame in so each rail sits FULLY on the deck
    span_x = WIDTH - rail   # rail extents that meet the corners without overhanging
    span_y = LENGTH - rail
    edge_x = HALF_W - inset
    edge_y = HALF_L - inset

    # Closed perimeter frame, fully on the deck.
    body.append(rr.beveled_box("edge_front", (span_x, rail, lip_h), "hazard_yellow", (0.0, -edge_y, lip_z)))
    body.append(rr.beveled_box("edge_back", (span_x, rail, lip_h), "hazard_yellow", (0.0, edge_y, lip_z)))
    body.append(rr.beveled_box("edge_left", (rail, span_y, lip_h), "hazard_yellow", (-edge_x, 0.0, lip_z)))
    body.append(rr.beveled_box("edge_right", (rail, span_y, lip_h), "hazard_yellow", (edge_x, 0.0, lip_z)))

    # Interior dividers → 3×3. Cell boundaries fall at ±0.5 on each axis (1 m cells centred on origin).
    body.append(rr.beveled_box("div_x1", (rail, span_y, lip_h), "hazard_yellow", (-0.5, 0.0, lip_z)))
    body.append(rr.beveled_box("div_x2", (rail, span_y, lip_h), "hazard_yellow", (0.5, 0.0, lip_z)))
    body.append(rr.beveled_box("div_y1", (span_x, rail, lip_h), "hazard_yellow", (0.0, -0.5, lip_z)))
    body.append(rr.beveled_box("div_y2", (span_x, rail, lip_h), "hazard_yellow", (0.0, 0.5, lip_z)))

    return rr.join(body, "workshop")
