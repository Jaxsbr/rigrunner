import { defineComponent } from '@core/component';

/**
 * A rummageable heap of junk in the world — Option C's loot source. Like a WorkshopZone it is a
 * PROXIMITY-GATED interaction, but with a sharper gate: a pile only becomes workable while the rig
 * is parked in reach AND is carrying a mounted Reclaimer AND that Reclaimer's arm is aimed at the
 * pile (within `fov`). No Reclaimer / wrong way round → the pile is visibly locked (its disc stays
 * dim), which teaches the build→run gate (go build the tool, then point it).
 *
 * `radius` is the interaction zone in metres from the pile centre; the range test is circle-vs-circle
 * against the rig's own collider (park beside it, you don't have to bullseye the centre), matching
 * the workshop zone.
 *
 * `fov` is the FULL field-of-view angle (radians) the arm must have the pile within — 120° reads as
 * "roughly facing it" rather than pixel-precise aiming. The gate checks the angle between the arm's
 * front (local −Z) and the direction to the pile against `fov / 2`.
 *
 * `total`/`remaining` are the pile's depth in WAVES of scrap. Holding-to-work drains `remaining` one
 * wave at a time (each wave scatters a random handful of loose scrap around the rig), and the render
 * layer shrinks the heap toward `remaining / total` so the depletion is watched, not a counter.
 * `worked` is the transient time accrued toward the next wave (like WorkshopDrain.elapsed).
 * `scrapScattered` accumulates how many loose-scrap pieces the pile has flung out across its waves —
 * the pile's running scrap yield, reported in the loot popup when it clears (PR5).
 *
 * `active` is recomputed each frame by scrapPileSystem (the full gate above); it's cached here so the
 * rummage system (may I drain this?) and the render overlay (dim grey vs. lit green disc) read one
 * answer. View owns no truth — this flag is the truth.
 */
export interface ScrapPile {
  radius: number;
  fov: number;
  total: number;
  remaining: number;
  worked: number;
  scrapScattered: number;
  active: boolean;
}

export const ScrapPile = defineComponent<ScrapPile>('ScrapPile');
