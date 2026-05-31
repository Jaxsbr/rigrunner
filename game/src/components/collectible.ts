import { defineComponent } from '../core/component';

/**
 * Marks a loose world entity that the rig picks up on contact — a unit of *loose scrap* today.
 * `value` is how much it adds to the rig's storage when collected (1 per piece for now).
 *
 * Deliberately separate from Collider: the collider says "this has a physical footprint", the
 * Collectible says "consuming a contact with this yields `value` into storage". The scrap-collection
 * system pairs the two — a Collectible overlapping the rig (or a part mounted on it) is collected.
 * Keeping collection generic (any Collectible, not just "scrap") leaves room for other pickups
 * later without touching the collision/collection seam.
 */
export interface Collectible {
  value: number;
}

export const Collectible = defineComponent<Collectible>('Collectible');
