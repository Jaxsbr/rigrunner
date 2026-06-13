import { defineComponent } from '@core/component';

/**
 * Marks a loose world entity that the rig picks up on contact — a unit of *loose scrap* today.
 *
 * Worth is one of two shapes. A FIXED collectible carries its `value` and yields exactly that when
 * collected. A ROLLED collectible (loose scrap) sets `valueMin`/`valueMax` and is worth a fresh
 * uniform roll in `[valueMin, valueMax]` decided AT THE MOMENT OF COLLECTION — so each sweep is a
 * small variable-reward pull (the "+N" pop shows the roll), and `value` is unused. The roll is at
 * collection (not spawn) on purpose: a piece carries no settled worth in the world, so persistence
 * stores only its spot and a reloaded piece re-rolls.
 *
 * Deliberately separate from Collider: the collider says "this has a physical footprint", the
 * Collectible says "consuming a contact with this yields scrap into storage". The scrap-collection
 * system pairs the two — a Collectible overlapping the rig (or a part mounted on it) is collected.
 */
export interface Collectible {
  value: number;
  /** Set together to make worth a roll in `[valueMin, valueMax]` at collection; `value` is then ignored. */
  valueMin?: number;
  valueMax?: number;
}

export const Collectible = defineComponent<Collectible>('Collectible');
