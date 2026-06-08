import { defineComponent } from '@core/component';

/**
 * The marker a reclaimed site leaves behind — the shared seam the world-restoration work (M4) subscribes
 * to. A site publishes "I'm cleared, here's a spot the land can heal," and knows nothing about what
 * happens next; NOTHING consumes this yet, deliberately.
 *
 * Two features emit it, so it lives in the shared kernel: a cleared looter **camp** (its rising sprout is
 * also a `RestorableSite`) and a fully-rummaged scrap **pile** (its sprout likewise). Both leave the same
 * stump-and-leaves scar, so a future restoration treats cleared camps and cleared piles through one path.
 */
export interface RestorableSite {
  x: number;
  z: number;
  /** What produced this site — `'camp'` or `'scrap'` — so a future restoration can pick a treatment. */
  kind: string;
  /** The level of the source (a camp's level), for richer restorations to scale off. 0 when the source
   *  has no level (a scrap pile). */
  sourceLevel: number;
}

export const RestorableSite = defineComponent<RestorableSite>('RestorableSite');
