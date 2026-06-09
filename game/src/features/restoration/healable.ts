import { defineComponent } from '@core/component';

/**
 * Marks a cleared-site stump (a `RestorableSite`) that the player can grow back into a young tree with a
 * stump-healer Reclaimer — the restoration mechanic. It is the sim truth the render reads:
 *   - `growth` 0→1 is how far the stump has been grown (0 = the bare cut stump with its baked sprout;
 *     1 = a full young tree). It only ever rises, advanced while the player holds the work key with the
 *     gate met; the tree-grower poses the procedural tree off it and the greenery patch deepens with it.
 *   - `active` is the gate flag recomputed each frame (rig in reach AND a stump-healer Reclaimer aimed at
 *     it AND not yet fully grown) — the "Hold E" prompt + proximity disc light off it, like the scrap pile.
 *
 * The restoration system adds it to every `RestorableSite` (the shared seam cleared piles and camps both
 * emit), so a stump from either source heals through one path.
 */
export interface Healable {
  growth: number;
  active: boolean;
}

export const Healable = defineComponent<Healable>('Healable');
